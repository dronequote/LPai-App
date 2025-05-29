import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';

// Helper function to format phone to E.164
function formatPhoneToE164(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // If already has country code (11+ digits starting with 1)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return '+' + cleaned;
  }
  
  // If 10 digits, assume US
  if (cleaned.length === 10) {
    return '+1' + cleaned;
  }
  
  // If already formatted with +
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Default to adding +1
  return '+1' + cleaned;
}

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
    
    // Format phone number to E.164
    const formattedPhone = formatPhoneToE164(phone);
    
    const newContact = {
      firstName,
      lastName,
      email,
      phone: formattedPhone, // Use formatted phone
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
    console.log(`🔎 Attempting GHL sync for locationId: ${locationId}`);
    console.log(`🔑 Using API key: ${apiKey?.slice(0, 8)}...${apiKey?.slice(-4)}`);

    // === DEBUG LOGGING FULL OUTGOING REQUEST ===
    const ghlPayload = {
      firstName,
      lastName,
      email,
      phone: formattedPhone, // Use formatted phone for GHL
      address1: address,
      locationId,
      // notes, // Uncomment if using mapped custom field for notes
    };
    const ghlHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      // 'Accept': 'application/json', // Uncomment if you want
    };
    console.log('🚀 SENDING TO GHL:');
    console.log('URL:', 'https://services.leadconnectorhq.com/contacts/');
    console.log('BODY:', JSON.stringify(ghlPayload, null, 2));
    console.log('HEADERS:', { ...ghlHeaders, Authorization: `${apiKey?.slice(0, 8)}...${apiKey?.slice(-4)}` });

    let ghlContactId: string | undefined = undefined;
    try {
      const ghlRes = await axios.post(
        'https://services.leadconnectorhq.com/contacts/',
        ghlPayload,
        { headers: ghlHeaders }
      );

      ghlContactId = ghlRes.data.contact?.id;
      if (ghlContactId) {
        // Update MongoDB with GHL contact ID
        await db.collection('contacts').updateOne(
          { _id: insertedId },
          { $set: { ghlContactId } }
        );
        console.log('✅ Contact synced to GHL with ID:', ghlContactId);
      } else {
        console.warn('⚠️ GHL did not return contact ID.', ghlRes.data);
      }
    } catch (ghlError: any) {
      // More robust logging for GHL failures
      console.error('❌ Failed to add contact or sync with GHL:', ghlError.response?.data, ghlError.response?.status, ghlError.response?.headers);
      // Still return local contact
      return res.status(201).json({
        success: false,
        contactId: insertedId,
        error: ghlError.response?.data || ghlError.message,
        message: 'Contact saved locally, but sync to GHL failed.',
      });
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