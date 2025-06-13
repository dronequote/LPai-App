import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { 
  sendSuccess, 
  sendServerError, 
  sendError, 
  sendPaginatedSuccess, 
  sendValidationError,
  sendMethodNotAllowed
} from '../../../src/lib/apiResponses';
import { getPaginationParams, filterData } from '../../../src/lib/filters';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

// Type for filter fields
interface FilterFields {
  startDate?: string;
  endDate?: string;
  userId?: string;
  status?: string;
  calendarId?: string;
  contactId?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  if (req.method === 'GET') {
    console.log('[API] /api/appointments GET called with params:', req.query);
    
    try {
      const { limit = 50, offset = 0, ...params } = req.query;
      
      // Extract query parameters
      const { 
        locationId, 
        start, 
        end, 
        userId, 
        calendarId, 
        status,
        includeUser,
        includeCalendar,
        includeContact
      } = params;

      // Build MongoDB query
      const query: any = {};
      if (locationId) query.locationId = locationId;
      
      // Date range filter
      if (start || end) {
        query.$and = query.$and || [];
        
        if (start) {
          query.$and.push({
            $or: [
              { start: { $gte: new Date(start as string).toISOString() } },
              { startTime: { $gte: new Date(start as string).toISOString() } }
            ]
          });
        }
        
        if (end) {
          query.$and.push({
            $or: [
              { end: { $lte: new Date(end as string).toISOString() } },
              { endTime: { $lte: new Date(end as string).toISOString() } }
            ]
          });
        }
      }
      
      if (userId) query.userId = userId;
      if (calendarId) query.calendarId = calendarId;
      if (status) query.status = status;

      // Apply pagination
      const totalCount = await db.collection('appointments').countDocuments(query);
      const appointments = await db.collection('appointments')
        .find(query)
        .limit(Number(limit))
        .skip(Number(offset))
        .sort({ start: -1, startTime: -1 })
        .toArray();

      // Format result
      const result = {
        data: appointments,
        pagination: {
          total: totalCount,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + appointments.length < totalCount
        }
      };

      // Optionally include user details if requested
      if (includeUser === 'true') {
        const userIds = [...new Set(appointments.map(a => a.userId).filter(Boolean))];
        if (userIds.length > 0) {
          const users = await db.collection('users').find({
            _id: { $in: userIds.map(id => new ObjectId(id)) }
          }).toArray();
          
          const userMap = Object.fromEntries(
            users.map(u => [u._id.toString(), {
              name: u.name,
              firstName: u.firstName,
              lastName: u.lastName,
              email: u.email
            }])
          );
          
          result.data = result.data.map(appointment => ({
            ...appointment,
            userDetails: appointment.userId ? userMap[appointment.userId] : null
          }));
        }
      }

      // Optionally include contact details if requested
      if (includeContact === 'true') {
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

    // Get the OAuth token for this location (UPDATED FROM apiKey)
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.ghlOAuth?.accessToken) {
      return sendError(res, 'No OAuth token found for locationId', 400);
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
            'Authorization': `Bearer ${location.ghlOAuth.accessToken}`, // UPDATED TO USE OAUTH
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
      console.error('[API] Failed to save appointment locally:', e);
      return sendServerError(res, e, 'Failed to save appointment locally');
    }

    // --- Step 3: Return success with both local and GHL IDs ---
    return sendSuccess(
      res,
      {
        success: true,
        appointment: savedAppointment,
        ghlAppointmentId: ghlResponse.event?.id || ghlResponse.id,
      },
      'Appointment created successfully'
    );
  }

  // Method not allowed
  return sendMethodNotAllowed(res, ['GET', 'POST']);
}