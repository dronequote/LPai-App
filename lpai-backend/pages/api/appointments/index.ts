import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  // ----- GET: List Appointments -----
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

  // ----- POST: Create Appointment -----
  if (req.method === 'POST') {
    const {
      contactId, userId, locationId, start, end, title = '', calendarId = '', notes = '', type = 'Consultation'
    } = req.body;

    // Validate required fields
    if (!contactId || !userId || !locationId || !start || !end || !calendarId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Save in MongoDB first
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

    // 2. Find GHL API Key
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.apiKey) {
      return res.status(201).json({ ...appointmentDoc, _id: mongoId, ghlSyncError: 'No GHL API key' });
    }

    // 3. Build GHL payload (only allowed fields!)
    const ghlPayload: any = {
      calendarId,
      contactId,
      locationId,
      userId,                    // GHL user ID, not Mongo
      startTime: start,
      endTime: end,
      title: title || type,
      notes,
      status: "confirmed"        // Or omit if GHL doesn't want it
    };

    // Remove undefined/null fields
    Object.keys(ghlPayload).forEach(
      (k) => ghlPayload[k] === undefined && delete ghlPayload[k]
    );

    // 4. Sync to GHL (errors won’t break Mongo)
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

      // GHL returns event ID under different props depending on API version
      const ghlId = ghlRes.data.event?.id || ghlRes.data.id;
      await db.collection('appointments').updateOne(
        { _id: mongoId },
        { $set: { ghlAppointmentId: ghlId } }
      );
      return res.status(201).json({ ...appointmentDoc, _id: mongoId, ghlAppointmentId: ghlId });

    } catch (e: any) {
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
