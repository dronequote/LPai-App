// Create: lpai-backend/pages/api/webhooks/ghl/email-received.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookId = new ObjectId().toString();

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Log raw webhook
    await db.collection('webhook_logs').insertOne({
      _id: new ObjectId(),
      type: 'ghl_email_received',
      payload: req.body,
      receivedAt: new Date(),
      webhookId
    });

    const {
      contactId: ghlContactId,
      locationId: ghlLocationId,
      subject,
      body,
      htmlBody,
      direction,
      type,
      dateAdded,
      attachments = []
    } = req.body;

    // Only process inbound emails
    if (type !== 'Email' || direction !== 'in') {
      return res.status(200).json({ success: true, action: 'skipped' });
    }

    // Find contact by GHL ID
    const contact = await db.collection('contacts').findOne({
      ghlContactId: ghlContactId
    });

    if (!contact) {
      return res.status(200).json({ success: true, action: 'contact_not_found' });
    }

    // Find or create email conversation
    const conversation = await db.collection('conversations').findOneAndUpdate(
      { 
        locationId: contact.locationId,
        contactId: contact._id,
        type: 'email'
      },
      {
        $set: {
          lastMessageAt: new Date(dateAdded || Date.now()),
          lastMessagePreview: subject || 'No subject',
          lastMessageDirection: 'inbound',
          updatedAt: new Date()
        },
        $inc: { unreadCount: 1 },
        $setOnInsert: {
          locationId: contact.locationId,
          contactId: contact._id,
          ghlContactId: contact.ghlContactId,
          type: 'email',
          createdAt: new Date(),
          _id: new ObjectId()
        }
      },
      { 
        upsert: true,
        returnDocument: 'after'
      }
    );

    // Add email message
    const messageRecord = {
      _id: new ObjectId(),
      conversationId: conversation.value._id,
      locationId: contact.locationId,
      contactId: contact._id,
      direction: 'inbound',
      type: 'email',
      subject: subject || 'No subject',
      htmlContent: htmlBody || body,
      plainTextContent: body,
      attachments: attachments,
      status: 'received',
      ghlMessageId: req.body.conversationId,
      receivedAt: new Date(dateAdded || Date.now()),
      read: false,
      metadata: {
        webhookId,
        raw: req.body
      }
    };

    await db.collection('messages').insertOne(messageRecord);

    return res.status(200).json({ 
      success: true,
      action: 'processed',
      messageId: messageRecord._id
    });

  } catch (error: any) {
    console.error('Email webhook error:', error);
    return res.status(200).json({ 
      success: false,
      error: 'Internal error'
    });
  }
}