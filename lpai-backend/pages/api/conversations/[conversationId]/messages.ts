// Create new file: lpai-backend/pages/api/conversations/[conversationId]/messages.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { conversationId } = req.query;
  const { locationId } = req.query;

  if (!conversationId || !locationId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      try {
        // Verify conversation belongs to location
        const conversation = await db.collection('conversations').findOne({
          _id: new ObjectId(conversationId as string),
          locationId: locationId as string
        });

        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        // Get messages
        const messages = await db.collection('messages')
          .find({ conversationId: conversation._id })
          .sort({ sentAt: 1, receivedAt: 1 })
          .toArray();

        // Mark inbound messages as read
        await db.collection('messages').updateMany(
          {
            conversationId: conversation._id,
            direction: 'inbound',
            read: false
          },
          { $set: { read: true, readAt: new Date() } }
        );

        // Reset unread count
        await db.collection('conversations').updateOne(
          { _id: conversation._id },
          { $set: { unreadCount: 0 } }
        );

        return res.status(200).json({
          conversation,
          messages
        });

      } catch (error) {
        console.error('Error fetching messages:', error);
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }

    default:
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method not allowed' });
  }
}