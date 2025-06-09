// pages/api/cron/process-install-queue.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { cleanupExpiredLocks } from '../../../src/utils/installQueue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // Clean up expired locks
    const cleanedLocks = await cleanupExpiredLocks(db);
    console.log(`[Install Queue Cron] Cleaned ${cleanedLocks} expired locks`);
    
    // Process install retry queue
    const retryQueue = await db.collection('install_retry_queue')
      .find({
        status: 'pending',
        nextRetryAt: { $lte: new Date() },
        attempts: { $lt: 3 }
      })
      .limit(10)
      .toArray();
    
    console.log(`[Install Queue Cron] Processing ${retryQueue.length} queued installs`);
    
    const results = {
      processed: 0,
      success: 0,
      failed: 0
    };
    
    for (const item of retryQueue) {
      try {
        // Update attempt count
        await db.collection('install_retry_queue').updateOne(
          { _id: item._id },
          {
            $inc: { attempts: 1 },
            $set: { 
              status: 'processing',
              lastAttempt: new Date()
            }
          }
        );
        
        // Check if this is a SETUP_LOCATION type
        if (item.payload.type === 'SETUP_LOCATION') {
          console.log(`[Install Queue Cron] Processing location setup for ${item.payload.locationId}`);
          
          // Call setup-location endpoint directly
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app'}/api/locations/setup-location`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                locationId: item.payload.locationId,
                fullSync: item.payload.fullSync 
              })
            }
          );

          if (response.ok) {
            const result = await response.json();
            
            // Update webhook metrics if we have the original webhook ID
            if (item.payload.originalWebhookId) {
              await db.collection('webhook_metrics').updateOne(
                { webhookId: item.payload.originalWebhookId },
                { 
                  $set: { 
                    'timestamps.steps.setupCompleted': new Date(),
                    'setupResult': result
                  } 
                }
              );
            }

            // Mark as complete
            await db.collection('install_retry_queue').updateOne(
              { _id: item._id },
              {
                $set: { 
                  status: 'completed',
                  completedAt: new Date(),
                  result: result
                }
              }
            );
            
            results.success++;
            console.log(`[Install Queue Cron] Setup completed for ${item.payload.locationId}`);
          } else {
            throw new Error(`Setup failed with status ${response.status}: ${response.statusText}`);
          }
        } else {
          // For other types (INSTALL, etc), add back to main queue for CriticalProcessor
          await db.collection('webhook_queue').insertOne({
            _id: new ObjectId(),
            webhookId: item.webhookId,
            type: item.payload.type,
            payload: item.payload,
            locationId: item.payload.locationId,
            status: 'pending',
            attempts: 0,
            queueType: 'critical',
            priority: 1,
            createdAt: new Date(),
            processAfter: new Date(),
            source: 'install_retry'
          });
          
          // Mark as complete in retry queue
          await db.collection('install_retry_queue').updateOne(
            { _id: item._id },
            {
              $set: { 
                status: 'completed',
                completedAt: new Date()
              }
            }
          );
          
          results.success++;
        }
      } catch (error: any) {
        console.error(`[Install Queue Cron] Failed to process ${item.webhookId}:`, error);
        
        // Update retry time
        const nextRetry = new Date(Date.now() + (item.attempts + 1) * 60 * 1000); // Exponential backoff
        
        await db.collection('install_retry_queue').updateOne(
          { _id: item._id },
          {
            $set: { 
              status: 'pending',
              lastError: error.message,
              nextRetryAt: nextRetry
            }
          }
        );
        
        results.failed++;
      }
      
      results.processed++;
    }
    
    // Process sync queue
    const syncQueue = await db.collection('sync_queue')
      .find({
        status: 'pending',
        scheduledFor: { $lte: new Date() },
        attempts: { $lt: 3 }
      })
      .limit(5)
      .toArray();
    
    console.log(`[Install Queue Cron] Processing ${syncQueue.length} sync jobs`);
    
    for (const syncJob of syncQueue) {
      try {
        if (syncJob.type === 'agency_sync') {
          // Call the sync endpoint
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app'}/api/oauth/get-location-tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId: syncJob.companyId })
          });
          
          if (response.ok) {
            await db.collection('sync_queue').updateOne(
              { _id: syncJob._id },
              { $set: { status: 'completed', completedAt: new Date() } }
            );
          } else {
            throw new Error(`Sync failed: ${response.status}`);
          }
        }
      } catch (error: any) {
        console.error(`[Install Queue Cron] Sync failed for ${syncJob.companyId}:`, error);
        
        await db.collection('sync_queue').updateOne(
          { _id: syncJob._id },
          {
            $inc: { attempts: 1 },
            $set: {
              lastError: error.message,
              scheduledFor: new Date(Date.now() + 5 * 60 * 1000) // Retry in 5 minutes
            }
          }
        );
      }
    }
    
    return res.status(200).json({
      success: true,
      installQueue: results,
      syncQueue: syncQueue.length,
      cleanedLocks: cleanedLocks,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Install Queue Cron] Fatal error:', error);
    return res.status(500).json({
      error: 'Install queue processing failed',
      message: error.message
    });
  }
}

export const config = {
  maxDuration: 60
};