import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';
import { ObjectId } from 'mongodb';
import { 
  paginate, 
  buildDateRangeFilter, 
  buildSearchFilter 
} from '../../../src/utils/pagination';
import { 
  parseQueryParams, 
  buildAppointmentFilter 
} from '../../../src/utils/filters';
import { 
  sendPaginatedSuccess, 
  sendSuccess, 
  sendError, 
  sendValidationError,
  sendServerError,
  sendMethodNotAllowed 
} from '../../../src/utils/response';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  if (req.method === 'GET') {
    try {
      // Parse and validate query parameters
      const params = parseQueryParams(req.query);
      
      if (!params.locationId) {
        return sendValidationError(res, { locationId: 'Missing locationId' });
      }

      // Build base filter
      const filter = buildAppointmentFilter(params);
      
      // Add date range filter for appointments (using 'start' field)
      if (params.startDate || params.endDate) {
        const dateFilter = buildDateRangeFilter('start', params.startDate, params.endDate);
        Object.assign(filter, dateFilter);
      }
      
      // Add search filter
      if (params.search) {
        const searchFilter = buildSearchFilter(params.search, [
          'title', 
          'notes', 
          'contactName',
          'address',
          'customLocation'
        ]);
        if (searchFilter.$or) {
          if (filter.$or) {
            filter.$and = [{ $or: filter.$or }, searchFilter];
            delete filter.$or;
          } else {
            Object.assign(filter, searchFilter);
          }
        }
      }

      // Get paginated results
      const result = await paginate(
        db.collection('appointments'),
        filter,
        {
          limit: params.limit,
          offset: params.offset,
          sortBy: params.sortBy === 'createdAt' ? 'start' : params.sortBy, // Default to 'start' for appointments
          sortOrder: params.sortOrder
        }
      );

      // Optionally include user details if requested
      if (params.includeUser === 'true') {
        const userIds = [...new Set(result.data.map(a => a.userId).filter(Boolean))];
        
        if (userIds.length > 0) {
          const users = await db.collection('users').find({
            userId: { $in: userIds }
          }).toArray();
          
          const userMap = Object.fromEntries(
            users.map(u => [u.userId, {
              name: u.name,
              email: u.email,
              phone: u.phone
            }])
          );
          
          result.data = result.data.map(appointment => ({
            ...appointment,
            assignedUser: appointment.userId ? userMap[appointment.userId] : null
          }));
        }
      }

      // Optionally include contact details if requested
      if (params.includeContact === 'true') {
        const contactIds = result.data
          .map(a => a.contactId)
          .filter(Boolean)
          .filter(id => ObjectId.isValid(id));
          
        if (contactIds.length > 0) {
          const contacts = await db.collection('contacts').find({
            _id: { $in: contactIds.map(id => new ObjectId(id)) }
          }).toArray();
          
          const contactMap = Object.fromEntries(
            contacts.map(c => [c._id.toString(), {
              firstName: c.firstName,
              lastName: c.lastName,
              email: c.email,
              phone: c.phone
            }])
          );
          
          result.data = result.data.map(appointment => ({
            ...appointment,
            contactDetails: appointment.contactId ? contactMap[appointment.contactId] : null
          }));
        }
      }

      return sendPaginatedSuccess(
        res, 
        result.data, 
        result.pagination, 
        'Appointments retrieved successfully'
      );
      
    } catch (err) {
      console.error('❌ Failed to fetch appointments:', err);
      return sendServerError(res, err, 'Failed to fetch appointments');
    }
  }

  if (req.method === 'POST') {
    // Log incoming request
    console.log('[API] /api/appointments POST raw data:', req.body);

    const {
      contactId, userId, locationId, start, end,
      title = '', calendarId = '', notes = '',
      locationType = '', customLocation = '', duration = 60
    } = req.body;

    // Validate required fields
    if (!contactId || !userId || !locationId || !start || !end || !calendarId) {
      return sendValidationError(res, {
        contactId: !contactId ? 'Required' : undefined,
        userId: !userId ? 'Required' : undefined,
        locationId: !locationId ? 'Required' : undefined,
        start: !start ? 'Required' : undefined,
        end: !end ? 'Required' : undefined,
        calendarId: !calendarId ? 'Required' : undefined,
      });
    }

    // Look up Mongo records
    let contact, user;
    try {
      contact = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    } catch (e) {
      return sendValidationError(res, { 
        contactId: 'Invalid contactId format',
        userId: 'Invalid userId format' 
      });
    }

    if (!contact) return sendError(res, 'Contact not found', 404);
    if (!user) return sendError(res, 'User not found', 404);
    if (!contact.ghlContactId) return sendError(res, 'Contact found but missing ghlContactId', 400);
    if (!user.ghlUserId) return sendError(res, 'User found but missing ghlUserId', 400);

    // Address/location logic
    let meetingLocationType = locationType || 'address';
    let address = '';
    if (meetingLocationType === 'address') {
      address = contact.address || 'No Address Provided';
    } else if (meetingLocationType === 'custom') {
      address = customLocation || 'Custom Location Not Provided';
    } else if (['phone', 'googlemeet', 'zoom'].includes(meetingLocationType)) {
      address = meetingLocationType.charAt(0).toUpperCase() + meetingLocationType.slice(1);
    } else {
      address = 'TBD';
    }

    let meetingLocationId = 'default';

    // Get the API key for this location
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.apiKey) {
      return sendError(res, 'No GHL API key found for locationId', 400);
    }

    // Build payload for GHL API
    const ghlPayload: any = {
      title,
      meetingLocationType,
      meetingLocationId,
      overrideLocationConfig: true,
      appointmentStatus: 'confirmed',
      assignedUserId: user.ghlUserId,           // GHL user id
      address,
      ignoreDateRange: false,
      toNotify: false,
      ignoreFreeSlotValidation: true,
      calendarId,
      locationId,
      contactId: contact.ghlContactId,          // GHL contact id (NOT Mongo _id!)
      startTime: start,
      endTime: end,
      notes
    };

    // Remove empty/undefined/null fields
    Object.keys(ghlPayload).forEach(
      k => (ghlPayload[k] === undefined || ghlPayload[k] === null || ghlPayload[k] === '') && delete ghlPayload[k]
    );

    // Log GHL payload for debugging
    console.log('[API] FINAL GHL payload:', JSON.stringify(ghlPayload, null, 2));

    // --- Step 1: Create in GHL first ---
    let ghlResponse;
    try {
      const ghlRes = await axios.post(
        `${GHL_BASE_URL}/calendars/events/appointments`,
        ghlPayload,
        {
          headers: {
            'Authorization': `Bearer ${location.apiKey}`,
            'Version': '2021-04-15',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        }
      );
      ghlResponse = ghlRes.data;
      console.log('[API] GHL appointment created:', ghlRes.data?.event?.id || ghlRes.data?.id || ghlRes.data);
    } catch (e: any) {
      // Log the error response if available
      console.error('[API] Failed to sync appointment to GHL', e?.response?.data || e.message);
      return sendServerError(res, e?.response?.data || e?.message, 'Failed to sync appointment to GHL');
    }

    // --- Step 2: Save appointment locally in MongoDB ---
    const appointmentDoc = {
      title,
      contactId: contactId.toString(), // Mongo _id as string
      userId: userId.toString(),
      locationId,
      start,
      end,
      calendarId,
      notes,
      locationType,
      customLocation,
      duration,
      ghlAppointmentId: ghlResponse.event?.id || ghlResponse.id, // Save GHL ID if available
      ghlPayload,
      ghlResponse,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let savedAppointment;
    try {
      const { insertedId } = await db.collection('appointments').insertOne(appointmentDoc);
      savedAppointment = { ...appointmentDoc, _id: insertedId };
      console.log('[API] Local appointment saved with _id:', insertedId);
    } catch (e) {
      // TS: e is unknown
      let errMsg = 'Unknown error';
      if (e && typeof e === 'object' && 'message' in e) {
        errMsg = (e as any).message;
      } else if (typeof e === 'string') {
        errMsg = e;
      }
      console.error('[API] Failed to save appointment in MongoDB:', errMsg);
      // Return GHL success, but warn about local save
      return sendSuccess(res, {
        ghlPayload,
        ghlResponse,
        ghlAppointmentId: ghlResponse.event?.id || ghlResponse.id,
        warning: 'Appointment created in GHL but failed to save in local DB',
        error: errMsg,
      }, 'Appointment created with warning');
    }

    // --- Step 3: Return both local and GHL results ---
    return sendSuccess(res, {
      appointment: savedAppointment,
      ghlPayload,
      ghlResponse,
      ghlAppointmentId: ghlResponse.event?.id || ghlResponse.id,
    }, 'Appointment created successfully');
  }

  return sendMethodNotAllowed(res, ['GET', 'POST']);
}