// pages/api/ghl-sync/contact/[id].ts
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

    const mongoContact = await db.collection('contacts').findOne({ _id: new ObjectId(id) });

    if (!mongoContact) {
      return res.status(404).json({ error: 'Contact not found in MongoDB' });
    }

    // === FIX: get API key from locations collection
    const location = await db.collection('locations').findOne({ locationId: mongoContact.locationId });
    const apiKey = location?.apiKey;

    if (!apiKey) {
      return res.status(400).json({ error: 'Missing GHL API key for this location' });
    }

    if (!mongoContact.ghlContactId) {
      return res.status(400).json({ error: 'Contact is not linked to a GHL record' });
    }

    // === Use the correct LeadConnector endpoint and headers
    const ghlRes = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${mongoContact.ghlContactId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Version: '2021-07-28',
        },
      }
    );

    const ghlContact = ghlRes.data?.contact;
    if (!ghlContact) {
      return res.status(404).json({ error: 'GHL contact not found' });
    }

    const ghlUpdated = new Date(ghlContact.updatedAt || 0).getTime();
    const mongoUpdated = new Date(mongoContact.updatedAt || 0).getTime();

    // 🧠 Check for freshness and diff
    const fieldsChanged =
      ghlContact.firstName !== mongoContact.firstName ||
      ghlContact.lastName !== mongoContact.lastName ||
      ghlContact.email !== mongoContact.email ||
      ghlContact.phone !== mongoContact.phone;

    if (ghlUpdated > mongoUpdated && fieldsChanged) {
      const updated = {
        firstName: ghlContact.firstName,
        lastName: ghlContact.lastName,
        email: ghlContact.email,
        phone: ghlContact.phone,
        updatedAt: ghlContact.updatedAt || new Date().toISOString(),
      };

      await db.collection('contacts').updateOne(
        { _id: new ObjectId(id) },
        { $set: updated }
      );

      return res.status(200).json({ contact: { ...mongoContact, ...updated }, synced: true });
    }

    return res.status(200).json({ contact: mongoContact, synced: false });
  } catch (error: any) {
    console.error('❌ GHL Sync Failed:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to sync with GHL', detail: error.response?.data || error.message });
  }
}
