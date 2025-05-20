import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid contact ID' });
  }

  if (req.method === 'GET') {
    try {
      const contact = await db.collection('contacts').findOne({ _id: new ObjectId(id) });
      if (!contact) return res.status(404).json({ error: 'Contact not found' });

      return res.status(200).json(contact);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch contact' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { firstName, lastName, email, phone, notes } = req.body;

      const result = await db.collection('contacts').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            firstName,
            lastName,
            email,
            phone,
            notes,
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to update contact' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
