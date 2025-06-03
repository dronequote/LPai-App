// src/utils/sync/syncConversations.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';
import { syncMessages } from './syncMessages'; // New import

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
    
    // Fetch conversations from GHL - matching your exact request
    const response = await axios.get(
      'https://services.leadconnectorhq.com/conversations/search',
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-04-15', // Matching your version
          'Accept': 'application/json'
        },
        params: {
          locationId: location.locationId,
          limit,
          status: 'all' // Matching your params
        }
      }
    );

    const ghlConversations = response.data.conversations || [];
    const totalCount = response.data.total || ghlConversations.length;
    
    console.log(`[Sync Conversations] Found ${ghlConversations.length} conversations (Total: ${totalCount})`);

    // Process each conversation
    let created = 0;
    let updated = 0;
    let messagesProcessed = 0;
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

        // Prepare conversation data - matching GHL response structure
        const conversationData = {
          // GHL Integration
          ghlConversationId: ghlConv.id,
          locationId: location.locationId,
          
          // Basic Information
          contactId: contact._id.toString(),
          type: ghlConv.type, // TYPE_PHONE, TYPE_EMAIL, etc.
          
          // Status
          unreadCount: ghlConv.unreadCount || 0,
          inbox: ghlConv.inbox || false,
          starred: ghlConv.starred || false,
          
          // Last Message Info - Store preview only
          lastMessageDate: ghlConv.lastMessageDate ? new Date(ghlConv.lastMessageDate) : null,
          lastMessageBody: ghlConv.lastMessageBody || '', // This is just preview
          lastMessageType: ghlConv.lastMessageType || '',
          lastMessageDirection: ghlConv.lastMessageDirection || 'inbound',
          
          // Contact Info (denormalized)
          contactName: ghlConv.contactName || ghlConv.fullName || contact.fullName,
          contactEmail: contact.email,
          contactPhone: contact.phone,
          
          // GHL Metadata
          dateAdded: ghlConv.dateAdded ? new Date(ghlConv.dateAdded) : new Date(),
          dateUpdated: ghlConv.dateUpdated ? new Date(ghlConv.dateUpdated) : new Date(),
          
          // Additional fields from GHL
          attributed: ghlConv.attributed || false,
          scoring: ghlConv.scoring || [],
          followers: ghlConv.followers || [],
          tags: ghlConv.tags || [],
          
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

        // Sync messages for this conversation
        // Pass the conversation data to avoid re-fetching
        const messageResult = await syncMessages(db, location, {
          conversationId: conversationId,
          ghlConversationId: ghlConv.id,
          contactId: contact._id.toString(),
          projectId: project?._id.toString(),
          limit: fullSync ? 50 : 20, // Get more messages on full sync
          auth: auth // Pass auth to avoid re-fetching
        });

        messagesProcessed += messageResult.processed || 0;
        
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
            messagesProcessed: messagesProcessed,
            errors: errors.length
          }
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Conversations] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Messages: ${messagesProcessed}, Skipped: ${skipped}`);

    // Determine if more conversations need to be synced
    const hasMore = (offset + limit) < totalCount;

    return {
      success: true,
      created,
      updated,
      messagesProcessed,
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
        messagesProcessed: 0,
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