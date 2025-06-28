// pages/api/ghl/syncContacts.ts
// Updated: 06/27/2025
// Fixed: Use OAuth tokens from ghlOAuth field instead of deprecated API keys

import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { locationId } = req.body;
  if (!locationId) return res.status(400).json({ error: 'Missing locationId' });

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get OAuth token from locations collection
    const locationDoc = await db.collection('locations').findOne({ locationId });
    if (!locationDoc || !locationDoc.ghlOAuth?.accessToken) {
      console.warn(`⚠️ OAuth token missing for locationId: ${locationId}`);
      return res.status(401).json({ error: 'OAuth token not found for location' });
    }

    const accessToken = locationDoc.ghlOAuth.accessToken;
    console.log(`🔎 Attempting GHL sync for locationId: ${locationId}`);
    console.log(`🔑 Using OAuth token: ${accessToken.slice(0, 20)}...`);

    // Set up headers with OAuth token
    const ghlHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28', // Use v2 API
    };
    
    if (__DEV__) {
      console.log('📡 SENDING TO GHL:');
      console.log('URL:', 'https://services.leadconnectorhq.com/contacts/');
      console.log('Headers:', { ...ghlHeaders, Authorization: 'Bearer [REDACTED]' });
    }

    // Fetch contacts from GHL (using v2 API)
    const ghlRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
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
            companyName: ghl.companyName || '',
            address: ghl.address1 || '',
            city: ghl.city || '',
            state: ghl.state || '',
            postalCode: ghl.postalCode || '',
            country: ghl.country || '',
            website: ghl.website || '',
            source: ghl.source || '',
            tags: ghl.tags || [],
            assignedUserId: ghl.assignedTo || '',
            dateAdded: ghl.dateAdded || new Date(),
            updatedAt: ghl.dateUpdated || ghl.dateAdded || new Date(),
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