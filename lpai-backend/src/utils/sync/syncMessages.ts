// src/utils/sync/syncMessages.ts
// Updated Date 06/24/2025

import axios from 'axios';
import { Db, ObjectId } from 'mongodb';

interface SyncMessagesOptions {
  conversationId: ObjectId;         // CHANGED: MongoDB conversation ID as ObjectId
  ghlConversationId: string;        // GHL conversation ID
  contactObjectId: ObjectId;        // CHANGED: MongoDB contact ID as ObjectId
  ghlContactId: string;             // ADD: GHL contact ID
  projectId?: ObjectId;             // CHANGED: MongoDB project ID as ObjectId
  limit?: number;
  auth: any;                        // Auth header passed from parent
}

export async function syncMessages(
  db: Db, 
  location: any, 
  options: SyncMessagesOptions
) {
  const { 
    conversationId, 
    ghlConversationId, 
    contactObjectId,
    ghlContactId,
    projectId,
    limit = 20,
    auth 
  } = options;
  
  console.log(`[Sync Messages] Starting for conversation ${ghlConversationId} - Limit: ${limit}`);

  try {
    // Fetch messages from GHL - matching your exact request
    const response = await axios.get(
      `https://services.leadconnectorhq.com/conversations/${ghlConversationId}/messages`,
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-04-15', // Matching your version
          'Accept': 'application/json'
        },
        params: {
          limit
        }
      }
    );

    const messagesData = response.data.messages || {};
    const ghlMessages = messagesData.messages || [];
    const nextPage = messagesData.nextPage || false;
    const lastMessageId = messagesData.lastMessageId;
    
    console.log(`[Sync Messages] Found ${ghlMessages.length} messages for conversation`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const ghlMsg of ghlMessages) {
      try {
        // Check if message exists
        const existingMessage = await db.collection('messages').findOne({
          ghlMessageId: ghlMsg.id,
          conversationId: conversationId  // Already ObjectId
        });

        let messageData: any = {
          // Core fields
          ghlMessageId: ghlMsg.id,
          conversationId: conversationId,           // CHANGED: Use ObjectId directly
          ghlConversationId: ghlConversationId,
          locationId: location.locationId,
          contactObjectId: contactObjectId,         // CHANGED: Use ObjectId directly
          ghlContactId: ghlContactId,               // ADD: Store GHL contact ID
          projectId: projectId || null,             // CHANGED: Use ObjectId or null
          
          // Message info
          type: ghlMsg.type,
          messageType: ghlMsg.messageType,
          direction: ghlMsg.direction || 'inbound',
          contentType: ghlMsg.contentType,
          source: ghlMsg.source,
          
          // Timestamps
          dateAdded: ghlMsg.dateAdded ? new Date(ghlMsg.dateAdded) : new Date(),
          
          // Sync metadata
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        };

        // Handle different message types
        switch (ghlMsg.type) {
          case 1: // SMS
            // Store SMS body immediately - they're small
            messageData.body = ghlMsg.body || '';
            messageData.status = ghlMsg.status || 'delivered';
            break;
            
          case 3: // Email
            // Store email reference only - fetch content on demand
            if (ghlMsg.meta?.email?.messageIds?.[0]) {
              messageData.emailMessageId = ghlMsg.meta.email.messageIds[0];
              messageData.needsContentFetch = true;
              messageData.subject = ghlMsg.subject || 'No subject';
              // Don't store body/subject yet - will be fetched later
            } else {
              // If no email ID, store what we have
              messageData.body = ghlMsg.body || '';
              messageData.subject = ghlMsg.subject || 'No subject';
            }
            break;
            
          case 25: // Activity - Contact
          case 26: // Activity - Invoice
          case 27: // Activity - Opportunity
          case 28: // Activity - Appointment
            // Activity messages already have simple body text
            messageData.body = ghlMsg.body || '';
            break;
            
          default:
            // For unknown types, store what we have
            messageData.body = ghlMsg.body || '';
            messageData.meta = ghlMsg.meta || {};
        }

        if (!existingMessage) {
          // Create new message
          await db.collection('messages').insertOne({
            _id: new ObjectId(),
            ...messageData,
            createdAt: new Date(),
            createdBySync: true,
            read: false // Track read status
          });
          created++;
        } else {
          // Update existing message (but don't overwrite read status)
          const { read, ...updateData } = messageData;
          await db.collection('messages').updateOne(
            { _id: existingMessage._id },
            { $set: updateData }
          );
          updated++;
        }
        
      } catch (msgError: any) {
        console.error(`[Sync Messages] Error processing message ${ghlMsg.id}:`, msgError.message);
        skipped++;
      }
    }

    console.log(`[Sync Messages] Completed - Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    return {
      success: true,
      created,
      updated,
      skipped,
      processed: ghlMessages.length,
      hasMore: nextPage,
      lastMessageId
    };

  } catch (error: any) {
    console.error(`[Sync Messages] Error:`, error.response?.data || error.message);
    
    return {
      success: false,
      created: 0,
      updated: 0,
      skipped: 0,
      processed: 0,
      error: error.message
    };
  }
}