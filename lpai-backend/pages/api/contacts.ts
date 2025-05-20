import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../src/lib/mongodb';

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
      res.status(200).json(contacts);
    } catch (error) {
      console.error('❌ Failed to fetch contacts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }

  } else if (req.method === 'POST') {
    const { firstName, lastName, email, phone, notes, locationId } = req.body;

    if (!firstName || !lastName || !email || !locationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const newContact = {
        firstName,
        lastName,
        email,
        phone,
        notes,
        locationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('contacts').insertOne(newContact);
      console.log('✅ Contact added with ID:', result.insertedId);

      res.status(201).json({ success: true, contactId: result.insertedId });
    } catch (error) {
      console.error('❌ Failed to insert contact:', error);
      res.status(500).json({ error: 'Failed to add contact' });
    }

  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
