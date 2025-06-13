// pages/api/locations/byLocation.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');
  const { locationId } = req.query;

  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    // 💡 Now fetching from locations, NOT users!
    const location = await db.collection('locations').findOne({ locationId });
    if (!location) return res.status(404).json({ error: 'Location not found' });
    if (!location.ghlOAuth.accessToken) return res.status(404).json({ error: 'API key not set for this location' });

    res.status(200).json({ apiKey: location.ghlOAuth.accessToken });
  } catch (err) {
    console.error('❌ Failed to fetch location by locationId:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
