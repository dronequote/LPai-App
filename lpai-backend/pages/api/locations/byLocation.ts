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
    // Remove sensitive fields if you wish, or return all fields
    res.status(200).json(location);
  } catch (err) {
    console.error('❌ Failed to fetch location by locationId:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
