import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  if (req.method === 'GET') {
    const locationId = req.query.locationId as string;

    if (!locationId) {
      return res.status(400).json({ error: 'Missing locationId' });
    }

    try {
      const contacts = await db
        .collection('contacts')
        .find({ locationId })
        .sort({ createdAt: -1 })
        .toArray();

      console.log('📦 contacts found:', contacts.length);
      return res.status(200).json(contacts);
    } catch (error) {
      console.error('❌ Failed to fetch contacts:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const { firstName, lastName, email, phone, notes, locationId } = req.body;

    if (!firstName || !lastName || !email || !locationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const now = new Date();
      const newContact: any = {
        firstName,
        lastName,
        email,
        phone,
        notes,
        locationId,
        createdAt: now,
        updatedAt: now,
      };

      const insertResult = await db.collection('contacts').insertOne(newContact);
      const insertedId = insertResult.insertedId;

      // 🔑 Step 1: Get GHL API key for this location
      const location = await db.collection('locations').findOne({ locationId });
      const apiKey = location?.apiKey;

      if (!apiKey) {
        console.warn('⚠️ No API key found for location:', locationId);
        return res.status(201).json({
          success: true,
          contactId: insertedId,
          message: 'Contact saved locally. GHL sync skipped (no API key).',
        });
      }

      // 🔁 Step 2: Sync to GHL
      const ghlRes = await axios.post(
        'https://rest.gohighlevel.com/v1/contacts/',
        {
          locationId,
          firstName,
          lastName,
          email,
          phone,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const ghlContactId = ghlRes.data.contact?.id;

      if (ghlContactId) {
        // 🔁 Step 3: Update MongoDB with GHL contact ID
        await db.collection('contacts').updateOne(
          { _id: insertedId },
          { $set: { ghlContactId } }
        );

        console.log('✅ Contact synced to GHL with ID:', ghlContactId);
      } else {
        console.warn('⚠️ GHL did not return contact ID.');
      }

      return res.status(201).json({
        success: true,
        contactId: insertedId,
        ghlContactId,
      });

    } catch (error: any) {
      console.error('❌ Failed to add contact or sync with GHL:', error.response?.data || error);
      return res.status(500).json({ error: 'Failed to add contact or sync with GHL' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
