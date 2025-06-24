// lpai-backend/pages/api/conversations/[conversationId]/messages.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { conversationId, locationId } = req.query;
  const { limit = '20', offset = '0' } = req.query;

  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ error: 'Missing conversationId' });
  }

  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Verify conversation exists and belongs to location
    const conversation = await db.collection('conversations').findOne({
      _id: new ObjectId(conversationId),
      locationId: locationId
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get messages for this conversation
    // FIXED: conversationId should be ObjectId, not string
    const messages = await db.collection('messages')
      .find({
        conversationId: new ObjectId(conversationId), // FIXED: Convert to ObjectId
        locationId: locationId
      })
      .sort({ dateAdded: -1 }) // Most recent first
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .toArray();

    // Get total count for pagination
    const totalCount = await db.collection('messages').countDocuments({
      conversationId: new ObjectId(conversationId), // FIXED: Convert to ObjectId
      locationId: locationId
    });

    // Format messages for response
    const formattedMessages = messages.map(msg => {
      const base = {
        id: msg._id.toString(),
        type: msg.type,
        messageType: msg.messageType,
        direction: msg.direction || 'inbound',
        dateAdded: msg.dateAdded,
        source: msg.source,
        read: msg.read || false
      };

      // Add type-specific fields
      switch (msg.type) {
        case 1: // SMS
          return {
            ...base,
            body: msg.body || msg.message || '', // Check both fields
            status: msg.status
          };
          
        case 3: // Email
          if (msg.needsContentFetch) {
            // Email content not fetched yet
            return {
              ...base,
              emailMessageId: msg.emailMessageId,
              needsContentFetch: true,
              preview: msg.lastMessageBody || 'Email content not loaded'
            };
          } else {
            // Email content already fetched
            return {
              ...base,
              emailMessageId: msg.emailMessageId,
              subject: msg.subject,
              body: msg.body,
              from: msg.from,
              to: msg.to,
              needsContentFetch: false
            };
          }
          
        case 25: // Activity - Contact
        case 26: // Activity - Invoice
          return {
            ...base,
            body: msg.body,
            activityType: msg.messageType
          };
          
        default:
          return {
            ...base,
            body: msg.body || msg.message || '', // Check both fields
            meta: msg.meta || {}
          };
      }
    });

    // Mark messages as read
    if (messages.length > 0) {
      const messageIds = messages.map(m => m._id);
      await db.collection('messages').updateMany(
        { _id: { $in: messageIds }, read: false },
        { $set: { read: true, readAt: new Date() } }
      );

      // Update conversation unread count
      await db.collection('conversations').updateOne(
        { _id: conversation._id },
        { $set: { unreadCount: 0 } }
      );
    }

    return res.status(200).json({
      success: true,
      conversationId: conversationId,
      messages: formattedMessages,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: (parseInt(offset as string) + messages.length) < totalCount
      }
    });

  } catch (error: any) {
    console.error('[Messages API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch messages',
      message: error.message 
    });
  }
}