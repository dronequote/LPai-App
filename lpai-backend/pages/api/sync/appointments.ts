// pages/api/sync/appointments.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { syncAppointments } from '../../../src/utils/sync/syncAppointments';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { locationId, startDate, endDate, fullSync = false } = req.body;

  if (!locationId) {
    return res.status(400).json({ error: 'locationId is required' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    const location = await db.collection('locations').findOne({ locationId });
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const options: any = { fullSync };
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    console.log(`[Sync Appointments API] Starting sync for ${locationId}`);
    const result = await syncAppointments(db, location, options);

    return res.status(200).json({
      success: true,
      locationId,
      result
    });

  } catch (error: any) {
    console.error('[Sync Appointments API] Error:', error);
    return res.status(500).json({
      error: 'Failed to sync appointments',
      message: error.message
    });
  }
}