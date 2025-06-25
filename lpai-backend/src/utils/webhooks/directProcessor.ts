// src/utils/webhooks/directProcessor.ts
// Updated Date 06/24/2025
// UPDATED: Replaced EventEmitter with Ably for distributed real-time messaging

import { Db, ObjectId } from 'mongodb';
import Ably from 'ably';

// Initialize Ably
const ably = new Ably.Rest(process.env.ABLY_API_KEY);

// Keep EventEmitter for backward compatibility but emit to Ably
import { EventEmitter } from 'events';

class MessageEventEmitter extends EventEmitter {
  private static instance: MessageEventEmitter;
  
  private constructor() {
    super();
    this.setMaxListeners(1000); // Support many SSE connections
  }
  
  static getInstance(): MessageEventEmitter {
    if (!MessageEventEmitter.instance) {
      MessageEventEmitter.instance = new MessageEventEmitter();
    }
    return MessageEventEmitter.instance;
  }
}

export const messageEvents = MessageEventEmitter.getInstance();

/**
 * Process messages directly without queue for ultra-low latency
 */
export async function processMessageDirect(
  db: Db, 
  webhookId: string, 
  payload: any
): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Start metrics tracking
    await db.collection('webhook_metrics').insertOne({
      _id: new ObjectId(),
      webhookId,
      type: payload.type,
      queueType: 'direct',
      locationId: payload.locationId,
      
      timestamps: {
        webhookReceived: new Date(payload.timestamp || Date.now()),
        processingStarted: new Date()
      },
      
      metrics: {
        queueLatency: 0 // No queue!
      },
      
      processingType: 'direct',
      createdAt: new Date()
    });

    // Route based on message type
    switch (payload.type) {
      case 'InboundMessage':
        await processInboundMessageDirect(db, payload, webhookId);
        break;
        
      case 'OutboundMessage':
        await processOutboundMessageDirect(db, payload, webhookId);
        break;
        
      case 'PaymentReceived':
        await processPaymentDirect(db, payload, webhookId);
        break;
        
      default:
        console.warn(`[Direct Processor] Unsupported type for direct processing: ${payload.type}`);
        throw new Error('UNSUPPORTED_DIRECT_TYPE');
    }

    // Update metrics with success
    const processingTime = Date.now() - startTime;
    await db.collection('webhook_metrics').updateOne(
      { webhookId },
      {
        $set: {
          'timestamps.processingCompleted': new Date(),
          'metrics.processingTime': processingTime,
          'metrics.totalLatency': processingTime,
          'performance.grade': processingTime < 500 ? 'A+' : processingTime < 1000 ? 'A' : 'B',
          success: true,
          processedBy: 'direct'  // ADD THIS to mark as processed
        }
      }
    );

    console.log(`[Direct Processor] Completed ${payload.type} in ${processingTime}ms`);

  } catch (error: any) {
    console.error(`[Direct Processor] Error processing ${payload.type}:`, error);
    
    // Update metrics with failure
    await db.collection('webhook_metrics').updateOne(
      { webhookId },
      {
        $set: {
          'timestamps.processingCompleted': new Date(),
          'metrics.processingTime': Date.now() - startTime,
          success: false,
          error: error.message
        }
      }
    );

    // Don't throw - let queue processor handle it as backup
  }
}

/**
 * Process inbound message (SMS/Email) directly
 */
