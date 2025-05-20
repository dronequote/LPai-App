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

  // GET: Fetch single contact
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

  // PATCH: Update contact in MongoDB, then optionally sync to GHL
  if (req.method === 'PATCH') {
    try {
      const { firstName, lastName, email, phone, notes } = req.body;

      const updateFields: any = {
        firstName,
        lastName,
        email,
        phone,
        notes,
        updatedAt: new Date(),
      };

      const result = await db.collection('contacts').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const updated = await db.collection('contacts').findOne({ _id: new ObjectId(id) });

      // ✅ Only sync to GHL if both fields exist
      if (!updated?.ghlContactId || !updated?.locationId) {
        console.log('ℹ️ Skipping GHL sync (no ghlContactId or locationId)');
        return res.status(200).json({ success: true });
      }

      const location = await db.collection('locations').findOne({ locationId: updated.locationId });
      const apiKey = location?.apiKey;

      if (!apiKey) {
        console.warn('⚠️ GHL sync skipped: missing API key for location:', updated.locationId);
        return res.status(200).json({ success: true });
      }

      // ✅ Sync to GHL
      await axios.put(
        `https://rest.gohighlevel.com/v1/contacts/${updated.ghlContactId}`,
        {
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
          phone: updated.phone,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Contact synced to GHL:', updated.ghlContactId);
      return res.status(200).json({ success: true });

    } catch (err) {
      console.error('❌ Failed to update or sync contact:', err);
      return res.status(500).json({ error: 'Failed to update contact' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
