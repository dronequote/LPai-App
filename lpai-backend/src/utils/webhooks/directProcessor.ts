// src/utils/webhooks/directProcessor.ts
// Updated Date 06/24/2025

import { Db, ObjectId } from 'mongodb';

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
  const { locationId, contactId, conversationId, message } = payload;
  
  // Validate required fields
  if (!locationId || !contactId || !message) {
    throw new Error('Missing required fields for inbound message');
  }

  // Find contact - use indexed query
  const contact = await db.collection('contacts').findOne(
    { ghlContactId: contactId, locationId },
    { projection: { _id: 1, firstName: 1, lastName: 1, email: 1, phone: 1, fullName: 1 } }
  );
  
  if (!contact) {
    console.warn(`[Direct Processor] Contact not found: ${contactId}`);
    // Don't fail - queue processor will handle contact creation
    return;
  }

  // Determine conversation type
  const conversationType = message.type === 1 ? 'TYPE_PHONE' : 
                          message.type === 3 ? 'TYPE_EMAIL' : 
                          'TYPE_OTHER';

  // Start a session for atomic operations
  const session = db.client.startSession();
  
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
            lastMessageBody: message.body?.substring(0, 200) || '',
            lastMessageType: getMessageTypeName(message.type),
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

      // Insert message
      const messageDoc: any = {
        _id: new ObjectId(),
        ghlMessageId: message.id,
        conversationId: conversationResult.value._id,  // Use ObjectId directly
        ghlConversationId: conversationId,
        locationId,
        contactObjectId: contact._id,                  // FIXED: Use ObjectId directly
        ghlContactId: contactId,                        // ADD: Store GHL contact ID
        type: message.type,
        messageType: message.messageType || getMessageTypeName(message.type),
        direction: 'inbound',
        body: message.body || '',                      // Add body field
        dateAdded: new Date(message.dateAdded || Date.now()),
        source: message.source || 'ghl',
        read: false,
        createdAt: new Date(),
        processedBy: 'direct',
        webhookId
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
    });

    // TODO: Send push notification to assigned users (outside transaction)
    // This would be your push notification service
    
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
  const { locationId, contactId, conversationId, message, userId } = payload;
  
  // Similar to inbound but simpler
  const contact = await db.collection('contacts').findOne(
    { ghlContactId: contactId, locationId },
    { projection: { _id: 1, firstName: 1, lastName: 1, email: 1, phone: 1, fullName: 1 } }
  );
  
  if (!contact) return;

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
        lastMessageBody: message.body?.substring(0, 200) || '',
        lastMessageDirection: 'outbound',
        lastMessageType: message.messageType || getMessageTypeName(message.type || 1),
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
  await db.collection('messages').insertOne({
    _id: new ObjectId(),
    ghlMessageId: message.id || new ObjectId().toString(),
    conversationId: conversationResult.value._id,      // Use ObjectId from conversation
    ghlConversationId: conversationId,
    locationId,
    contactObjectId: contact._id,                      // FIXED: Use ObjectId directly
    ghlContactId: contactId,                            // ADD: Store GHL contact ID
    userId: userId || null,
    type: message.type || 1,
    messageType: message.messageType || getMessageTypeName(message.type || 1),
    direction: 'outbound',
    body: message.body || '',
    dateAdded: new Date(message.dateAdded || Date.now()),
    source: message.source || 'ghl',
    read: true,
    createdAt: new Date(),
    processedBy: 'direct',
    webhookId
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