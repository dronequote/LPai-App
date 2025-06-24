// src/utils/webhooks/directProcessor.ts
// Updated Date 06/24/2025

import { Db, ObjectId } from 'mongodb';
import { EventEmitter } from 'events';

// Create a simple event emitter for real-time updates
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
          success: true
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
    { projection: { _id: 1, firstName: 1, lastName: 1, email: 1, phone: 1, fullName: 1, assignedTo: 1 } } // Added assignedTo
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
            contactObjectId: contact._id,              // FIXED: Use ObjectId directly
            ghlContactId: contactId,                    // ADD: Store GHL contact ID
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

      // Insert message
      const messageDoc: any = {
        _id: new ObjectId(),
        ghlMessageId: messageId,
        conversationId: conversation._id,              // Use ObjectId from conversation
        ghlConversationId: conversationId,
        locationId,
        contactObjectId: contact._id,                  // FIXED: Use ObjectId directly
        ghlContactId: contactId,                        // ADD: Store GHL contact ID
        type: messageTypeNum,
        messageType: `TYPE_${messageType.toUpperCase()}`,
        direction: 'inbound',
        body: body,                                     // Add body field
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
          contactObjectId: contact._id,                 // FIXED: Use contactObjectId
          locationId,
          status: { $in: ['open', 'quoted', 'won', 'in_progress'] }
        },
        { 
          projection: { _id: 1 },
          session 
        }
      );

      if (project) {
        await db.collection('messages').updateOne(
          { _id: messageDoc._id },
          { $set: { projectId: project._id.toString() } },
          { session }
        );
      }

      // Emit real-time event AFTER successful insert
      messageEvents.emit(`message:${locationId}:${contact._id}`, {
        type: 'new_message',
        message: messageDoc
      });

      // If contact is assigned to someone, emit user-specific event
      if (contact.assignedTo) {
        messageEvents.emit(`user:${contact.assignedTo}`, {
          type: 'new_message_assigned',
          locationId,
          contactId: contact._id,
          contactName: contact.fullName,
          message: messageDoc,
          timestamp: new Date().toISOString()
        });
        
        console.log(`[Direct Processor] Emitted assigned message event for user: ${contact.assignedTo}`);
      }

      // Also emit location-wide event for dashboards
      messageEvents.emit(`location:${locationId}`, {
        type: 'new_message',
        contactId: contact._id,
        contactName: contact.fullName,
        assignedTo: contact.assignedTo || null,
        message: messageDoc
      });
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
    { projection: { _id: 1, firstName: 1, lastName: 1, email: 1, phone: 1, fullName: 1 } }
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
        contactObjectId: contact._id,                  // FIXED: Add contactObjectId
        ghlContactId: contactId,                        // ADD: Store GHL contact ID
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
    conversationId: conversationResult.value._id,      // Use ObjectId from conversation
    ghlConversationId: conversationId,
    locationId,
    contactObjectId: contact._id,                      // FIXED: Use ObjectId directly
    ghlContactId: contactId,                            // ADD: Store GHL contact ID
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

  // Emit real-time event for outbound messages too
  messageEvents.emit(`message:${locationId}:${contact._id}`, {
    type: 'new_message',
    message: messageDoc
  });
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