// pages/api/locations/byLocation.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;

  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    // Fetch the location document by locationId
    const location = await db.collection('locations').findOne({ locationId });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Only send non-sensitive, app-relevant fields to frontend
    res.status(200).json({
      _id: location._id,
      locationId: location.locationId,
      name: location.name,
      branding: location.branding || null,
      pipelines: location.pipelines || [],
      calendars: location.calendars || [],
      // Add any additional public config here as needed
    });
  } catch (err) {
    console.error('❌ Failed to fetch location by locationId:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
