// pages/api/ghl/[id].ts
// Updated: 06/27/2025
// Fixed: Use OAuth tokens from ghlOAuth field for GHL sync

import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid contact ID' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // 1️⃣ Find the contact in MongoDB
    const mongoContact = await db.collection('contacts').findOne({ _id: new ObjectId(id) });
    if (!mongoContact) {
      console.log('[GHL SYNC] ❌ Contact not found in MongoDB for _id:', id);
      return res.status(404).json({ error: 'Contact not found in MongoDB' });
    }

    // 2️⃣ Get the OAuth access token from the locations collection
    const location = await db.collection('locations').findOne({ locationId: mongoContact.locationId });
    const accessToken = location?.ghlOAuth?.accessToken;

    // 3️⃣ Log all fetched info for debug
    if (__DEV__) {
      console.log('[GHL SYNC] ➡️ Location ID:', mongoContact.locationId);
      console.log('[GHL SYNC] ➡️ GHL Contact ID:', mongoContact.ghlContactId);
      console.log('[GHL SYNC] ➡️ Has OAuth token:', !!accessToken);
    }

    if (!accessToken) {
      console.log('[GHL SYNC] ❌ No OAuth token for location:', mongoContact.locationId);
      return res.status(400).json({ error: 'Missing OAuth token for this location' });
    }

    if (!mongoContact.ghlContactId) {
      console.log('[GHL SYNC] ❌ No GHL Contact ID for contact:', id);
      return res.status(400).json({ error: 'Contact is not linked to a GHL record' });
    }

    // 4️⃣ Fetch latest data from GHL
    const endpoint = `https://services.leadconnectorhq.com/contacts/${mongoContact.ghlContactId}`;
    
    if (__DEV__) {
      console.log('[GHL SYNC] 🚀 Fetching from GHL:', endpoint);
    }

    let ghlRes;
    try {
      ghlRes = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Version: '2021-07-28',
        },
      });
    } catch (err: any) {
      console.error('[GHL SYNC] ❌ GHL API Error:', err.response?.data || err.message);
      return res.status(err.response?.status || 500).json({
        error: 'Failed to fetch contact from GHL',
        detail: err.response?.data || err.message,
      });
    }

    const ghlContact = ghlRes.data?.contact;
    if (!ghlContact) {
      console.log('[GHL SYNC] ❌ GHL contact not found for ID:', mongoContact.ghlContactId);
      return res.status(404).json({ error: 'GHL contact not found' });
    }

    // 5️⃣ Compare fields (use dateUpdated)
    const ghlUpdated = new Date(ghlContact.dateUpdated || ghlContact.dateAdded || 0).getTime();
    const mongoUpdated = new Date(mongoContact.updatedAt || 0).getTime();

    const fieldsChanged =
      ghlContact.firstName !== mongoContact.firstName ||
      ghlContact.lastName !== mongoContact.lastName ||
      ghlContact.email !== mongoContact.email ||
      ghlContact.phone !== mongoContact.phone ||
      ghlContact.companyName !== mongoContact.companyName ||
      ghlContact.address1 !== mongoContact.address ||
      ghlContact.city !== mongoContact.city ||
      ghlContact.state !== mongoContact.state ||
      ghlContact.postalCode !== mongoContact.postalCode ||
      ghlContact.country !== mongoContact.country ||
      ghlContact.website !== mongoContact.website ||
      ghlContact.source !== mongoContact.source;

    if (__DEV__) {
      console.log(`[GHL SYNC] ➡️ GHL updated: ${new Date(ghlUpdated).toISOString()}`);
      console.log(`[GHL SYNC] ➡️ Mongo updated: ${new Date(mongoUpdated).toISOString()}`);
      console.log(`[GHL SYNC] ➡️ Fields changed:`, fieldsChanged);
    }

    if (ghlUpdated > mongoUpdated && fieldsChanged) {
      const updated = {
        firstName: ghlContact.firstName || '',
        lastName: ghlContact.lastName || '',
        email: ghlContact.email || '',
        phone: ghlContact.phone || '',
        companyName: ghlContact.companyName || '',
        address: ghlContact.address1 || '',
        city: ghlContact.city || '',
        state: ghlContact.state || '',
        postalCode: ghlContact.postalCode || '',
        country: ghlContact.country || '',
        website: ghlContact.website || '',
        source: ghlContact.source || '',
        tags: ghlContact.tags || [],
        updatedAt: new Date(ghlContact.dateUpdated || ghlContact.dateAdded || Date.now()),
      };

      await db.collection('contacts').updateOne(
        { _id: new ObjectId(id) },
        { $set: updated }
      );

      console.log('[GHL SYNC] ✅ MongoDB contact updated from GHL.');
      return res.status(200).json({ 
        contact: { ...mongoContact, ...updated }, 
        synced: true,
        message: 'Contact synced from GHL' 
      });
    }

    console.log('[GHL SYNC] 🔄 No update needed, already in sync.');
    return res.status(200).json({ 
      contact: mongoContact, 
      synced: false,
      message: 'Contact already up to date' 
    });
  } catch (error: any) {
    console.error('[GHL SYNC] ❌ Unexpected error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to sync with GHL', 
      detail: error.message 
    });
  }
}