async function processInboundMessageDirect(
  db: Db, 
  payload: any, 
  webhookId: string
): Promise<void> {
  // Extract fields from the actual webhook structure
  const { 
    locationId, 
    contactId, 
    conversationId, 
    body,
    messageType,
    messageId,
    direction,
    status,
    dateAdded,
    attachments
  } = payload;
  
  // Validate required fields
  if (!locationId || !contactId || !body) {
    throw new Error('Missing required fields for inbound message');
  }

  // Find contact - use indexed query
  const contact = await db.collection('contacts').findOne(
    { ghlContactId: contactId, locationId },
    { projection: { _id: 1, firstName: 1, lastName: 1, email: 1, phone: 1, fullName: 1, assignedTo: 1 } }
  );
  
  if (!contact) {
    console.warn(`[Direct Processor] Contact not found: ${contactId}`);
    // Don't fail - queue processor will handle contact creation
    return;
  }

  // Determine conversation type and message type number
  const messageTypeNum = messageType === 'SMS' ? 1 : 
                        messageType === 'Email' ? 3 : 
                        messageType === 'WhatsApp' ? 4 : 1;
  
  const conversationType = messageTypeNum === 1 ? 'TYPE_PHONE' : 
                          messageTypeNum === 3 ? 'TYPE_EMAIL' : 
                          messageTypeNum === 4 ? 'TYPE_WHATSAPP' : 'TYPE_OTHER';

  // Variables we'll need for Ably
  let conversationObjectId: ObjectId;
  let messageDoc: any;
  let updatedConversation: any;

  // Start a session for atomic operations
  const client = (db as any).client || db;
  const session = client.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Update or create conversation
      const conversationResult = await db.collection('conversations').findOneAndUpdate(
        { 
          ghlConversationId: conversationId,
          locationId 
        },
        {
          $set: {
            ghlConversationId: conversationId,
            locationId,
            contactObjectId: contact._id,
            ghlContactId: contactId,
            type: conversationType,
            lastMessageDate: new Date(),
            lastMessageBody: body.substring(0, 200),
            lastMessageType: `TYPE_${messageType.toUpperCase()}`,
            lastMessageDirection: 'inbound',
            contactName: contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            contactEmail: contact.email,
            contactPhone: contact.phone,
            updatedAt: new Date()
          },
          $inc: { unreadCount: 1 },
          $setOnInsert: {
            _id: new ObjectId(),
            createdAt: new Date(),
            inbox: true,
            starred: false,
            tags: [],
            followers: [],
            scoring: []
          }
        },
        { 
          upsert: true,
          returnDocument: 'after',
          session 
        }
      );

      const conversation = conversationResult.value || conversationResult;
      if (!conversation || !conversation._id) {
        throw new Error('Failed to create/update conversation');
      }

      conversationObjectId = conversation._id;
      updatedConversation = conversation;

      // Insert message
      messageDoc = {
        _id: new ObjectId(),
        ghlMessageId: messageId,
        conversationId: conversationObjectId,
        ghlConversationId: conversationId,
        locationId,
        contactObjectId: contact._id,
        ghlContactId: contactId,
        type: messageTypeNum,
        messageType: `TYPE_${messageType.toUpperCase()}`,
        direction: 'inbound',
        body: body,
        status: status || 'delivered',
        dateAdded: new Date(dateAdded || Date.now()),
        source: 'webhook',
        read: false,
        createdAt: new Date(),
        processedBy: 'direct',
        webhookId,
        attachments: attachments || []
      };

      await db.collection('messages').insertOne(messageDoc, { session });

      // Check for active project
      const project = await db.collection('projects').findOne(
        {
          contactObjectId: contact._id,
          locationId,
          status: { $in: ['open', 'quoted', 'won', 'in_progress'] }
        },
        { 
          projection: { _id: 1 },
          session 
        }
      );

      if (project) {
        messageDoc.projectId = project._id.toString();
        await db.collection('messages').updateOne(
          { _id: messageDoc._id },
          { $set: { projectId: project._id.toString() } },
          { session }
        );
      }
    });

    // EMIT TO ABLY - Outside transaction
    if (contact.assignedTo) {
      try {
        const channel = ably.channels.get(`user:${contact.assignedTo}`);
        await channel.publish('new-message', {
          message: messageDoc,
          contact: {
            id: contact._id,
            name: contact.fullName,
            phone: contact.phone
          },
          conversation: {
            id: conversationObjectId,
            contactObjectId: contact._id,
            unreadCount: updatedConversation.unreadCount || 0
          }
        });
        console.log('[Ably Direct] Published inbound message to user:', contact.assignedTo);
      } catch (error) {
        console.error('[Ably Direct] Failed to publish message:', error);
      }
    }

    // Also emit location-wide event for dashboards
    try {
      const locationChannel = ably.channels.get(`location:${locationId}`);
      await locationChannel.publish('new-message', {
        type: 'inbound',
        contactName: contact.fullName,
        contactId: contact._id.toString(),
        assignedTo: contact.assignedTo || null,
        preview: body.substring(0, 50),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Ably Direct] Failed to publish location event:', error);
    }

    // Keep local EventEmitter for backward compatibility
    const contactIdString = contact._id.toString();
    messageEvents.emit(`message:${locationId}:${contactIdString}`, {
      type: 'new_message',
      message: messageDoc,
      contactId: contactIdString,
      contactName: contact.fullName
    });

    console.log(`[Direct Processor] Successfully processed inbound ${messageType} message`);
    
  } finally {
    await session.endSession();
  }
}

/**
 * Process outbound message directly
 */
