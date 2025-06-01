// pages/api/sync/users.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { syncUsers } from '../../../src/utils/sync/syncUsers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { locationId } = req.body;

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

    console.log(`[Sync Users API] Starting sync for ${locationId}`);
    const result = await syncUsers(db, location);

    return res.status(200).json({
      success: true,
      locationId,
      result
    });

  } catch (error: any) {
    console.error('[Sync Users API] Error:', error);
    return res.status(500).json({
      error: 'Failed to sync users',
      message: error.message
    });
  }
}