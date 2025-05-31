// Update: lpai-backend/pages/api/conversations/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId, contactId, type, includeEmail = 'true' } = req.query;

  if (!locationId) {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      try {
        // Build filter based on what types to include
        const typeFilter = type 
          ? { type: type as string }
          : includeEmail === 'true' 
            ? { type: { $in: ['sms', 'email'] } }
            : { type: 'sms' };

        const filter: any = { locationId, ...typeFilter };
        if (contactId) filter.contactId = new ObjectId(contactId as string);

        // Get conversations with contact info
        const conversations = await db.collection('conversations').aggregate([
          { $match: filter },
          {
            $lookup: {
              from: 'contacts',
              localField: 'contactId',
              foreignField: '_id',
              as: 'contact'
            }
          },
          { $unwind: '$contact' },
          { $sort: { lastMessageAt: -1 } },
          { $limit: 50 }
        ]).toArray();

        return res.status(200).json(conversations);

      } catch (error) {
        console.error('Error fetching conversations:', error);
        return res.status(500).json({ error: 'Failed to fetch conversations' });
      }

    default:
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method not allowed' });
  }
}