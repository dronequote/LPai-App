import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  if (req.method === 'POST') {
    // Get ALL fields you might need
    const {
      contactId,            // Mongo _id of contact (from frontend)
      userId,               // Mongo _id of user (from frontend)
      locationId,           // GHL LocationId (should be correct)
      start,                // ISO string (start time)
      end,                  // ISO string (end time)
      title = '',           // Appointment title
      calendarId = '',      // GHL calendarId
      notes = '',           // Notes
      type = 'Consultation',
      locationType = '',    // From your frontend: 'address', 'phone', 'googlemeet', 'zoom', 'custom'
      customLocation = '',  // From frontend if 'custom'
    } = req.body;

    // Validate required fields for MongoDB AND GHL
    if (!contactId || !userId || !locationId || !start || !end || !calendarId) {
      console.log('[API] Missing required fields', req.body);
      return res.status(400).json({
        error: 'Missing required fields',
        fields: { contactId, userId, locationId, start, end, calendarId }
      });
    }

    // Fetch contact to get ghlContactId and address
    const contact = await db.collection('contacts').findOne({ _id: contactId });
    // Fetch user to get ghlUserId
    const user = await db.collection('users').findOne({ _id: userId });
    if (!contact?.ghlContactId || !user?.ghlUserId) {
      console.log('[API] Missing GHL IDs: contact or user', { contact, user });
      return res.status(400).json({ error: 'Missing GHL contactId or userId' });
    }

    // Map address/location for GHL
    let meetingLocationType = locationType || 'address';
    let address = '';
    if (meetingLocationType === 'address') {
      address = contact.address || 'TBD';
    } else if (meetingLocationType === 'custom') {
      address = customLocation || 'TBD';
    } else if (['phone', 'googlemeet', 'zoom'].includes(meetingLocationType)) {
      address = meetingLocationType.charAt(0).toUpperCase() + meetingLocationType.slice(1); // e.g. "Zoom"
    } else {
      address = 'TBD';
    }

    // Set meetingLocationId to 'default' unless you have custom location configurations
    let meetingLocationId = 'default';

    // Save in MongoDB first (mirrors what the frontend sends)
    const appointmentDoc: any = {
      contactId, userId, locationId,
      start: new Date(start),
      end: new Date(end),
      title: title || type,
      calendarId,
      notes,
      type,
      createdAt: new Date(),
      meetingLocationType,
      address,
    };
    const result = await db.collection('appointments').insertOne(appointmentDoc);
    const mongoId = result.insertedId;

    // Find location for API key
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.apiKey) {
      console.log('[API] No GHL API key for location', locationId);
      return res.status(201).json({ ...appointmentDoc, _id: mongoId, ghlSyncError: 'No GHL API key' });
    }

    // Build GHL payload
    const ghlPayload: any = {
      title,
      meetingLocationType,
      meetingLocationId,
      overrideLocationConfig: true,
      appointmentStatus: 'confirmed', // Default to confirmed
      assignedUserId: user.ghlUserId,       // GHL sub-user id
      address,
      ignoreDateRange: false,
      toNotify: false,
      ignoreFreeSlotValidation: true,
      calendarId,
      locationId,
      contactId: contact.ghlContactId,      // GHL contactId
      startTime: start,
      endTime: end,
      notes
    };

    // Remove undefined/null/empty-string fields
    Object.keys(ghlPayload).forEach(
      (k) => (ghlPayload[k] === undefined || ghlPayload[k] === null || ghlPayload[k] === '') && delete ghlPayload[k]
    );

    // LOG what you’re sending to GHL
    console.log('[API] Sending appointment to GHL:', JSON.stringify(ghlPayload, null, 2));

    // POST to GHL
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

      // Log the response
      console.log('[API] GHL appointment creation response:', JSON.stringify(ghlRes.data, null, 2));
      const ghlId = ghlRes.data.event?.id || ghlRes.data.id;
      await db.collection('appointments').updateOne(
        { _id: mongoId },
        { $set: { ghlAppointmentId: ghlId } }
      );
      return res.status(201).json({ ...appointmentDoc, _id: mongoId, ghlAppointmentId: ghlId });

    } catch (e: any) {
      // Log the error and payload
      console.error('[API] Failed to sync appointment to GHL', e?.response?.data || e.message);
      await db.collection('appointments').updateOne(
        { _id: mongoId },
        { $set: { ghlSyncError: e.response?.data || e.message || 'Failed to sync to GHL' } }
      );
      return res.status(201).json({ ...appointmentDoc, _id: mongoId, ghlSyncError: e.response?.data || e.message });
    }
  }

  // (GET handler etc unchanged, just for completeness)
  if (req.method === 'GET') {
    const { locationId, userId, start, end } = req.query;
    if (!locationId) return res.status(400).json({ error: 'Missing locationId' });

    const filter: any = { locationId };
    if (userId) filter.userId = userId;
    if (start && end) filter.start = { $gte: new Date(start as string), $lte: new Date(end as string) };

    try {
      const appointments = await db.collection('appointments')
        .find(filter)
        .sort({ start: 1 })
        .toArray();
      return res.status(200).json(appointments);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch appointments', details: err });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
