import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { syncCustomValues } from '../../../src/utils/sync/syncCustomValues';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { locationId } = req.body;

  if (!locationId) {
    return res.status(400).json({ error: 'Location ID is required' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    const location = await db.collection('locations').findOne({ locationId });
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const result = await syncCustomValues(db, location);
    
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[Sync Custom Values API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to sync custom values', 
      message: error.message 
    });
  }
}