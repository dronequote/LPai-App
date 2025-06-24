// lpai-backend/pages/api/emails/send.ts
//Updated Date 06/24/2025

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
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
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
    replyToMessageId
  } = req.body;

  if (!contactId || !locationId || !subject) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const requestId = new ObjectId().toString();

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get location for API key
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.ghlOAuth?.accessToken) {
      logger.error('EMAIL_SEND_NO_API_KEY', new Error('No API key found'), {
        requestId,
        locationId
      });
      return res.status(400).json({ error: 'No API key found for location' });
    }

    // Get contact
    const contact = await db.collection('contacts').findOne({ 
      _id: new ObjectId(contactId),
      locationId 
    });

    if (!contact || !contact.ghlContactId) {
      logger.error('EMAIL_SEND_NO_CONTACT', new Error('Contact not found or missing GHL ID'), {
        requestId,
        contactId,
        locationId
      });
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

    // Find or create email conversation with contactObjectId
    const conversationRecord = {
      locationId,
      contactObjectId: new ObjectId(contactId),    // CHANGED: Use contactObjectId
      ghlContactId: contact.ghlContactId,          // ADD: Store GHL contact ID
      ghlConversationId: result.conversationId,    // Store GHL conversation ID
      type: 'TYPE_EMAIL',                           // Use TYPE_EMAIL for consistency
      lastMessageAt: new Date(),
      lastMessageDate: new Date(),                  // Add both fields
      lastMessagePreview: subject.substring(0, 100),
      lastMessageBody: plainTextContent?.substring(0, 200) || htmlContent?.substring(0, 200) || '',
      lastMessageDirection: 'outbound',
      lastMessageType: 'TYPE_EMAIL',
      unreadCount: 0,
      updatedAt: new Date(),
      // Contact info (denormalized for performance)
      contactName: contact.fullName || `${contact.firstName} ${contact.lastName}`,
      contactEmail: contact.email,
      contactPhone: contact.phone
    };

    const conversation = await db.collection('conversations').findOneAndUpdate(
      { 
        locationId,
        contactObjectId: new ObjectId(contactId),  // CHANGED: Use contactObjectId
        type: 'TYPE_EMAIL'                          // Use TYPE_EMAIL
      },
      {
        $set: conversationRecord,
        $setOnInsert: {
          createdAt: new Date(),
          dateAdded: new Date(),
          _id: new ObjectId(),
          inbox: true,
          starred: false,
          tags: [],
          followers: [],
          scoring: []
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
      conversationId: conversation.value._id,       // Already ObjectId from findOneAndUpdate
      ghlConversationId: result.conversationId,    // Store GHL conversation ID
      locationId,
      contactObjectId: new ObjectId(contactId),    // CHANGED: Use contactObjectId
      ghlContactId: contact.ghlContactId,          // ADD: Store GHL contact ID
      ghlMessageId: messageId,
      direction: 'outbound',
      type: 3,                                      // Numeric type for Email
      messageType: 'TYPE_EMAIL',                    // String type
      subject: subject,
      body: plainTextContent || '',                 // Store plain text in body
      htmlBody: htmlContent || '',                  // Store HTML separately
      attachments: attachments,
      status: 'sent',
      sentBy: userId,
      sentAt: new Date(),
      dateAdded: new Date(),
      read: true,
      source: 'app',
      replyToMessageId: replyToMessageId || null,
      metadata: {
        appointmentId: appointmentId || null,
        projectId: projectId || null,
        requestId
      }
    };

    await db.collection('messages').insertOne(messageRecord);

    // Update appointment if provided
    if (appointmentId) {
      await db.collection('appointments').updateOne(
        { _id: new ObjectId(appointmentId) },
        {
          $push: {
            communications: {
              type: 'email',
              subject,
              sentAt: new Date(),
              sentBy: userId,
              messageId: messageRecord._id
            }
          },
          $set: {
            lastCommunication: new Date()
          }
        }
      );
    }

    // Update project timeline if provided
    if (projectId) {
      await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        {
          $push: {
            timeline: {
              id: new ObjectId().toString(),
              event: 'email_sent',
              description: `Email sent: ${subject}`,
              timestamp: new Date().toISOString(),
              userId,
              metadata: {
                messageId: messageRecord._id.toString(),
                subject,
                to: contact.email
              }
            }
          }
        }
      );
    }

    logger.info('EMAIL_SEND_SUCCESS', {
      requestId,
      messageId,
      conversationId: conversation.value._id.toString(),
      locationId,
      contactId: contact._id.toString()
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
      contactId,
      ghlError: error.response?.data
    });
    
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      requestId
    });
  }
}