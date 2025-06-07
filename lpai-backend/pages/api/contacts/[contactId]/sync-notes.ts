// New file: pages/api/contacts/[contactId]/sync-notes.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedDb } from '../../../../src/lib/mongodb';
import { syncContactNotes } from '../../../../src/utils/sync/syncContactNotes';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contactId } = req.query;
  const { locationId } = req.body;

  try {
    const { db } = await getAuthenticatedDb(req);
    
    // Get location for auth
    const location = await db.collection('locations').findOne({ locationId });
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Sync notes for this specific contact
    const result = await syncContactNotes(db, location, contactId as string);
    
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error syncing contact notes:', error);
    return res.status(500).json({ error: error.message });
  }
}