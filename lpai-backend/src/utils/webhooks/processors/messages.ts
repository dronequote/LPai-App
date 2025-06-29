// src/utils/webhooks/processors/messages.ts
// Updated Date 06/24/2025
// FIXED: Handle new webhook payload structure where conversation comes as { value: { _id: "..." } }
// FIXED: Store conversationId as ObjectId, not string
// FIXED: Ably integration with proper variable scoping

import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId, Db } from 'mongodb';
// NEW: Add axios and getAuthHeader imports for email fetching
import axios from 'axios';
import { getAuthHeader } from '../../ghlAuth';
import Ably from 'ably';

// Initialize Ably
const ably = new Ably.Rest(process.env.ABLY_API_KEY);

export class MessagesProcessor extends BaseProcessor {
  constructor(db?: Db) {
    super({
      queueType: 'messages',
      batchSize: 50,
      maxRuntime: 50000,
      processorName: 'MessagesProcessor'
    }, db);
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
    // Handle the nested structure - check if this is a native webhook format
    let locationId, contactId, conversationId, message, timestamp, conversation;
    
    if (payload.webhookPayload) {
      // Native webhook format - extract from webhookPayload
      const webhookData = payload.webhookPayload;
      locationId = payload.locationId || webhookData.locationId;
      contactId = webhookData.contactId;
      conversationId = webhookData.conversationId;
      message = webhookData.message;
      timestamp = webhookData.timestamp || payload.timestamp;
      // NEW: Handle new conversation structure
      conversation = webhookData.conversation;
    } else {
      // Direct format - handle the actual webhook structure we're receiving
      locationId = payload.locationId;
      contactId = payload.contactId;
      conversationId = payload.conversationId;
      timestamp = payload.timestamp;
      conversation = payload.conversation;
      
      // Handle message structure - GHL sends body/messageType directly
      if (payload.body) {
        message = {
          id: payload.messageId,
          body: payload.body,
          type: payload.messageType === 'SMS' ? 1 : (payload.messageType === 'Email' ? 3 : 1),
          messageType: payload.messageType,
          status: payload.status,
          dateAdded: payload.dateAdded,
          meta: payload.meta || {}
        };
      } else {
        message = payload.message;
      }
    }
    
    if (!locationId || !contactId || !message) {
      console.error(`[MessagesProcessor] Missing required fields for inbound message:`, {
        locationId: !!locationId,
        contactId: !!contactId,
        message: !!message,
        webhookId
      });
      return;
    }

    // Find or create contact
    let contact = await this.db.collection('contacts').findOne(
      { ghlContactId: contactId, locationId },
      { 
        projection: { 
          _id: 1, 
          firstName: 1, 
          lastName: 1, 
          email: 1, 
          phone: 1,
          fullName: 1,
          dateAdded: 1,
          assignedTo: 1  // IMPORTANT: Add assignedTo for Ably routing
        } 
      }
    );
    
    if (!contact) {
      // Create new contact record
      const fullName = `${message.contactFirstName || ''} ${message.contactLastName || ''}`.trim() || 'Unknown';
      
      contact = {
        _id: new ObjectId(),
        ghlContactId: contactId,
        locationId,
        firstName: message.contactFirstName || '',
        lastName: message.contactLastName || '',
        fullName,
        email: message.contactEmail || '',
        phone: message.contactPhone || '',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByWebhook: webhookId,
        lastActivity: new Date()
      };
      
      await this.db.collection('contacts').insertOne(contact);
      console.log(`[MessagesProcessor] Created new contact: ${contact._id} (${fullName})`);
    }

    // Get conversation type from message
    const conversationType = this.getConversationType(message.type);
    
    // Variables we'll need for Ably (declare outside transaction)
    let conversationObjectId: ObjectId;
    let messageDoc: any;
    let updatedConversation: any;
    
    // Start a session for atomic operations
    const session = this.db.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Update or create conversation
        const conversationResult = await this.db.collection('conversations').findOneAndUpdate(
          { 
            ghlConversationId: conversationId,
            locationId 
          },
          {
            $set: {
              ghlConversationId: conversationId,
              locationId,
              contactObjectId: contact._id,  // Store as ObjectId, not string
              ghlContactId: contactId,        // Keep GHL ID for reference
              type: conversationType,
              lastMessageDate: new Date(),
              lastMessageBody: message.body?.substring(0, 200) || '',
              lastMessageType: this.getMessageTypeName(message.type),
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
              scoring: [],
              followers: [],
              tags: [],
              dateAdded: new Date(message.dateAdded || timestamp || Date.now()),
              attributed: false,
              dateUpdated: new Date(),
              lastSyncedAt: new Date(),
              createdBySync: false,
              createdByWebhook: webhookId
            }
          },
          { 
            upsert: true,
            returnDocument: 'after',
            session 
          }
        );

        // Store the conversation for use outside transaction
        updatedConversation = conversationResult;

        // FIXED: Handle new webhook payload structure
        if (conversation && conversation.value && conversation.value._id) {
          // New webhook format: conversation comes as { value: { _id: "..." } }
          conversationObjectId = new ObjectId(conversation.value._id);
          console.log(`[MessagesProcessor] Using conversation._id from new webhook format: ${conversation.value._id}`);
        } else if (conversationResult && conversationResult.value && conversationResult.value._id) {
          // Standard format from findOneAndUpdate
          conversationObjectId = conversationResult.value._id;
        } else if (conversationResult && conversationResult._id) {
          // Sometimes the result comes without .value wrapper
          conversationObjectId = conversationResult._id;
        } else {
          console.error(`[MessagesProcessor] Could not determine conversation ObjectId`, {
            hasConversation: !!conversation,
            hasConversationValue: !!(conversation && conversation.value),
            hasConversationValueId: !!(conversation && conversation.value && conversation.value._id),
            hasResult: !!conversationResult,
            hasResultValue: !!(conversationResult && conversationResult.value),
            conversationResultKeys: conversationResult ? Object.keys(conversationResult) : [],
            ghlConversationId: conversationId
          });
          // As a last resort, look up the conversation by ghlConversationId
          const existingConversation = await this.db.collection('conversations').findOne({
            ghlConversationId: conversationId,
            locationId
          });
          if (existingConversation && existingConversation._id) {
            conversationObjectId = existingConversation._id;
            console.log(`[MessagesProcessor] Found conversation by ghlConversationId lookup: ${conversationObjectId}`);
          } else {
            throw new Error('Could not determine conversation ObjectId');
          }
        }

        // Build message document
        messageDoc = {
          _id: new ObjectId(),
          ghlMessageId: message?.id || new ObjectId().toString(),
          conversationId: conversationObjectId, // Use ObjectId directly
          ghlConversationId: conversationId,
          locationId,
          contactObjectId: contact._id,  // Store as ObjectId
          ghlContactId: contactId,        // Keep GHL ID
          senderId: contact._id.toString(),
          type: message?.type || 1,
          messageType: message?.messageType || 'TYPE_PHONE',
          direction: 'inbound',
          dateAdded: new Date(message?.dateAdded || timestamp || Date.now()),
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
              
              // NEW: AUTO-FETCH EMAIL CONTENT
              try {
                const emailContent = await this.fetchEmailContent(
                  message.meta.email.messageIds[0], 
                  locationId
                );
                
                if (emailContent) {
                  messageDoc.body = emailContent.body;
                  messageDoc.htmlBody = emailContent.htmlBody;
                  messageDoc.subject = emailContent.subject;
                  messageDoc.needsContentFetch = false;
                  messageDoc.emailFetchedAt = new Date();
                  console.log(`[MessagesProcessor] Email content auto-fetched for ${message.meta.email.messageIds[0]}`);
                }
              } catch (fetchError) {
                console.error(`[MessagesProcessor] Failed to auto-fetch email content:`, fetchError);
                // Continue processing - email can be fetched later
              }
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
            contactObjectId: contact._id,  // Use contactObjectId for consistency
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

    } finally {
      await session.endSession();
    }

    // Emit real-time event via Ably (OUTSIDE TRANSACTION with proper variables)
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
            unreadCount: (updatedConversation?.value?.unreadCount || updatedConversation?.unreadCount || 0)
          }
        });
        console.log('[Ably] Published inbound message to user:', contact.assignedTo);
      } catch (error) {
        console.error('[Ably] Failed to publish message:', error);
      }
    }

    // TODO: Trigger push notifications
    // await this.sendPushNotifications(contact, message);
  }

  /**
   * Process outbound message
   */
  private async processOutboundMessage(payload: any, webhookId: string): Promise<void> {
    // Handle the nested structure
    let locationId, contactId, conversationId, message, userId, timestamp, conversation;
    
    if (payload.webhookPayload) {
      // Native webhook format
      const webhookData = payload.webhookPayload;
      locationId = payload.locationId || webhookData.locationId;
      contactId = webhookData.contactId;
      conversationId = webhookData.conversationId;
      message = webhookData;  // For outbound, the whole webhookPayload is the message
      userId = webhookData.userId;
      timestamp = webhookData.timestamp || payload.timestamp;
      // NEW: Handle new conversation structure
      conversation = webhookData.conversation;
      
      // Extract message details from webhookData
      if (!message.body && webhookData.body) {
        message = {
          body: webhookData.body,
          type: webhookData.direction === 'outbound' ? 1 : 3, // Default to SMS
          messageType: webhookData.messageType,
          dateAdded: webhookData.dateAdded
        };
      }
    } else {
      // Direct format - handle the actual webhook structure
      locationId = payload.locationId;
      contactId = payload.contactId;
      conversationId = payload.conversationId;
      userId = payload.userId;
      timestamp = payload.timestamp;
      conversation = payload.conversation;
      
      // Handle message structure for outbound
      if (payload.body) {
        message = {
          id: payload.messageId,
          body: payload.body,
          type: payload.messageType === 'SMS' ? 1 : (payload.messageType === 'Email' ? 3 : 1),
          messageType: payload.messageType,
          status: payload.status,
          dateAdded: payload.dateAdded,
          meta: payload.meta || {}
        };
      } else {
        message = payload.message;
      }
    }
    
    // Add validation for required fields
    if (!locationId || !contactId) {
      console.warn(`[MessagesProcessor] Missing required fields for outbound message:`, {
        locationId: !!locationId,
        contactId: !!contactId,
        webhookId
      });
      return; // Skip processing if fields are missing
    }

    // Find contact
    let contact = await this.db.collection('contacts').findOne(
      { ghlContactId: contactId, locationId },
      { 
        projection: { 
          _id: 1, 
          firstName: 1, 
          lastName: 1, 
          email: 1, 
          phone: 1,
          fullName: 1,
          assignedTo: 1  // IMPORTANT: Add assignedTo for Ably routing
        } 
      }
    );
    
    if (!contact) {
      console.warn(`[MessagesProcessor] Contact not found for outbound message: ${contactId}, creating minimal contact`);
      
      // Create a minimal contact record
      const newContact = {
        _id: new ObjectId(),
        ghlContactId: contactId,
        locationId,
        firstName: '',
        lastName: '',
        fullName: 'Unknown Contact',
        email: '',
        phone: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByWebhook: webhookId,
        needsSync: true // Flag for later sync
      };
      
      try {
        await this.db.collection('contacts').insertOne(newContact);
        console.log(`[MessagesProcessor] Created minimal contact for outbound message: ${contactId}`);
        contact = newContact;
      } catch (insertError: any) {
        // Handle duplicate key error - contact might have been created by another process
        if (insertError.code === 11000) {
          // Try to find the contact again
          contact = await this.db.collection('contacts').findOne(
            { ghlContactId: contactId, locationId },
            { projection: { _id: 1, firstName: 1, lastName: 1, email: 1, phone: 1, fullName: 1, assignedTo: 1 } }
          );
          
          if (!contact) {
            console.error(`[MessagesProcessor] Failed to create or find contact for outbound message: ${contactId}`);
            return;
          }
        } else {
          console.error(`[MessagesProcessor] Failed to create contact for outbound message:`, insertError);
          return;
        }
      }
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

    const conversationType = message?.type ? this.getConversationType(message.type) : 'TYPE_PHONE';

    // Variables we'll need for Ably (declare outside transaction)
    let conversationObjectId: ObjectId;
    let messageDoc: any;

    // Update or create conversation
    const conversationResult = await this.db.collection('conversations').findOneAndUpdate(
      { 
        ghlConversationId: conversationId,
        locationId 
      },
      {
        $set: {
          ghlConversationId: conversationId,
          locationId,
          contactObjectId: contact._id,  // FIXED: Use contactObjectId as ObjectId
          ghlContactId: contactId,        // FIXED: Add GHL contact ID
          type: conversationType,
          lastMessageDate: new Date(),
          lastMessageBody: message?.body?.substring(0, 200) || '',
          lastMessageType: message?.messageType || 'TYPE_PHONE',
          lastMessageDirection: 'outbound',
          contactName: contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown',
          contactEmail: contact.email,
          contactPhone: contact.phone,
          updatedAt: new Date()
        },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: new Date(),
          inbox: true,
          starred: false,
          scoring: [],
          followers: [],
          tags: [],
          unreadCount: 0,
          dateAdded: new Date(),
          attributed: false,
          dateUpdated: new Date(),
          lastSyncedAt: new Date(),
          createdBySync: false,
          createdByWebhook: webhookId
        }
      },
      { 
        upsert: true,
        returnDocument: 'after'
      }
    );

    // FIXED: Handle new webhook payload structure for outbound too
    if (conversation && conversation.value && conversation.value._id) {
      // New webhook format: conversation comes as { value: { _id: "..." } }
      conversationObjectId = new ObjectId(conversation.value._id);
      console.log(`[MessagesProcessor] Using conversation._id from new webhook format (outbound): ${conversation.value._id}`);
    } else if (conversationResult && conversationResult.value && conversationResult.value._id) {
      // Standard format from findOneAndUpdate
      conversationObjectId = conversationResult.value._id;
    } else if (conversationResult && conversationResult._id) {
      // Sometimes the result comes without .value wrapper
      conversationObjectId = conversationResult._id;
    } else {
      console.error(`[MessagesProcessor] Could not determine conversation ObjectId for outbound`, {
        hasConversation: !!conversation,
        hasResult: !!conversationResult
      });
      // As a last resort, look up the conversation
      const existingConversation = await this.db.collection('conversations').findOne({
        ghlConversationId: conversationId,
        locationId
      });
      if (existingConversation) {
        conversationObjectId = existingConversation._id;
      } else {
        throw new Error('Could not determine conversation ObjectId for outbound message');
      }
    }

    // Build message document
    messageDoc = {
      _id: new ObjectId(),
      ghlMessageId: message?.id || new ObjectId().toString(),
      conversationId: conversationObjectId, // Use ObjectId directly
      ghlConversationId: conversationId,
      locationId,
      contactObjectId: contact._id,  // FIXED: Use contactObjectId as ObjectId
      ghlContactId: contactId,        // FIXED: Add GHL contact ID
      senderId,
      type: message?.type || 1,
      messageType: message?.messageType || 'TYPE_PHONE',
      direction: 'outbound',
      dateAdded: new Date(message?.dateAdded || timestamp || Date.now()),
      read: true,
      createdAt: new Date(),
      processedBy: 'queue',
      webhookId
    };

    // Handle different message types
    if (message) {
      switch (message.type) {
        case 1: // SMS
          messageDoc.body = message.body || '';
          messageDoc.status = message.status || 'sent';
          messageDoc.segments = message.segments || 1;
          break;
          
        case 3: // Email
          messageDoc.subject = message.subject || 'No subject';
          
          // Check if we have email message ID for content fetch
          if (message.meta?.email?.messageIds?.[0]) {
            messageDoc.emailMessageId = message.meta.email.messageIds[0];
            messageDoc.needsContentFetch = true;
            
            // NEW: AUTO-FETCH EMAIL CONTENT FOR OUTBOUND
            try {
              const emailContent = await this.fetchEmailContent(
                message.meta.email.messageIds[0], 
                locationId
              );
              
              if (emailContent) {
                messageDoc.body = emailContent.body;
                messageDoc.htmlBody = emailContent.htmlBody;
                messageDoc.subject = emailContent.subject;
                messageDoc.needsContentFetch = false;
                messageDoc.emailFetchedAt = new Date();
                console.log(`[MessagesProcessor] Outbound email content auto-fetched for ${message.meta.email.messageIds[0]}`);
              }
            } catch (fetchError) {
              console.error(`[MessagesProcessor] Failed to auto-fetch outbound email content:`, fetchError);
              // Continue processing - email can be fetched later
              messageDoc.body = message.body || '';
            }
          } else {
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
    } else {
      // Fallback for messages without proper structure
      messageDoc.body = payload.webhookPayload?.body || '';
    }

    await this.db.collection('messages').insertOne(messageDoc);

    // Emit real-time event via Ably for outbound messages (with proper variables)
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
            id: conversationObjectId,
            contactObjectId: contact._id,
            unreadCount: conversationResult?.value?.unreadCount || conversationResult?.unreadCount || 0
          }
        });
        console.log('[Ably] Published outbound message to user:', contact.assignedTo || userId);
      } catch (error) {
        console.error('[Ably] Failed to publish outbound message:', error);
      }
    }
  }

  /**
   * Process conversation unread update
   */
  private async processConversationUpdate(payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let locationId, conversationId, unreadCount;
    
    if (payload.webhookPayload) {
      const webhookData = payload.webhookPayload;
      locationId = payload.locationId || webhookData.locationId;
      conversationId = webhookData.conversationId;
      unreadCount = webhookData.unreadCount;
    } else {
      ({ locationId, conversationId, unreadCount } = payload);
    }
    
    if (!locationId || !conversationId) {
      console.warn(`[MessagesProcessor] Missing required fields for conversation update`);
      return;
    }
    
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
    // Handle nested structure for LCEmailStats
    let locationId, event, id, timestamp, message;
    
    if (payload.webhookPayload) {
      // Native webhook format - the whole webhookPayload contains the email data
      const webhookData = payload.webhookPayload;
      locationId = payload.locationId;
      event = webhookData.event || webhookData['log-level']; // Sometimes event is in log-level
      id = webhookData.id || webhookData['email_message_id'];
      timestamp = webhookData.timestamp || payload.timestamp;
      message = webhookData.message || webhookData;
    } else {
      // Direct format
      ({ locationId, event, id, timestamp, message } = payload);
    }
    
    console.log(`[MessagesProcessor] Processing LCEmailStats event: ${event}`);
    console.log(`[MessagesProcessor] LCEmailStats data:`, { locationId, event, id });
    
    if (!locationId || !event || !id) {
      console.warn(`[MessagesProcessor] Missing required fields for LCEmailStats:`, {
        locationId: !!locationId,
        event: !!event,
        id: !!id,
        webhookPayload: payload.webhookPayload
      });
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
      recipient: message?.recipient || payload.webhookPayload?.recipient,
      recipientDomain: message?.['recipient-domain'] || payload.webhookPayload?.['recipient-domain'],
      primaryDomain: message?.['primary-dkim'] || payload.webhookPayload?.['primary-dkim'],
      tags: message?.tags || payload.webhookPayload?.tags || [],
      recipientProvider: message?.['recipient-provider'] || payload.webhookPayload?.['recipient-provider'],
      campaigns: message?.campaigns || payload.webhookPayload?.campaigns || [],
      deliveryStatus: message?.['delivery-status'] || payload.webhookPayload?.['delivery-status'],
      envelope: message?.envelope || payload.webhookPayload?.envelope,
      lcOperations: message?.['lc-operations'] || payload.webhookPayload?.['lc-operations'],
      logLevel: message?.['log-level'] || payload.webhookPayload?.['log-level'],
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
   * NEW: Fetch email content from GHL
   */
  private async fetchEmailContent(emailMessageId: string, locationId: string): Promise<{ body: string; htmlBody: string; subject: string } | null> {
    try {
      // Get location for auth
      const location = await this.db.collection('locations').findOne({ locationId });
      
      if (!location) {
        console.error(`[MessagesProcessor] Location not found for email fetch: ${locationId}`);
        return null;
      }

      // Get auth header
      const auth = await getAuthHeader(location);

      // Fetch email content from GHL
      console.log(`[MessagesProcessor] Fetching email content for ${emailMessageId}`);
      
      const response = await axios.get(
        `https://services.leadconnectorhq.com/conversations/messages/email/${emailMessageId}`,
        {
          headers: {
            'Authorization': auth.header,
            'Version': '2021-04-15',
            'Accept': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      const emailData = response.data.emailMessage;
      
      if (!emailData) {
        console.warn(`[MessagesProcessor] No email data returned for ${emailMessageId}`);
        return null;
      }

      return {
        subject: emailData.subject || 'No subject',
        body: emailData.body || '',
        htmlBody: emailData.htmlBody || emailData.body || ''
      };
    } catch (error: any) {
      // Don't log full error to avoid exposing tokens
      console.error(`[MessagesProcessor] Failed to fetch email content for ${emailMessageId}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      });
      return null;
    }
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