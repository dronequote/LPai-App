import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return handleGetContacts(req, res, db);

    case 'POST':
      return handleCreateContact(req, res, db);

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetContacts(req: NextApiRequest, res: NextApiResponse, db: any) {
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

async function handleCreateContact(req: NextApiRequest, res: NextApiResponse, db: any) {
  const { firstName, lastName, email, phone, notes, locationId, address } = req.body;

  if (!firstName || !lastName || !email || !locationId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const now = new Date();
    const newContact = {
      firstName,
      lastName,
      email,
      phone,
      notes,
      address,
      locationId,
      createdAt: now,
      updatedAt: now,
    };

    // Insert contact into MongoDB first
    const insertResult = await db.collection('contacts').insertOne(newContact);
    const insertedId = insertResult.insertedId;

    // Fetch API key from locations collection
    const locationDoc = await db.collection('locations').findOne({ locationId });

    if (!locationDoc || !locationDoc.apiKey) {
      console.warn(`⚠️ API key missing for locationId: ${locationId}`);

      return res.status(201).json({
        success: true,
        contactId: insertedId,
        message: 'Contact saved locally. GHL sync skipped (no API key found).',
      });
    }

    const apiKey = locationDoc.apiKey;
    console.log(`🛠️ Using API key for GHL:`, apiKey); // REMOVE or mask in production!

    // Now sync contact to GHL
    const ghlRes = await axios.post(
      'https://rest.gohighlevel.com/v1/contacts/',
      {
        firstName,
        lastName,
        email,
        phone,
        address1: address,
        notes,
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
      // Update MongoDB with GHL contact ID
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
    console.error('❌ Failed to add contact or sync with GHL:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to add contact or sync with GHL' });
  }
}
