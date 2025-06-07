// src/utils/sync/syncConversations.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';
import { syncMessages } from './syncMessages';

interface SyncOptions {
  limit?: number;
  offset?: number;
  fullSync?: boolean;
  lastMessageDate?: Date;
}

// Circuit breaker state
let consecutiveFailures = 0;
const MAX_FAILURES = 3;

export async function syncConversations(db: Db, location: any, options: SyncOptions = {}) {
  const startTime = Date.now();
  const { limit = 50, offset = 0, fullSync = false, lastMessageDate } = options;
  
  console.log(`[Sync Conversations] Starting for ${location.locationId} - Limit: ${limit}, Offset: ${offset}`);

  // Circuit breaker check
  if (consecutiveFailures >= MAX_FAILURES) {
    console.error(`[Sync Conversations] Circuit breaker open - too many failures`);
    return {
      success: false,
      error: 'Too many consecutive failures, sync paused',
      circuitBreakerOpen: true
    };
  }

  // If fullSync requested, handle pagination automatically (like contacts)
  if (fullSync && offset === 0) {
    console.log(`[Sync Conversations] Full sync requested - will fetch all conversations in batches`);
    
    // Configuration
    const BATCH_SIZE = 50; // Conversations per API request
    const PARALLEL_PROCESS = 5; // Process 5 conversations at once
    const MAX_REQUESTS = 40; // 40 requests = 2000 conversations max per run
    const MAX_DURATION = 55000; // 55 seconds
    const DELAY_BETWEEN_BATCHES = 200; // 200ms between API calls
    
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalMessagesProcessed = 0;
    let currentOffset = 0;
    let hasMoreData = true;
    let requestCount = 0;
    const syncStartTime = Date.now();
    const allErrors: any[] = [];
    
    // Update sync status to show it's starting
    await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          syncProgress: {
            conversations: {
              status: 'syncing',
              current: 0,
              total: 0,
              percent: 0,
              startedAt: new Date()
            }
          }
        }
      }
    );
    
    while (hasMoreData) {
      requestCount++;
      
      // Safety checks
      if (requestCount >= MAX_REQUESTS || Date.now() - syncStartTime > MAX_DURATION) {
        console.log(`[Sync Conversations] Stopping - limit reached (${requestCount} requests)`);
        
        const totalDuration = Date.now() - startTime;
        return {
          success: true,
          created: totalCreated,
          updated: totalUpdated,
          skipped: totalSkipped,
          messagesProcessed: totalMessagesProcessed,
          processed: totalCreated + totalUpdated + totalSkipped,
          hasMore: true,
          partial: true,
          nextOffset: currentOffset,
          message: `Synced ${totalCreated + totalUpdated} conversations. More available - will continue in next run.`,
          errors: allErrors.length > 0 ? allErrors : undefined,
          duration: `${totalDuration}ms`
        };
      }
      
      console.log(`[Sync Conversations] Fetching batch ${requestCount} (offset: ${currentOffset})...`);
      
      const batchResult = await syncConversations(db, location, {
        limit: BATCH_SIZE,
        offset: currentOffset,
        fullSync: false // Prevent recursion
      });
      
      totalCreated += batchResult.created;
      totalUpdated += batchResult.updated;
      totalSkipped += batchResult.skipped;
      totalMessagesProcessed += batchResult.messagesProcessed;
      
      if (batchResult.errors) {
        allErrors.push(...batchResult.errors);
      }
      
      // Update progress
      const totalProcessed = totalCreated + totalUpdated + totalSkipped;
      const estimatedTotal = batchResult.totalInGHL || totalProcessed;
      const percentComplete = estimatedTotal > 0 ? Math.round((totalProcessed / estimatedTotal) * 100) : 0;
      
      await db.collection('locations').updateOne(
        { _id: location._id },
        {
          $set: {
            'syncProgress.conversations': {
              status: 'syncing',
              current: totalProcessed,
              total: estimatedTotal,
              percent: percentComplete,
              created: totalCreated,
              updated: totalUpdated,
              messagesProcessed: totalMessagesProcessed,
              startedAt: new Date(syncStartTime)
            }
          }
        }
      );
      
      // Check if more data exists
      hasMoreData = batchResult.hasMore || false;
      if (batchResult.processed === 0) {
        hasMoreData = false;
      }
      
      currentOffset += BATCH_SIZE;
      
      // Rate limit delay
      if (hasMoreData) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Mark as complete
    await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          'syncProgress.conversations.status': 'complete',
          'syncProgress.conversations.completedAt': new Date()
        }
      }
    );
    
    const totalDuration = Date.now() - startTime;
    console.log(`[Sync Conversations] Full sync completed in ${totalDuration}ms`);
    
    return {
      success: true,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      messagesProcessed: totalMessagesProcessed,
      processed: totalCreated + totalUpdated + totalSkipped,
      hasMore: false,
      errors: allErrors.length > 0 ? allErrors : undefined,
      duration: `${totalDuration}ms`,
      fullSyncCompleted: true,
      totalRequests: requestCount
    };
  }

  try {
    // Get auth header
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
          status: 'all'
        }
      }
    );

    const ghlConversations = response.data.conversations || [];
    const totalCount = response.data.total || ghlConversations.length;
    
    console.log(`[Sync Conversations] Found ${ghlConversations.length} conversations (Total: ${totalCount})`);

    // Reset circuit breaker on successful fetch
    consecutiveFailures = 0;

    // Process conversations in parallel batches
    const PARALLEL_BATCH_SIZE = 5;
    let created = 0;
    let updated = 0;
    let messagesProcessed = 0;
    let skipped = 0;
    const errors: any[] = [];

    // Process in chunks for parallel execution
    for (let i = 0; i < ghlConversations.length; i += PARALLEL_BATCH_SIZE) {
      const chunk = ghlConversations.slice(i, i + PARALLEL_BATCH_SIZE);
      
      const results = await Promise.allSettled(
        chunk.map(async (ghlConv) => {
          try {
            // Find the contact
            let contact = null;
            if (ghlConv.contactId) {
              contact = await db.collection('contacts').findOne({
                ghlContactId: ghlConv.contactId,
                locationId: location.locationId
              });
            }

            if (!contact) {
              console.warn(`[Sync Conversations] Contact not found for conversation ${ghlConv.id}`);
              return { type: 'skipped', reason: 'Contact not found' };
            }

            // Check if conversation exists
            const existingConversation = await db.collection('conversations').findOne({
              ghlConversationId: ghlConv.id,
              locationId: location.locationId
            });

            // Skip if unchanged
            if (existingConversation && 
                existingConversation.lastMessageDate?.getTime() === new Date(ghlConv.lastMessageDate).getTime()) {
              return { type: 'skipped', reason: 'No changes' };
            }

            // Prepare conversation data
            const conversationData = {
              ghlConversationId: ghlConv.id,
              locationId: location.locationId,
              contactId: contact._id.toString(),
              type: ghlConv.type,
              unreadCount: ghlConv.unreadCount || 0,
              inbox: ghlConv.inbox || false,
              starred: ghlConv.starred || false,
              lastMessageDate: ghlConv.lastMessageDate ? new Date(ghlConv.lastMessageDate) : null,
              lastMessageBody: ghlConv.lastMessageBody || '',
              lastMessageType: ghlConv.lastMessageType || '',
              lastMessageDirection: ghlConv.lastMessageDirection || 'inbound',
              contactName: ghlConv.contactName || contact.fullName,
              contactEmail: contact.email,
              contactPhone: contact.phone,
              dateAdded: ghlConv.dateAdded ? new Date(ghlConv.dateAdded) : new Date(),
              dateUpdated: ghlConv.dateUpdated ? new Date(ghlConv.dateUpdated) : new Date(),
              attributed: ghlConv.attributed || false,
              scoring: ghlConv.scoring || [],
              followers: ghlConv.followers || [],
              tags: ghlConv.tags || [],
              lastSyncedAt: new Date(),
              updatedAt: new Date()
            };

            // Find related project
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
              const result = await db.collection('conversations').insertOne({
                _id: new ObjectId(),
                ...conversationData,
                createdAt: new Date(),
                createdBySync: true
              });
              conversationId = result.insertedId.toString();
              created++;
            }

            // Sync messages (reduced limit for speed)
            const messageResult = await syncMessages(db, location, {
              conversationId: conversationId,
              ghlConversationId: ghlConv.id,
              contactId: contact._id.toString(),
              projectId: project?._id.toString(),
              limit: fullSync ? 20 : 10,
              auth: auth
            });

            const msgCount = messageResult.processed || 0;
            
            return { 
              type: existingConversation ? 'updated' : 'created',
              messagesProcessed: msgCount
            };
            
          } catch (convError: any) {
            console.error(`[Sync Conversations] Error:`, convError.message);
            return {
              type: 'error',
              error: {
                conversationId: ghlConv.id,
                error: convError.message
              }
            };
          }
        })
      );

      // Count results
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          const value = result.value;
          if (value.type === 'created') {
            messagesProcessed += value.messagesProcessed || 0;
          } else if (value.type === 'updated') {
            messagesProcessed += value.messagesProcessed || 0;
          } else if (value.type === 'skipped') {
            skipped++;
          } else if (value.type === 'error') {
            errors.push(value.error);
            skipped++;
          }
        } else {
          skipped++;
          errors.push({
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      // Small delay between batches
      if (i + PARALLEL_BATCH_SIZE < ghlConversations.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
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
    console.log(`[Sync Conversations] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Messages: ${messagesProcessed}`);

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
    
    consecutiveFailures++;
    
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded - too many requests');
    }
    
    throw error;
  }
}