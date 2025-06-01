// src/utils/sync/syncConversations.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

interface SyncOptions {
  limit?: number;
  offset?: number;
  fullSync?: boolean;
  lastMessageDate?: Date;
}

export async function syncConversations(db: Db, location: any, options: SyncOptions = {}) {
  const startTime = Date.now();
  const { limit = 50, offset = 0, fullSync = false, lastMessageDate } = options;
  
  console.log(`[Sync Conversations] Starting for ${location.locationId} - Limit: ${limit}, Offset: ${offset}`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Fetch conversations from GHL
    const response = await axios.get(
      'https://services.leadconnectorhq.com/conversations/search',
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-04-15',
          'Accept': 'application/json'
        },
        params: {
          locationId: location.locationId,
          limit,
          offset
        }
      }
    );

    const ghlConversations = response.data.conversations || [];
    const totalCount = response.data.total || ghlConversations.length;
    
    console.log(`[Sync Conversations] Found ${ghlConversations.length} conversations (Total: ${totalCount})`);

    // Process each conversation
    let created = 0;
    let updated = 0;
    let messagesCreated = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const ghlConv of ghlConversations) {
      try {
        // Find the contact for this conversation
        let contact = null;
        if (ghlConv.contactId) {
          contact = await db.collection('contacts').findOne({
            ghlContactId: ghlConv.contactId,
            locationId: location.locationId
          });
        }

        if (!contact) {
          console.warn(`[Sync Conversations] Contact not found for conversation ${ghlConv.id}, skipping`);
          skipped++;
          continue;
        }

        // Check if conversation exists
        const existingConversation = await db.collection('conversations').findOne({
          ghlConversationId: ghlConv.id,
          locationId: location.locationId
        });

        // Prepare conversation data
        const conversationData = {
          // GHL Integration
          ghlConversationId: ghlConv.id,
          locationId: location.locationId,
          
          // Basic Information
          contactId: contact._id.toString(),
          type: ghlConv.type || 'SMS', // SMS, Email, Call, etc.
          
          // Status
          unreadCount: ghlConv.unreadCount || 0,
          starred: ghlConv.starred || false,
          status: ghlConv.status || 'active',
          
          // Last Message Info
          lastMessageDate: ghlConv.lastMessageDate ? new Date(ghlConv.lastMessageDate) : null,
          lastMessageBody: ghlConv.lastMessageBody || '',
          lastMessageType: ghlConv.lastMessageType || '',
          lastMessageDirection: ghlConv.lastMessageDirection || 'inbound',
          
          // Contact Info (denormalized)
          contactName: contact.fullName || `${contact.firstName} ${contact.lastName}`.trim(),
          contactEmail: contact.email,
          contactPhone: contact.phone,
          
          // Metadata
          dateAdded: ghlConv.dateAdded ? new Date(ghlConv.dateAdded) : new Date(),
          
          // Sync Metadata
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        };

        // Find related project if exists
        const project = await db.collection('projects').findOne({
          contactId: contact._id.toString(),
          locationId: location.locationId,
          status: { $in: ['open', 'quoted', 'won'] }
        });
        
        if (project) {
          conversationData.projectId = project._id.toString();
        }

        let conversationId;
        if (existingConversation) {
          // Update existing conversation
          await db.collection('conversations').updateOne(
            { _id: existingConversation._id },
            { 
              $set: conversationData,
              $setOnInsert: { createdAt: new Date() }
            }
          );
          conversationId = existingConversation._id.toString();
          updated++;
        } else {
          // Create new conversation
          const result = await db.collection('conversations').insertOne({
            _id: new ObjectId(),
            ...conversationData,
            createdAt: new Date(),
            createdBySync: true
          });
          conversationId = result.insertedId.toString();
          created++;
        }

        // Sync messages for this conversation (if requested)
        if (fullSync || !existingConversation) {
          try {
            const messagesResponse = await axios.get(
              `https://services.leadconnectorhq.com/conversations/${ghlConv.id}/messages`,
              {
                headers: {
                  'Authorization': auth.header,
                  'Version': '2021-04-15',
                  'Accept': 'application/json'
                },
                params: {
                  limit: 50  // Get last 50 messages
                }
              }
            );

            const messages = messagesResponse.data.messages || [];
            
            for (const msg of messages) {
              // Check if message exists
              const existingMessage = await db.collection('messages').findOne({
                ghlMessageId: msg.id
              });

              if (!existingMessage) {
                await db.collection('messages').insertOne({
                  _id: new ObjectId(),
                  
                  // GHL Integration
                  ghlMessageId: msg.id,
                  ghlConversationId: ghlConv.id,
                  
                  // Relationships
                  conversationId: conversationId,
                  contactId: contact._id.toString(),
                  locationId: location.locationId,
                  projectId: project?._id.toString(),
                  
                  // Message Details
                  type: msg.type || 'SMS',
                  direction: msg.direction || 'inbound',
                  status: msg.status || 'delivered',
                  body: msg.body || '',
                  
                  // Media/Attachments
                  attachments: msg.attachments || [],
                  
                  // Metadata
                  dateAdded: msg.dateAdded ? new Date(msg.dateAdded) : new Date(),
                  
                  // User Info (if outbound)
                  userId: msg.userId || null,
                  
                  createdAt: new Date(),
                  createdBySync: true
                });
                messagesCreated++;
              }
            }
          } catch (msgError: any) {
            console.error(`[Sync Conversations] Error syncing messages for conversation ${ghlConv.id}:`, msgError.message);
          }
        }
        
      } catch (convError: any) {
        console.error(`[Sync Conversations] Error processing conversation ${ghlConv.id}:`, convError.message);
        errors.push({
          conversationId: ghlConv.id,
          error: convError.message
        });
        skipped++;
      }
    }

    // Update sync status
    await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          lastConversationSync: new Date(),
          conversationSyncStatus: {
            lastSync: new Date(),
            totalConversations: totalCount,
            synced: offset + ghlConversations.length,
            messagesCreated: messagesCreated,
            errors: errors.length
          }
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Conversations] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Messages: ${messagesCreated}, Skipped: ${skipped}`);

    // Determine if more conversations need to be synced
    const hasMore = (offset + limit) < totalCount;

    return {
      success: true,
      created,
      updated,
      messagesCreated,
      skipped,
      processed: ghlConversations.length,
      totalInGHL: totalCount,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Conversations] Error:`, error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.status === 404) {
      console.log(`[Sync Conversations] Conversations endpoint not found`);
      return {
        success: false,
        created: 0,
        updated: 0,
        messagesCreated: 0,
        skipped: 0,
        processed: 0,
        totalInGHL: 0,
        error: 'Conversations endpoint not found'
      };
    }
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied - check permissions for conversations');
    }
    
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded - too many requests');
    }
    
    throw error;
  }
}