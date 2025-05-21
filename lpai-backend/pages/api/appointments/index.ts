import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';
import { ObjectId } from 'mongodb';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  if (req.method === 'POST') {
    // Only log the incoming payload and highlight what's required for debugging
    console.log('[API] /api/appointments POST raw data:', req.body);

    const {
      contactId, userId, locationId, start, end,
      title = '', calendarId = '', notes = '',
      locationType = '', customLocation = ''
    } = req.body;

    // Validate required fields (show userId, contactId, etc.)
    if (!contactId || !userId || !locationId || !start || !end || !calendarId) {
      return res.status(400).json({
        error: 'Missing required fields',
        fields: { contactId, userId, locationId, start, end, calendarId }
      });
    }

    // Look up Mongo records
    let contact, user;
    try {
      contact = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid contactId or userId format' });
    }

    if (!contact) return res.status(400).json({ error: 'Contact not found' });
    if (!user) return res.status(400).json({ error: 'User not found' });
    if (!contact.ghlContactId) return res.status(400).json({ error: 'Contact found but missing ghlContactId' });
    if (!user.ghlUserId) return res.status(400).json({ error: 'User found but missing ghlUserId' });

    // Address logic
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
      return res.status(400).json({ error: 'No GHL API key found for locationId' });
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

    // Remove empty/undefined/null
    Object.keys(ghlPayload).forEach(
      k => (ghlPayload[k] === undefined || ghlPayload[k] === null || ghlPayload[k] === '') && delete ghlPayload[k]
    );

    // Helpful: log the actual payload being sent to GHL (for copy-paste if needed)
    console.log('[API] FINAL GHL payload:', JSON.stringify(ghlPayload, null, 2));

    // Call GoHighLevel API
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
      // Only log success, not full response unless needed
      console.log('[API] GHL appointment created:', ghlRes.data?.id || ghlRes.data?.event?.id || '(unknown id)');
      return res.status(201).json({ ghlPayload, ghlResponse: ghlRes.data, ghlAppointmentId: ghlRes.data.event?.id || ghlRes.data.id });
    } catch (e: any) {
      // Only log the error response if available
      console.error('[API] Failed to sync appointment to GHL', e?.response?.data || e.message);
      return res.status(500).json({ error: e.response?.data || e.message, ghlPayload });
    }
  }

  // --- GET handler unchanged ---
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
