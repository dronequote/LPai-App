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
    const user = await db.collection('users').findOne({ locationId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json({ apiKey: user.apiKey });
  } catch (err) {
    console.error('❌ Failed to fetch user by location:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
