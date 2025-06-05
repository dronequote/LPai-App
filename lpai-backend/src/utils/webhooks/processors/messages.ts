// src/utils/webhooks/processors/messages.ts
import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId, Db } from 'mongodb';

export class MessagesProcessor extends BaseProcessor {
  constructor(db: Db) {
    super({
      db: db,
      queueType: 'messages',
      batchSize: 50,
      maxProcessingTime: 50000, // 50 seconds
      processorName: 'MessagesProcessor'
    });
  }

  /**
   * Process message webhooks
   */
  protected async processItem(item: QueueItem): Promise<void> {
    const { type, payload, webhookId } = item;

    // Track message processing start
    const messageStartTime = Date.now();

    switch (type) {
      case 'InboundMessage':
        await this.processInboundMessage(payload, webhookId);
        break;
        
      case 'OutboundMessage':
        await this.processOutboundMessage(payload, webhookId);
        break;
        
      case 'ConversationUnreadUpdate':
        await this.processConversationUpdate(payload, webhookId);
        break;
        
      case 'LCEmailStats':
        await this.processLCEmailStats(payload, webhookId);
        break;
        
      default:
        console.warn(`[MessagesProcessor] Unknown message type: ${type}`);
        throw new Error(`Unsupported message webhook type: ${type}`);
    }

    // Track message processing time
    const processingTime = Date.now() - messageStartTime;
    if (processingTime > 2000) {
      console.warn(`[MessagesProcessor] Slow message processing: ${processingTime}ms for ${type}`);
    }
  }

