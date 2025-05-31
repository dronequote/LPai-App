// Create new file: lpai-backend/pages/api/webhooks/ghl/sms-received.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

const logger = {
  info: (action: string, data: any) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      ...data
    }));
  },
  error: (action: string, error: any, context: any) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      error: error.message || error,
      ...context
    }));
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookId = new ObjectId().toString();

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Log raw webhook for debugging
    await db.collection('webhook_logs').insertOne({
      _id: new ObjectId(),
      type: 'ghl_sms_received',
      payload: req.body,
      headers: req.headers,
      receivedAt: new Date(),
      webhookId
    });

    // GHL webhook payload structure
    const {
      contactId: ghlContactId,
      locationId: ghlLocationId,
      message,
      conversationId: ghlConversationId,
      direction,
      type,
      dateAdded,
      contentType
    } = req.body;

    logger.info('SMS_WEBHOOK_RECEIVED', {
      webhookId,
      ghlContactId,
      ghlLocationId,
      direction,
      messagePreview: message?.substring(0, 50)
    });

    // Only process inbound SMS messages
    if (type !== 'SMS' || direction !== 'in') {
      logger.info('SMS_WEBHOOK_SKIPPED', {
        webhookId,
        type,
        direction,
        reason: 'Not inbound SMS'
      });
      return res.status(200).json({ success: true, action: 'skipped' });
    }

    // Find contact by GHL ID
    const contact = await db.collection('contacts').findOne({
      ghlContactId: ghlContactId
    });

    if (!contact) {
      logger.error('SMS_WEBHOOK_NO_CONTACT', new Error('Contact not found'), {
        webhookId,
        ghlContactId
      });
      return res.status(200).json({ success: true, action: 'contact_not_found' });
    }

    // Find location by GHL Location ID (if provided)
    let locationId = contact.locationId;
    if (ghlLocationId) {
      const location = await db.collection('locations').findOne({
        ghlLocationId: ghlLocationId
      });
      if (location) {
        locationId = location.locationId;
      }
    }

    // Find or create conversation
    const conversationRecord = {
      locationId,
      contactId: contact._id,
      ghlContactId: contact.ghlContactId,
      type: 'sms',
      lastMessageAt: new Date(dateAdded || Date.now()),
      lastMessagePreview: message.substring(0, 100),
      lastMessageDirection: 'inbound',
      unreadCount: 1, // Will increment if already exists
      updatedAt: new Date()
    };

    const conversation = await db.collection('conversations').findOneAndUpdate(
      { 
        locationId,
        contactId: contact._id,
        type: 'sms'
      },
      {
        $set: conversationRecord,
        $inc: { unreadCount: 1 },
        $setOnInsert: {
          createdAt: new Date(),
          _id: new ObjectId()
        }
      },
      { 
        upsert: true,
        returnDocument: 'after'
      }
    );

    // Add message to messages collection
    const messageRecord = {
      _id: new ObjectId(),
      conversationId: conversation.value._id,
      locationId,
      contactId: contact._id,
      direction: 'inbound',
      type: 'sms',
      message: message,
      status: 'received',
      ghlMessageId: ghlConversationId,
      ghlConversationId: ghlConversationId,
      receivedAt: new Date(dateAdded || Date.now()),
      read: false,
      metadata: {
        webhookId,
        contentType: contentType || 'text',
        raw: req.body
      }
    };

    await db.collection('messages').insertOne(messageRecord);

    // Check for active appointments or projects to link
    const activeAppointment = await db.collection('appointments').findOne({
      contactId: contact._id,
      locationId,
      start: { $gte: new Date() },
      status: { $ne: 'cancelled' }
    }, {
      sort: { start: 1 }
    });

    if (activeAppointment) {
      // Log communication on appointment
      await db.collection('appointments').updateOne(
        { _id: activeAppointment._id },
        {
          $push: {
            communications: {
              type: 'sms',
              direction: 'inbound',
              message: message,
              receivedAt: new Date(),
              messageId: messageRecord._id
            }
          },
          $set: {
            lastCommunication: new Date()
          }
        }
      );
    }

    // Send notification to assigned users (future implementation)
    // This is where you'd send push notifications to the app

    logger.info('SMS_WEBHOOK_PROCESSED', {
      webhookId,
      messageId: messageRecord._id.toString(),
      conversationId: conversation.value._id.toString(),
      contactId: contact._id.toString(),
      locationId
    });

    return res.status(200).json({ 
      success: true,
      action: 'processed',
      messageId: messageRecord._id
    });

  } catch (error: any) {
    logger.error('SMS_WEBHOOK_ERROR', error, {
      webhookId,
      body: req.body
    });

    // Still return 200 to prevent GHL from retrying
    return res.status(200).json({ 
      success: false,
      error: 'Internal error',
      webhookId
    });
  }
}