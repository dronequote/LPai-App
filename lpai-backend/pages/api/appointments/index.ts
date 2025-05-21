import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';
import { ObjectId } from 'mongodb';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  if (req.method === 'POST') {
    // Log immediately
    console.log('[API] /api/appointments POST called with raw data:', req.body);

    const {
      contactId,            // Mongo _id of contact (as string)
      userId,               // Mongo _id of user (as string)
      locationId,           // GHL locationId (should be correct)
      start,                // ISO string
      end,                  // ISO string
      title = '',           // Appointment title
      calendarId = '',      // GHL calendarId
      notes = '',           // Notes
      type = 'Consultation',
      locationType = '',    // 'address', 'phone', 'googlemeet', 'zoom', 'custom'
      customLocation = '',  // If 'custom'
    } = req.body;

    // Validate required fields
    if (!contactId || !userId || !locationId || !start || !end || !calendarId) {
      console.log('[API] Missing required fields', req.body);
      return res.status(400).json({
        error: 'Missing required fields',
        fields: { contactId, userId, locationId, start, end, calendarId }
      });
    }

    // Print the type and value of contactId and userId before lookup
    console.log('[API] Received contactId:', contactId, typeof contactId);
    console.log('[API] Received userId:', userId, typeof userId);

    let contact, user;
    try {
      // Always convert to ObjectId!
      console.log('[API] Converting contactId and userId to ObjectId for Mongo lookup...');
      contact = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      console.log('[API] Lookup results:', { contact, user });
    } catch (e) {
      console.error('[API] Failed to convert IDs to ObjectId:', e);
      return res.status(400).json({ error: 'Invalid contactId or userId' });
    }

    if (!contact) {
      console.error('[API] Contact lookup failed for _id:', contactId);
      return res.status(400).json({ error: 'Contact not found for given contactId' });
    }
    if (!user) {
      console.error('[API] User lookup failed for _id:', userId);
      return res.status(400).json({ error: 'User not found for given userId' });
    }
    if (!contact.ghlContactId) {
      console.error('[API] Contact found but missing ghlContactId:', contact);
      return res.status(400).json({ error: 'Contact found but missing ghlContactId' });
    }
    if (!user.ghlUserId) {
      console.error('[API] User found but missing ghlUserId:', user);
      return res.status(400).json({ error: 'User found but missing ghlUserId' });
    }

    // Map address/location for GHL
    let meetingLocationType = locationType || 'address';
    let address = '';
    if (meetingLocationType === 'address') {
      address = contact.address || 'No Address Provided';
    } else if (meetingLocationType === 'custom') {
      address = customLocation || 'Custom Location Not Provided';
    } else if (['phone', 'googlemeet', 'zoom'].includes(meetingLocationType)) {
      address = meetingLocationType.charAt(0).toUpperCase() + meetingLocationType.slice(1); // e.g. "Zoom"
    } else {
      address = 'TBD';
    }

    // Set meetingLocationId to 'default' unless you have custom location configurations
    let meetingLocationId = 'default';

    // --- REMOVE MongoDB INSERT HERE! ---

    // Find location for API key
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.apiKey) {
      console.log('[API] No GHL API key for location', locationId);
      return res.status(400).json({ error: 'No GHL API key found for locationId' });
    }

    // Build GHL payload using GHL IDs, not Mongo IDs!
    const ghlPayload: any = {
      title,
      meetingLocationType,
      meetingLocationId,
      overrideLocationConfig: true,
      appointmentStatus: 'confirmed', // Default to confirmed
      assignedUserId: user.ghlUserId,         // GHL sub-user id
      address,
      ignoreDateRange: false,
      toNotify: false,
      ignoreFreeSlotValidation: true,
      calendarId,
      locationId,
      contactId: contact.ghlContactId,        // GHL contactId!
      startTime: start,
      endTime: end,
      notes
    };

    // Remove undefined/null/empty-string fields
    Object.keys(ghlPayload).forEach(
      (k) => (ghlPayload[k] === undefined || ghlPayload[k] === null || ghlPayload[k] === '') && delete ghlPayload[k]
    );

    // LOG the final payload to GHL
    console.log('[API] FINAL GHL payload:', JSON.stringify(ghlPayload, null, 2));

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
      // No Mongo update here!
      return res.status(201).json({ ghlPayload, ghlResponse: ghlRes.data, ghlAppointmentId: ghlId });

    } catch (e: any) {
      // Log the error and payload
      console.error('[API] Failed to sync appointment to GHL', e?.response?.data || e.message);
      return res.status(500).json({ error: e.response?.data || e.message, ghlPayload });
    }
  }

  // (GET handler unchanged, still uses Mongo for reading appointments)
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
