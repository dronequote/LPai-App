import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';
import { ObjectId } from 'mongodb';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  if (req.method === 'POST') {
    // 1. Log everything received
    console.log('[API] /api/appointments POST raw data:', req.body);

    const {
      contactId, userId, locationId, start, end,
      title = '', calendarId = '', notes = '',
      locationType = '', customLocation = ''
    } = req.body;

    // 2. Validate required fields
    if (!contactId || !userId || !locationId || !start || !end || !calendarId) {
      console.error('[API] Missing required fields:', { contactId, userId, locationId, start, end, calendarId });
      return res.status(400).json({
        error: 'Missing required fields',
        fields: { contactId, userId, locationId, start, end, calendarId }
      });
    }

    // 3. Mongo lookups
    let contact, user;
    try {
      contact = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    } catch (e) {
      console.error('[API] Invalid contactId or userId format', { contactId, userId }, e);
      return res.status(400).json({ error: 'Invalid contactId or userId format' });
    }
    if (!contact) {
      console.error('[API] Contact not found', { contactId });
      return res.status(400).json({ error: 'Contact not found' });
    }
    if (!user) {
      console.error('[API] User not found', { userId });
      return res.status(400).json({ error: 'User not found' });
    }
    if (!contact.ghlContactId) {
      console.error('[API] Contact found but missing ghlContactId', { contactId });
      return res.status(400).json({ error: 'Contact found but missing ghlContactId' });
    }
    if (!user.ghlUserId) {
      console.error('[API] User found but missing ghlUserId', { userId });
      return res.status(400).json({ error: 'User found but missing ghlUserId' });
    }

    // 4. Meeting location logic
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

    // 5. Fetch API key for location
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.apiKey) {
      console.error('[API] No GHL API key found for locationId', { locationId });
      return res.status(400).json({ error: 'No GHL API key found for locationId' });
    }

    // 6. Build and clean GHL payload
    const ghlPayload: any = {
      title,
      meetingLocationType,
      meetingLocationId,
      overrideLocationConfig: true,
      appointmentStatus: 'confirmed',
      assignedUserId: user.ghlUserId,
      address,
      ignoreDateRange: false,
      toNotify: false,
      ignoreFreeSlotValidation: true,
      calendarId,
      locationId,
      contactId: contact.ghlContactId,
      startTime: start,
      endTime: end,
      notes
    };
    Object.keys(ghlPayload).forEach(
      k => (ghlPayload[k] === undefined || ghlPayload[k] === null || ghlPayload[k] === '') && delete ghlPayload[k]
    );

    // 7. Log the outgoing GHL payload
    console.log('[API] FINAL GHL payload:', JSON.stringify(ghlPayload, null, 2));

    // 8. GHL API call
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
      console.log('[API] GHL appointment created:', ghlRes.data?.id || ghlRes.data?.event?.id || '(unknown id)');
      return res.status(201).json({ ghlPayload, ghlResponse: ghlRes.data, ghlAppointmentId: ghlRes.data.event?.id || ghlRes.data.id });
    } catch (e: any) {
      console.error('[API] Failed to sync appointment to GHL', e?.response?.data || e.message);
      return res.status(500).json({ error: e.response?.data || e.message, ghlPayload });
    }
  }

  // GET unchanged
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
