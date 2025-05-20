import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid contact ID' });
  }

  // GET: Fetch a single contact
  if (req.method === 'GET') {
    try {
      const contact = await db.collection('contacts').findOne({ _id: new ObjectId(id) });
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      return res.status(200).json(contact);
    } catch (err) {
      console.error('❌ Failed to fetch contact:', err);
      return res.status(500).json({ error: 'Failed to fetch contact' });
    }
  }

  // PATCH: Update contact + sync to GHL if valid
  if (req.method === 'PATCH') {
    try {
      const { firstName, lastName, email, phone, notes, address } = req.body;

      // 1. Update locally in MongoDB
      const result = await db.collection('contacts').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            firstName,
            lastName,
            email,
            phone,
            notes,
            address,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const updated = await db.collection('contacts').findOne({ _id: new ObjectId(id) });

      if (!updated?.ghlContactId || !updated?.locationId) {
        console.log('ℹ️ Skipping GHL sync: missing ghlContactId or locationId');
        return res.status(200).json({ success: true });
      }

      // 2. Fetch API key for this location
      const locationDoc = await db.collection('locations').findOne({ locationId: updated.locationId });
      const apiKey = locationDoc?.apiKey;

      if (!apiKey) {
        console.warn('⚠️ GHL sync skipped: missing API key for location', updated.locationId);
        return res.status(200).json({ success: true });
      }

      // === LOGGING LOCATION AND PARTIAL API KEY HERE ===
      console.log(`🔎 Attempting GHL sync for locationId: ${updated.locationId}`);
      console.log(`🔑 Using API key: ${apiKey?.slice(0, 8)}...${apiKey?.slice(-4)}`);

      // 3. Push changes to GHL (LeadConnector) API
      try {
        await axios.put(
          `https://services.leadconnectorhq.com/contacts/${updated.ghlContactId}`,
          {
            firstName: updated.firstName,
            lastName: updated.lastName,
            email: updated.email,
            phone: updated.phone,
            address1: updated.address,
            locationId: updated.locationId,  // <--- THIS IS THE FIX!
            // notes: updated.notes,         // (uncomment if using a mapped field for notes)
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              Version: '2021-07-28',
            },
          }
        );
        console.log('✅ Contact synced to GHL:', updated.ghlContactId);
      } catch (ghlError: any) {
        console.error('❌ Failed to sync contact with GHL:', ghlError.response?.data, ghlError.response?.status, ghlError.response?.headers);
        // Still return 200 because local update succeeded
        return res.status(200).json({
          success: false,
          error: ghlError.response?.data || ghlError.message,
          message: 'Contact updated locally, but sync to GHL failed.',
        });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('❌ Failed to update or sync contact:', err);
      return res.status(500).json({ error: 'Failed to update contact' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
