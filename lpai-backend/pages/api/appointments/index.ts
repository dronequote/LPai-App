import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  if (req.method === 'POST') {
    const {
      contactId, userId, locationId, start, end, title = '', calendarId = '', notes = '', type = 'Consultation'
    } = req.body;

    // Validate required fields for both Mongo and GHL
    if (!contactId || !userId || !locationId || !start || !end || !calendarId) {
      console.log('[API] Missing required fields', req.body);
      return res.status(400).json({ error: 'Missing required fields', fields: { contactId, userId, locationId, start, end, calendarId } });
    }

    // Save in MongoDB first
    const appointmentDoc: any = {
      contactId, userId, locationId,
      start: new Date(start),
      end: new Date(end),
      title: title || type,
      calendarId,
      notes,
      type,
      createdAt: new Date()
    };
    const result = await db.collection('appointments').insertOne(appointmentDoc);
    const mongoId = result.insertedId;

    // Find GHL API Key and related calendar info
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.apiKey) {
      console.log('[API] No GHL API key for location', locationId);
      return res.status(201).json({ ...appointmentDoc, _id: mongoId, ghlSyncError: 'No GHL API key' });
    }

    // Find the calendar in DB for required extra fields (groupId, teamMembers, etc)
    const calendar = await db.collection('ghl_calendars')?.findOne?.({ calendarId }); // If you mirror GHL calendars
    // Or add these as needed based on your structure

    // Build minimal GHL payload (required fields only, no nulls)
    const ghlPayload: any = {
      calendarId,
      contactId, // Must be GHL contact ID, not Mongo
      locationId,
      userId, // Must be GHL sub-user ID
      startTime: start,
      endTime: end,
      title: title || type,
      notes,
      status: "confirmed"
    };

    // Remove undefined/null/empty-string fields
    Object.keys(ghlPayload).forEach(
      (k) => !ghlPayload[k] && delete ghlPayload[k]
    );

    // LOG the payload you are sending
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

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
