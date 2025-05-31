// Update: lpai-backend/pages/api/sms/send.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { processTemplate, UNIVERSAL_TEMPLATES } from './templates';

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
    templateKey,
    customMessage,
    fromNumber, // Optional override - defaults to user's phone
    toNumber,   // Optional override - defaults to contact's phone
    appointmentId, 
    projectId,
    userId,
    dynamicData
  } = req.body;

  if (!contactId || !locationId || (!templateKey && !customMessage)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const requestId = new ObjectId().toString();

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get location for API key
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.apiKey) {
      logger.error('SMS_SEND_NO_API_KEY', new Error('No API key found'), {
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
    
    if (!contact?.ghlContactId) {
      logger.error('SMS_SEND_NO_CONTACT', new Error('Contact not found'), {
        requestId,
        contactId,
        locationId
      });
      return res.status(400).json({ error: 'Contact not found or missing GHL ID' });
    }

    // Get user for phone number and name
    const user = userId ? await db.collection('users').findOne({ 
      _id: new ObjectId(userId) 
    }) : null;

    // Determine phone numbers
    const finalFromNumber = fromNumber || user?.phone || location?.phone || '';
    const finalToNumber = toNumber || contact?.phone || '';

    if (!finalToNumber) {
      logger.error('SMS_SEND_NO_PHONE', new Error('No recipient phone number'), {
        requestId,
        contactId,
        hasFromNumber: !!finalFromNumber
      });
      return res.status(400).json({ error: 'Contact has no phone number' });
    }

    // Build message
    let message = customMessage || '';
    
    if (templateKey && !customMessage) {
      // Get the template (with any customizations)
      const templatesResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/sms/templates?locationId=${locationId}&userId=${userId}`);
      const { templates } = await templatesResponse.json();
      
      const template = templates[templateKey];
      if (!template) {
        logger.error('SMS_SEND_NO_TEMPLATE', new Error('Template not found'), {
          requestId,
          templateKey,
          locationId
        });
        return res.status(400).json({ error: 'Template not found' });
      }

      // Get related data for template processing
      const appointment = appointmentId ? await db.collection('appointments').findOne({
        _id: new ObjectId(appointmentId)
      }) : null;

      const project = projectId ? await db.collection('projects').findOne({
        _id: new ObjectId(projectId)
      }) : null;

      // Process template with all available data
      message = processTemplate(template.message, {
        user,
        location,
        contact,
        appointment,
        project,
        dynamic: dynamicData || {}
      });
    }

    // Log the attempt
    logger.info('SMS_SEND_ATTEMPT', {
      requestId,
      locationId,
      contactId: contact._id.toString(),
      templateKey: templateKey || 'custom',
      fromNumber: finalFromNumber ? 'provided' : 'missing',
      toNumber: finalToNumber ? 'provided' : 'missing',
      messageLength: message.length
    });

    // Send SMS via GHL using exact format from docs
    const options = {
      method: 'POST',
      url: 'https://services.leadconnectorhq.com/conversations/messages',
      headers: {
        Authorization: `Bearer ${location.apiKey}`,
        Version: '2021-04-15',
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      data: {
        type: 'SMS',
        contactId: contact.ghlContactId,
        message: message,
        fromNumber: finalFromNumber,
        toNumber: finalToNumber
      }
    };

    const { data: ghlResponse } = await axios.request(options);
    const messageId = ghlResponse.messageId || ghlResponse.conversationId || ghlResponse.id;

    // Create/update conversation
    const conversationRecord = {
      locationId,
      contactId: new ObjectId(contactId),
      ghlContactId: contact.ghlContactId,
      type: 'sms',
      lastMessageAt: new Date(),
      lastMessagePreview: message.substring(0, 100),
      lastMessageDirection: 'outbound',
      unreadCount: 0,
      updatedAt: new Date()
    };

    const conversation = await db.collection('conversations').findOneAndUpdate(
      { 
        locationId,
        contactId: new ObjectId(contactId),
        type: 'sms'
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

    // Add message to messages collection
    const messageRecord = {
      _id: new ObjectId(),
      conversationId: conversation.value._id,
      locationId,
      contactId: new ObjectId(contactId),
      direction: 'outbound',
      type: 'sms',
      message: message,
      fromNumber: finalFromNumber,
      toNumber: finalToNumber,
      status: 'sent',
      ghlMessageId: messageId,
      templateKey: templateKey || null,
      sentBy: userId,
      sentAt: new Date(),
      read: true,
      metadata: {
        appointmentId: appointmentId || null,
        projectId: projectId || null,
        requestId
      }
    };

    await db.collection('messages').insertOne(messageRecord);

    // Log SMS in sms_logs collection
    const smsRecord = {
      _id: new ObjectId(),
      locationId,
      contactId,
      appointmentId: appointmentId ? new ObjectId(appointmentId) : null,
      projectId: projectId ? new ObjectId(projectId) : null,
      templateKey: templateKey || 'custom',
      message,
      fromNumber: finalFromNumber,
      toNumber: finalToNumber,
      ghlMessageId: messageId,
      status: 'sent',
      sentAt: new Date(),
      sentBy: userId,
      requestId
    };

    await db.collection('sms_logs').insertOne(smsRecord);

    // Update appointment if provided
    if (appointmentId) {
      await db.collection('appointments').updateOne(
        { _id: new ObjectId(appointmentId) },
        {
          $push: {
            communications: {
              type: 'sms',
              templateKey,
              message,
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
              event: 'sms_sent',
              description: `SMS sent: ${templateKey || 'custom message'}`,
              timestamp: new Date().toISOString(),
              userId,
              metadata: {
                smsRecordId: smsRecord._id.toString(),
                messageId: messageRecord._id.toString(),
                templateKey,
                to: finalToNumber
              }
            }
          }
        }
      );
    }

    // Log success
    logger.info('SMS_SEND_SUCCESS', {
      requestId,
      messageId,
      smsRecordId: smsRecord._id.toString(),
      conversationId: conversation.value._id.toString(),
      locationId,
      contactId: contact._id.toString(),
      templateKey: templateKey || 'custom'
    });

    return res.status(200).json({
      success: true,
      messageId,
      smsRecordId: smsRecord._id,
      conversationId: conversation.value._id,
      message: 'SMS sent successfully'
    });

  } catch (error: any) {
    // Log error with context
    logger.error('SMS_SEND_FAILED', error, {
      requestId,
      locationId,
      contactId,
      templateKey: templateKey || 'custom',
      ghlError: error.response?.data
    });
    
    // Log failed attempt to database
    try {
      const client = await clientPromise;
      const db = client.db('lpai');
      
      await db.collection('sms_logs').insertOne({
        locationId,
        contactId,
        appointmentId: appointmentId ? new ObjectId(appointmentId) : null,
        projectId: projectId ? new ObjectId(projectId) : null,
        templateKey: templateKey || 'custom',
        message: customMessage || 'Failed to generate message',
        status: 'failed',
        error: error.response?.data || error.message,
        attemptedAt: new Date(),
        attemptedBy: userId,
        requestId
      });
    } catch (logError) {
      logger.error('SMS_LOG_FAILED', logError, {
        requestId,
        originalError: error.message
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to send SMS',
      details: process.env.NODE_ENV === 'development' ? error.response?.data || error.message : 'Internal server error',
      requestId
    });
  }
}