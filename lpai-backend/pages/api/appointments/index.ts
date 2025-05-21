import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  if (req.method === 'GET') {
    const { locationId, userId, start, end } = req.query;
    if (!locationId) return res.status(400).json({ error: 'Missing locationId' });

    const filter: any = { locationId };
    if (userId) filter.userId = userId;
    if (start && end) filter.startTime = { $gte: new Date(start as string), $lte: new Date(end as string) };

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

  if (req.method === 'POST') {
    // Required fields for Mongo & GHL
    const {
      contactId, userId, locationId, start, end, title, calendarId,
      meetingLocationType = 'custom', meetingLocationId = 'default', address = '',
      notes = '', type = 'Consultation'
    } = req.body;
    if (!contactId || !userId || !locationId || !start || !end || !calendarId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Insert appointment in MongoDB first
    const appointmentDoc: any = {
      contactId, userId, locationId, start: new Date(start), end: new Date(end),
      title: title || type, calendarId, meetingLocationType, meetingLocationId, address, notes,
      createdAt: new Date()
    };
    const result = await db.collection('appointments').insertOne(appointmentDoc);
    const mongoId = result.insertedId;

    // 2. Fetch GHL API key from locations
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.apiKey) {
      return res.status(201).json({ ...appointmentDoc, _id: mongoId, ghlSyncError: 'No GHL API key' });
    }

    // 3. Construct payload for GHL
    const payload = {
      title: title || type,
      meetingLocationType,
      meetingLocationId,
      overrideLocationConfig: true,
      appointmentStatus: 'new',
      assignedUserId: userId,         // must be GHL userId
      address,
      calendarId,
      locationId,
      contactId,
      startTime: start,
      endTime: end,
      notes,
    };

    try {
      const ghlRes = await axios.post(
        `${GHL_BASE_URL}/calendars/events/appointments`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${location.apiKey}`,
            'Version': '2021-04-15',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        }
      );
      // 4. Update Mongo with ghlAppointmentId
      await db.collection('appointments').updateOne(
        { _id: mongoId },
        { $set: { ghlAppointmentId: ghlRes.data.event?.id || ghlRes.data.id } }
      );
      return res.status(201).json({ ...appointmentDoc, _id: mongoId, ghlAppointmentId: ghlRes.data.event?.id || ghlRes.data.id });
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
