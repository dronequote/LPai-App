// pages/api/cron/process-webhooks.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { processWebhook } from '../../../src/utils/webhookProcessor';
import { processNativeWebhook } from '../../../src/utils/webhooks/nativeWebhookProcessor';
import { shouldProcessWebhook } from '../../../src/utils/deduplication';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const startTime = Date.now();
  
  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // Process batch of webhooks
    const webhooks = await db.collection('webhook_queue')
      .find({
        status: 'pending',
        processAfter: { $lte: new Date() },
        attempts: { $lt: 3 } // Max 3 attempts
      })
      .sort({ createdAt: 1 }) // Process oldest first
      .limit(50) // Process 50 at a time
      .toArray();
    
    console.log(`[Cron] Processing ${webhooks.length} webhooks`);
    
    // Process webhooks in parallel with error handling
    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        // Additional deduplication check
        const shouldProcess = await shouldProcessWebhook(db, webhook.payload);
        if (!shouldProcess) {
          // Mark as skipped
          await db.collection('webhook_queue').updateOne(
            { _id: webhook._id },
            { 
              $set: { 
                status: 'skipped',
                completedAt: new Date(),
                skipReason: 'Duplicate or invalid webhook'
              } 
            }
          );
          return { skipped: true };
        }
        
        // Route to appropriate processor based on source
        if (webhook.source === 'native') {
          // Use native webhook processor for marketplace app webhooks
          return processNativeWebhook(db, webhook);
        } else {
          // Use old processor for workflow webhooks (can remove later)
          return processWebhook(db, webhook);
        }
      })
    );
    
    // Count results
    const processed = results.length;
    const success = results.filter(r => r.status === 'fulfilled' && !r.value?.skipped).length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const skipped = results.filter(r => r.status === 'fulfilled' && r.value?.skipped).length;
    
    // Clean up old completed webhooks (older than 24 hours)
    const cleanupResult = await db.collection('webhook_queue').deleteMany({
      status: { $in: ['completed', 'skipped'] },
      completedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    // Clean up old webhook logs (older than 7 days) - optional
    await db.collection('webhook_logs').deleteMany({
      receivedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    // Log any failures for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[Cron] Webhook ${webhooks[index].webhookId} failed:`, result.reason);
      }
    });
    
    const processingTime = Date.now() - startTime;
    
    // Log cron run stats
    if (processed > 0) {
      console.log(`[Cron] Processed ${processed} webhooks: ${success} success, ${failed} failed, ${skipped} skipped`);
    }
    
    return res.status(200).json({
      processed,
      success,
      failed,
      skipped,
      cleaned: cleanupResult.deletedCount,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Cron] Fatal error in webhook processor:', error);
    
    return res.status(500).json({
      error: 'Internal error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
}

// Extend timeout for Vercel
export const config = {
  maxDuration: 60 // 60 seconds max
};