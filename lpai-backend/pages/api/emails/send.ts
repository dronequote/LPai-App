// Create: lpai-backend/pages/api/email/send.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
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

  const { 
    contactId, 
    locationId,
    subject,
    htmlContent,
    plainTextContent,
    attachments = [],
    appointmentId,
    projectId,
    userId,
    replyToMessageId // For threading
  } = req.body;

  if (!contactId || !locationId || !subject || (!htmlContent && !plainTextContent)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const requestId = new ObjectId().toString();

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get location for API key
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.ghlOAuth?.accessToken) {
      return res.status(400).json({ error: 'No API key found for location' });
    }

    // Get contact
    const contact = await db.collection('contacts').findOne({ 
      _id: new ObjectId(contactId),
      locationId 
    });
    
    if (!contact?.ghlContactId) {
      return res.status(400).json({ error: 'Contact not found or missing GHL ID' });
    }

    // Send email via GHL Conversations API
    const ghlPayload = {
      type: 'Email',
      contactId: contact.ghlContactId,
      subject: subject,
      html: htmlContent,
      text: plainTextContent,
      attachments: attachments // Array of {url, filename}
    };

    logger.info('EMAIL_SEND_ATTEMPT', {
      requestId,
      locationId,
      contactId: contact._id.toString(),
      subject,
      hasAttachments: attachments.length > 0
    });

    const response = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${location.ghlOAuth.accessToken}`,
        'Version': '2021-04-15',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ghlPayload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error('EMAIL_SEND_GHL_ERROR', new Error(`GHL API error: ${response.status}`), {
        requestId,
        status: response.status,
        errorPreview: errorData.substring(0, 200)
      });
      throw new Error(`GHL API error: ${response.status}`);
    }

    const result = await response.json();
    const messageId = result.messageId || result.conversationId || result.id;

    // Find or create email conversation
    const conversationRecord = {
      locationId,
      contactId: new ObjectId(contactId),
      ghlContactId: contact.ghlContactId,
      type: 'email',
      lastMessageAt: new Date(),
      lastMessagePreview: subject,
      lastMessageDirection: 'outbound',
      unreadCount: 0,
      updatedAt: new Date()
    };

    const conversation = await db.collection('conversations').findOneAndUpdate(
      { 
        locationId,
        contactId: new ObjectId(contactId),
        type: 'email'
      },
      {
        $set: conversationRecord,
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

    // Add email to messages collection
    const messageRecord = {
      _id: new ObjectId(),
      conversationId: conversation.value._id,
      locationId,
      contactId: new ObjectId(contactId),
      direction: 'outbound',
      type: 'email',
      subject: subject,
      htmlContent: htmlContent,
      plainTextContent: plainTextContent,
      attachments: attachments,
      status: 'sent',
      ghlMessageId: messageId,
      sentBy: userId,
      sentAt: new Date(),
      read: true,
      replyToMessageId: replyToMessageId || null,
      metadata: {
        appointmentId: appointmentId || null,
        projectId: projectId || null,
        requestId
      }
    };

    await db.collection('messages').insertOne(messageRecord);

    logger.info('EMAIL_SEND_SUCCESS', {
      requestId,
      messageId,
      conversationId: conversation.value._id.toString()
    });

    return res.status(200).json({
      success: true,
      messageId,
      conversationId: conversation.value._id,
      message: 'Email sent successfully'
    });

  } catch (error: any) {
    logger.error('EMAIL_SEND_FAILED', error, {
      requestId,
      locationId,
      contactId
    });
    
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}