async function processOutboundMessageDirect(
  db: Db, 
  payload: any, 
  webhookId: string
): Promise<void> {
  // Extract fields from the actual webhook structure
  const { 
    locationId, 
    contactId, 
    conversationId, 
    body,
    messageType,
    messageId,
    direction,
    status,
    dateAdded,
    userId
  } = payload;
  
  // Similar to inbound but simpler
  const contact = await db.collection('contacts').findOne(
    { ghlContactId: contactId, locationId },
    { projection: { _id: 1, firstName: 1, lastName: 1, email: 1, phone: 1, fullName: 1, assignedTo: 1 } }
  );
  
  if (!contact) return;

  // Determine message type number
  const messageTypeNum = messageType === 'SMS' ? 1 : 
                        messageType === 'Email' ? 3 : 
                        messageType === 'WhatsApp' ? 4 : 1;

  // Update conversation (no unread increment for outbound)
  const conversationResult = await db.collection('conversations').findOneAndUpdate(
    { 
      ghlConversationId: conversationId,
      locationId 
    },
    {
      $set: {
        contactObjectId: contact._id,
        ghlContactId: contactId,
        lastMessageDate: new Date(),
        lastMessageBody: body.substring(0, 200),
        lastMessageDirection: 'outbound',
        lastMessageType: `TYPE_${messageType.toUpperCase()}`,
        updatedAt: new Date()
      }
    },
    {
      returnDocument: 'after'
    }
  );

  if (!conversationResult.value) {
    console.warn(`[Direct Processor] Conversation not found for outbound message: ${conversationId}`);
    return;
  }

  // Quick insert message with ObjectId conversationId
  const messageDoc = {
    _id: new ObjectId(),
    ghlMessageId: messageId || new ObjectId().toString(),
    conversationId: conversationResult.value._id,
    ghlConversationId: conversationId,
    locationId,
    contactObjectId: contact._id,
    ghlContactId: contactId,
    userId: userId || null,
    type: messageTypeNum,
    messageType: `TYPE_${messageType.toUpperCase()}`,
    direction: 'outbound',
    body: body,
    status: status || 'sent',
    dateAdded: new Date(dateAdded || Date.now()),
    source: 'webhook',
    read: true,
    createdAt: new Date(),
    processedBy: 'direct',
    webhookId
  };

  await db.collection('messages').insertOne(messageDoc);

  // EMIT TO ABLY for outbound messages
  if (contact.assignedTo || userId) {
    try {
      const channel = ably.channels.get(`user:${contact.assignedTo || userId}`);
      await channel.publish('new-message', {
        message: messageDoc,
        contact: {
          id: contact._id,
          name: contact.fullName,
          phone: contact.phone
        },
        conversation: {
          id: conversationResult.value._id,
          contactObjectId: contact._id,
          unreadCount: conversationResult.value.unreadCount || 0
        }
      });
      console.log('[Ably Direct] Published outbound message to user:', contact.assignedTo || userId);
    } catch (error) {
      console.error('[Ably Direct] Failed to publish outbound message:', error);
    }
  }

  // Keep local EventEmitter for backward compatibility
  const contactIdString = contact._id.toString();
  messageEvents.emit(`message:${locationId}:${contactIdString}`, {
    type: 'new_message',
    message: messageDoc,
    contactId: contactIdString,
    contactName: contact.fullName
  });
  
  console.log(`[Direct Processor] Emitted outbound event for contact: ${contactIdString}`);
}

/**
 * Process payment received directly
 */
async function processPaymentDirect(
  db: Db, 
  payload: any, 
  webhookId: string
): Promise<void> {
  // Quick payment recording for instant confirmation
  const { locationId, contactId, invoiceId, amount } = payload;
  
  await db.collection('payments').insertOne({
    _id: new ObjectId(),
    webhookId,
    locationId,
    contactId,
    invoiceId,
    amount: parseFloat(amount) || 0,
    status: 'completed',
    processedAt: new Date(),
    processedBy: 'direct'
  });

  // Update invoice status
  if (invoiceId) {
    await db.collection('invoices').updateOne(
      { ghlInvoiceId: invoiceId, locationId },
      { 
        $set: { 
          status: 'paid',
          paidAt: new Date()
        } 
      }
    );
  }

  // EMIT PAYMENT EVENT TO ABLY
  try {
    // Find the user who should be notified (invoice owner or location admin)
    const invoice = await db.collection('invoices').findOne(
      { ghlInvoiceId: invoiceId, locationId },
      { projection: { assignedTo: 1, contactName: 1, number: 1 } }
    );

    if (invoice && invoice.assignedTo) {
      const channel = ably.channels.get(`user:${invoice.assignedTo}`);
      await channel.publish('payment-received', {
        amount: amount / 100, // Convert from cents
        customerName: invoice.contactName || 'Customer',
        invoiceNumber: invoice.number || invoiceId,
        paymentMethod: 'Card',
        timestamp: new Date().toISOString()
      });
      console.log('[Ably Direct] Published payment notification to user:', invoice.assignedTo);
    }

    // Also emit to location channel for dashboards
    const locationChannel = ably.channels.get(`location:${locationId}`);
    await locationChannel.publish('payment-received', {
      amount: amount / 100,
      invoiceId,
      contactId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Ably Direct] Failed to publish payment event:', error);
  }
}

/**
 * Helper function to get message type name
 */
function getMessageTypeName(type: number): string {
  const typeMap: Record<number, string> = {
    1: 'TYPE_SMS',
    3: 'TYPE_EMAIL',
    4: 'TYPE_WHATSAPP',
    5: 'TYPE_GMB',
    6: 'TYPE_FB',
    7: 'TYPE_IG',
    24: 'TYPE_LIVE_CHAT',
    25: 'ACTIVITY_CONTACT',
    26: 'ACTIVITY_INVOICE',
    27: 'ACTIVITY_OPPORTUNITY',
    28: 'ACTIVITY_APPOINTMENT'
  };
  
  return typeMap[type] || 'TYPE_OTHER';
}