// pages/api/ghl/syncContacts.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { locationId } = req.body;
  if (!locationId)
    return res.status(400).json({ error: 'Missing locationId' });

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // === FIX: Get API key from LOCATIONS (not users) ===
    const locationDoc = await db.collection('locations').findOne({ locationId });
    const apiKey = locationDoc?.apiKey;
    console.log('🔑 Fetched API key from locations for locationId:', locationId);

    if (!apiKey) {
      console.warn('API key not found for location:', locationId);
      return res.status(401).json({ error: 'API key not found for location' });
    }

    // === Use the correct GHL endpoint and headers ===
    const ghlRes = await fetch(`https://services.leadconnectorhq.com/contacts/`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
    });

    if (!ghlRes.ok) {
      const error = await ghlRes.text();
      return res.status(500).json({ error: `GHL API failed: ${error}` });
    }

    const { contacts } = await ghlRes.json();

    // Map and upsert contacts
    const bulkOps = contacts.map((ghl: any) => ({
      updateOne: {
        filter: { ghlContactId: ghl.id },
        update: {
          $set: {
            ghlContactId: ghl.id,
            locationId,
            firstName: ghl.firstName || '',
            lastName: ghl.lastName || '',
            email: ghl.email || '',
            phone: ghl.phone || '',
            notes: ghl.notes || '',
            updatedAt: ghl.updatedAt ? new Date(ghl.updatedAt) : new Date(),
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length) {
      await db.collection('contacts').bulkWrite(bulkOps);
    }

    res.status(200).json({ success: true, count: bulkOps.length });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