  /**
   * Process inbound message (SMS/Email/WhatsApp)
   */
  private async processInboundMessage(payload: any, webhookId: string): Promise<void> {
    const { locationId, contactId, conversationId, message, timestamp } = payload;
    
    if (!locationId || !contactId || !message) {
      throw new Error('Missing required fields for inbound message');
    }

    // Find or create contact (optimized query)
    let contact = await this.db.collection('contacts').findOne(
      { ghlContactId: contactId, locationId },
      { 
        projection: { 
          _id: 1, 
          firstName: 1, 
          lastName: 1, 
          email: 1, 
          phone: 1,
          fullName: 1
        } 
      }
    );
    
    if (!contact) {
      // Create basic contact from webhook data
      console.log(`[MessagesProcessor] Creating contact ${contactId} from message webhook`);
      
      const newContact = {
        _id: new ObjectId(),
        ghlContactId: contactId,
        locationId,
        firstName: payload.firstName || '',
        lastName: payload.lastName || '',
        fullName: `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || 'Unknown',
        email: payload.email || '',
        phone: payload.phone || '',
        source: 'message_webhook',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByWebhook: webhookId
      };
      
      await this.db.collection('contacts').insertOne(newContact);
      contact = newContact;
    }

    // Determine conversation type
    const conversationType = this.getConversationType(message.type);
    
    // Start session for atomic operations
    const session = this.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Update or create conversation
        const conversation = await this.db.collection('conversations').findOneAndUpdate(
          { 
            ghlConversationId: conversationId,
            locationId 
          },
          {
            $set: {
              ghlConversationId: conversationId,
              locationId,
              contactId: contact._id.toString(),
              type: conversationType,
              lastMessageDate: new Date(timestamp || Date.now()),
              lastMessageBody: message.body?.substring(0, 200) || '',
              lastMessageType: message.messageType || payload.type,
              lastMessageDirection: 'inbound',
              contactName: contact.fullName || `${contact.firstName} ${contact.lastName}`.trim(),
              contactEmail: contact.email,
              contactPhone: contact.phone,
              updatedAt: new Date()
            },
            $inc: { unreadCount: 1 },
            $setOnInsert: {
              _id: new ObjectId(),
              createdAt: new Date(),
              createdByWebhook: webhookId
            }
          },
          { 
            upsert: true,
            returnDocument: 'after',
            session 
          }
        );

        // Build message document
        const messageDoc: any = {
          _id: new ObjectId(),
          ghlMessageId: message.id,
          conversationId: conversation.value._id.toString(),
          ghlConversationId: conversationId,
          locationId,
          contactId: contact._id.toString(),
          type: message.type,
          messageType: message.messageType || this.getMessageTypeName(message.type),
          direction: 'inbound',
          dateAdded: new Date(message.dateAdded || timestamp || Date.now()),
          read: false,
          createdAt: new Date(),
          processedBy: 'queue',
          webhookId
        };

        // Handle different message types
        switch (message.type) {
          case 1: // SMS
            messageDoc.body = message.body || '';
            messageDoc.status = message.status || 'received';
            messageDoc.segments = message.segments || 1;
            break;
            
          case 3: // Email
            // Store email reference for lazy loading
            if (message.meta?.email?.messageIds?.[0]) {
              messageDoc.emailMessageId = message.meta.email.messageIds[0];
              messageDoc.needsContentFetch = true;
              messageDoc.subject = message.subject || 'No subject';
            } else {
              messageDoc.subject = message.subject || 'No subject';
              messageDoc.body = message.body || '';
              messageDoc.htmlBody = message.htmlBody;
            }
            break;
            
          case 4: // WhatsApp
            messageDoc.body = message.body || '';
            messageDoc.mediaUrl = message.mediaUrl;
            messageDoc.mediaType = message.mediaType;
            break;
            
          default:
            messageDoc.body = message.body || '';
            messageDoc.meta = message.meta || {};
        }

        // Insert message
        await this.db.collection('messages').insertOne(messageDoc, { session });

        // Check for active project (optimized)
        const project = await this.db.collection('projects').findOne(
          {
            contactId: contact._id.toString(),
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
          await this.db.collection('messages').updateOne(
            { _id: messageDoc._id },
            { $set: { projectId: project._id.toString() } },
            { session }
          );
        }
      });

      // TODO: Trigger push notifications (outside transaction)
      // await this.sendPushNotifications(contact, message);
      
    } finally {
      await session.endSession();
    }
  }

  /**
   * Process outbound message
   */
  private async processOutboundMessage(payload: any, webhookId: string): Promise<void> {
    const { locationId, contactId, conversationId, message, userId, timestamp } = payload;
    
    // Add validation for required fields
    if (!locationId || !contactId || !message) {
      console.warn(`[MessagesProcessor] Missing required fields for outbound message: ${webhookId}`);
      return; // Skip processing if message is missing
    }

    // Find contact
    const contact = await this.db.collection('contacts').findOne(
      { ghlContactId: contactId, locationId },
      { 
        projection: { 
          _id: 1, 
          firstName: 1, 
          lastName: 1, 
          email: 1, 
          phone: 1,
          fullName: 1
        } 
      }
    );
    
    if (!contact) {
      console.warn(`[MessagesProcessor] Contact not found for outbound message: ${contactId}`);
      return;
    }

    // Find user who sent it
    let senderId = null;
    if (userId) {
      const user = await this.db.collection('users').findOne(
        { ghlUserId: userId, locationId },
        { projection: { _id: 1 } }
      );
      if (user) {
        senderId = user._id.toString();
      }
    }

    const conversationType = this.getConversationType(message.type);

    // Update conversation
    await this.db.collection('conversations').updateOne(
      { 
        ghlConversationId: conversationId,
        locationId 
      },
      {
        $set: {
          ghlConversationId: conversationId,
          locationId,
          contactId: contact._id.toString(),
          type: conversationType,
          lastMessageDate: new Date(timestamp || Date.now()),
          lastMessageBody: message.body?.substring(0, 200) || '',
          lastMessageType: message.messageType || payload.type,
          lastMessageDirection: 'outbound',
          lastOutboundMessageDate: new Date(),
          contactName: contact.fullName || `${contact.firstName} ${contact.lastName}`.trim(),
          contactEmail: contact.email,
          contactPhone: contact.phone,
          updatedAt: new Date()
        },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: new Date(),
          unreadCount: 0
        }
      },
      { upsert: true }
    );

    // Insert message
    const messageDoc: any = {
      _id: new ObjectId(),
      ghlMessageId: message.id,
      conversationId: conversationId,
      ghlConversationId: conversationId,
      locationId,
      contactId: contact._id.toString(),
      userId: senderId,
      type: message.type,
      messageType: message.messageType || this.getMessageTypeName(message.type),
      direction: 'outbound',
      dateAdded: new Date(message.dateAdded || timestamp || Date.now()),
      read: true, // Outbound messages are always "read"
      createdAt: new Date(),
      processedBy: 'queue',
      webhookId
    };

    // Handle message content based on type
    switch (message.type) {
      case 1: // SMS
        messageDoc.body = message.body || '';
        messageDoc.status = message.status || 'sent';
        break;
      case 3: // Email
        if (message.meta?.email?.messageIds?.[0]) {
          messageDoc.emailMessageId = message.meta.email.messageIds[0];
          messageDoc.needsContentFetch = true;
        }
        messageDoc.subject = message.subject || '';
        break;
      default:
        messageDoc.body = message.body || '';
    }

    await this.db.collection('messages').insertOne(messageDoc);
  }

  /**
   * Process conversation unread update
   */
  private async processConversationUpdate(payload: any, webhookId: string): Promise<void> {
    const { locationId, conversationId, unreadCount } = payload;
    
    await this.db.collection('conversations').updateOne(
      {
        ghlConversationId: conversationId,
        locationId
      },
      {
        $set: {
          unreadCount: unreadCount || 0,
          updatedAt: new Date()
        }
      }
    );
  }

  /**
   * Process LC Email Stats
   */
  private async processLCEmailStats(payload: any, webhookId: string): Promise<void> {
    const { locationId, event, id, timestamp, message } = payload;
    
    console.log(`[MessagesProcessor] Processing LCEmailStats event: ${event}`);
    
    if (!locationId || !event || !id) {
      console.warn(`[MessagesProcessor] Missing required fields for LCEmailStats`);
      return;
    }

    // Store email event stats
    await this.db.collection('email_stats').insertOne({
      _id: new ObjectId(),
      webhookId,
      locationId,
      emailId: id,
      event: event, // 'delivered', 'opened', 'clicked', 'bounced', etc.
      timestamp: new Date(timestamp || Date.now()),
      recipient: message?.recipient || payload.recipient,
      recipientDomain: message?.['recipient-domain'] || payload['recipient-domain'],
      primaryDomain: message?.['primary-dkim'] || payload['primary-dkim'],
      tags: message?.tags || payload.tags || [],
      recipientProvider: message?.['recipient-provider'] || payload['recipient-provider'],
      campaigns: message?.campaigns || payload.campaigns || [],
      deliveryStatus: message?.['delivery-status'] || payload['delivery-status'],
      envelope: message?.envelope || payload.envelope,
      lcOperations: message?.['lc-operations'] || payload['lc-operations'],
      logLevel: message?.['log-level'] || payload['log-level'],
      metadata: payload,
      processedAt: new Date(),
      processedBy: 'queue'
    });

    // Update conversation/message with email status if we can find it
    if (id) {
      await this.db.collection('messages').updateOne(
        { emailMessageId: id },
        { 
          $set: { 
            emailStatus: event,
            emailStatusUpdatedAt: new Date(),
            [`emailEvents.${event}`]: new Date(timestamp || Date.now())
          }
        }
      );
    }

    console.log(`[MessagesProcessor] LCEmailStats processed: ${event} for ${id}`);
  }

  /**
   * Get conversation type from message type
   */
  private getConversationType(messageType: number): string {
    const typeMap: Record<number, string> = {
      1: 'TYPE_PHONE',
      3: 'TYPE_EMAIL',
      4: 'TYPE_WHATSAPP',
      5: 'TYPE_GMB',
      6: 'TYPE_FB',
      7: 'TYPE_IG'
    };
    
    return typeMap[messageType] || 'TYPE_OTHER';
  }

  /**
   * Get message type name from type number
   */
  private getMessageTypeName(type: number): string {
    const typeMap: Record<number, string> = {
      1: 'SMS',
      3: 'Email',
      4: 'WhatsApp',
      5: 'Google My Business',
      6: 'Facebook',
      7: 'Instagram',
      24: 'Activity - Appointment',
      25: 'Activity - Contact',
      26: 'Activity - Invoice',
      27: 'Activity - Opportunity'
    };
    
    return typeMap[type] || `Type ${type}`;
  }
}