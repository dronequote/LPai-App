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

    // 2️⃣ Get the API key from the locations collection
    const location = await db.collection('locations').findOne({ locationId: mongoContact.locationId });
    const apiKey = location?.ghlOAuth?.accessToken;

    // 3️⃣ Log all fetched info for debug
    console.log('[GHL SYNC] ➡️ Mongo Contact:', mongoContact);
    console.log('[GHL SYNC] ➡️ Location:', location);
    console.log('[GHL SYNC] ➡️ Using API key:', apiKey ? apiKey.slice(0, 8) + '...' + apiKey.slice(-4) : 'MISSING');
    console.log('[GHL SYNC] ➡️ GHL Contact ID:', mongoContact.ghlContactId);

    if (!apiKey) {
      console.log('[GHL SYNC] ❌ No API key for location:', mongoContact.locationId);
      return res.status(400).json({ error: 'Missing GHL API key for this location' });
    }

    if (!mongoContact.ghlContactId) {
      console.log('[GHL SYNC] ❌ No GHL Contact ID for contact:', id);
      return res.status(400).json({ error: 'Contact is not linked to a GHL record' });
    }

    // 4️⃣ Fetch latest data from GHL
    const endpoint = `https://services.leadconnectorhq.com/contacts/${mongoContact.ghlContactId}`;
    console.log('[GHL SYNC] 🚀 Fetching from:', endpoint);

    let ghlRes;
    try {
      ghlRes = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Version: '2021-07-28',
        },
      });
    } catch (err: any) {
      console.error('[GHL SYNC] ❌ Axios Error:', err.response?.data || err.message);
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
      ghlContact.phone !== mongoContact.phone;

    console.log(`[GHL SYNC] ➡️ GHL updatedAt: ${ghlContact.dateUpdated}, Mongo updatedAt: ${mongoContact.updatedAt}`);
    console.log(`[GHL SYNC] ➡️ Fields changed:`, fieldsChanged);

    if (ghlUpdated > mongoUpdated && fieldsChanged) {
      const updated = {
        firstName: ghlContact.firstName,
        lastName: ghlContact.lastName,
        email: ghlContact.email,
        phone: ghlContact.phone,
        updatedAt: ghlContact.dateUpdated || ghlContact.dateAdded || new Date().toISOString(),
      };

      await db.collection('contacts').updateOne(
        { _id: new ObjectId(id) },
        { $set: updated }
      );

      console.log('[GHL SYNC] ✅ MongoDB contact updated from GHL.');
      return res.status(200).json({ contact: { ...mongoContact, ...updated }, synced: true });
    }

    console.log('[GHL SYNC] 🔄 No update needed, already in sync.');
    return res.status(200).json({ contact: mongoContact, synced: false });
  } catch (error: any) {
    console.error('[GHL SYNC] ❌ Unexpected error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to sync with GHL', detail: error.response?.data || error.message });
  }
}
