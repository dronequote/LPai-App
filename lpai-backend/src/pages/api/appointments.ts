import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    const data = await db.collection('appointments').find({}).toArray();
    res.status(200).json(data);
  } catch (error) {
    console.error('[API] Failed to fetch appointments:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
