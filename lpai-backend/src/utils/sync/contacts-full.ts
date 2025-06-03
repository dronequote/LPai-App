// pages/api/sync/contacts-full.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { syncContacts } from '../../../src/utils/sync/syncContacts';

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

    console.log(`[Sync Contacts Full API] Starting full sync for ${locationId}`);
    
    // Start the full sync
    const result = await syncContacts(db, location, { 
      fullSync: true,
      limit: 100 // Process 100 contacts at a time
    });

    return res.status(200).json({
      success: true,
      locationId,
      result,
      message: result.fullSyncCompleted 
        ? `Successfully synced all contacts: ${result.created} created, ${result.updated} updated`
        : `Synced batch: ${result.created} created, ${result.updated} updated`
    });

  } catch (error: any) {
    console.error('[Sync Contacts Full API] Error:', error);
    return res.status(500).json({
      error: 'Failed to sync contacts',
      message: error.message
    });
  }
}

// Increase timeout for full sync operations
export const config = {
  maxDuration: 300 // 5 minutes max
};