// pages/api/ghl/syncContacts.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { locationId } = req.body;
  if (!locationId) return res.status(400).json({ error: 'Missing locationId' });

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get API key from MongoDB
    const user = await db.collection('users').findOne({ locationId });
    const apiKey = user?.apiKey;
    if (!apiKey) return res.status(401).json({ error: 'API key not found for user' });

    // Fetch contacts from GHL
    const ghlRes = await fetch(`https://rest.gohighlevel.com/v1/contacts/`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
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
