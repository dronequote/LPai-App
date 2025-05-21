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

    // Get API key from locations collection (NOT users!)
    const locationDoc = await db.collection('locations').findOne({ locationId });
    if (!locationDoc || !locationDoc.apiKey) {
      console.warn(`⚠️ API key missing for locationId: ${locationId}`);
      return res.status(401).json({ error: 'API key not found for location' });
    }

    const apiKey = locationDoc.apiKey;
    console.log(`🔎 Attempting GHL sync for locationId: ${locationId}`);
    console.log(`🔑 Using API key: ${apiKey?.slice(0, 8)}...${apiKey?.slice(-4)}`);

    // --- DEBUGGING HEADERS ---
    const ghlHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    console.log('📡 SENDING TO GHL:');
    console.log('URL:', 'https://rest.gohighlevel.com/v1/contacts/');
    console.log('HEADERS:', { ...ghlHeaders, Authorization: `${apiKey?.slice(0, 8)}...${apiKey?.slice(-4)}` });

    // Fetch contacts from GHL
    const ghlRes = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      headers: ghlHeaders,
    });

    if (!ghlRes.ok) {
      const error = await ghlRes.text();
      console.error('❌ GHL API failed:', error);
      return res.status(500).json({ error: `GHL API failed: ${error}` });
    }

    const { contacts } = await ghlRes.json();
    console.log(`📦 Pulled ${contacts?.length || 0} contacts from GHL`);

    // Map and upsert contacts
    const bulkOps = (contacts || []).map((ghl: any) => ({
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
      console.log(`✅ Bulk upserted ${bulkOps.length} contacts`);
    } else {
      console.log('⚠️ No contacts to upsert');
    }

    res.status(200).json({ success: true, count: bulkOps.length });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
