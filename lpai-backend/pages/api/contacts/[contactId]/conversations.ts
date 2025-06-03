// pages/api/contacts/[contactId]/conversations.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contactId, locationId } = req.query;
  const { limit = '10', offset = '0', type } = req.query;

  if (!contactId || typeof contactId !== 'string') {
    return res.status(400).json({ error: 'Missing contactId' });
  }

  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Verify contact exists and belongs to location
    const contact = await db.collection('contacts').findOne({
      _id: new ObjectId(contactId),
      locationId: locationId
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Build query
    const query: any = {
      contactId: contactId,
      locationId: locationId
    };

    // Filter by type if specified (TYPE_EMAIL, TYPE_PHONE, etc)
    if (type) {
      query.type = type;
    }

    // Get conversations for this contact
    const conversations = await db.collection('conversations')
      .find(query)
      .sort({ lastMessageDate: -1 }) // Most recent first
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .toArray();

    // Get total count for pagination
    const totalCount = await db.collection('conversations').countDocuments(query);

    // Get unread message counts for each conversation
    const conversationIds = conversations.map(c => c._id.toString());
    const unreadCounts = await db.collection('messages').aggregate([
      {
        $match: {
          conversationId: { $in: conversationIds },
          read: false,
          direction: 'inbound'
        }
      },
      {
        $group: {
          _id: '$conversationId',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const unreadMap = Object.fromEntries(
      unreadCounts.map(item => [item._id, item.count])
    );

    // Format conversations for response
    const formattedConversations = conversations.map(conv => ({
      id: conv._id.toString(),
      type: conv.type,
      lastMessageDate: conv.lastMessageDate,
      lastMessageBody: conv.lastMessageBody, // Preview text
      lastMessageType: conv.lastMessageType,
      lastMessageDirection: conv.lastMessageDirection,
      unreadCount: unreadMap[conv._id.toString()] || 0,
      starred: conv.starred || false,
      tags: conv.tags || [],
      // Include project info if available
      projectId: conv.projectId,
      projectTitle: conv.projectTitle
    }));

    return res.status(200).json({
      success: true,
      contactId: contactId,
      contactName: contact.fullName || `${contact.firstName} ${contact.lastName}`,
      conversations: formattedConversations,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: (parseInt(offset as string) + conversations.length) < totalCount
      }
    });

  } catch (error: any) {
    console.error('[Contact Conversations API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch conversations',
      message: error.message 
    });
  }
}