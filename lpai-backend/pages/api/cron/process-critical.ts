// pages/api/cron/process-critical.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { CriticalProcessor } from '../../../src/utils/webhooks/processors/critical';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();

  try {
    // Check if we should run (prevent overlapping)
    const client = await clientPromise;
    const db = client.db('lpai');
    
    const recentRun = await db.collection('processor_logs').findOne({
      processorName: 'CriticalProcessor',
      event: 'start',
      timestamp: { $gte: new Date(Date.now() - 30000) } // Within last 30 seconds
    });

    if (recentRun) {
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: 'Recent run detected',
        timestamp: new Date().toISOString()
      });
    }

    // Create and run processor
    const processor = new CriticalProcessor(db);
    await processor.run();

    // Check if there are more items to process
    const pendingCount = await db.collection('webhook_queue').countDocuments({
      queueType: 'critical',
      status: 'pending'
    });

    // If items remain and we finished early, trigger another run
    if (pendingCount > 0 && (Date.now() - startTime) < 45000) {
      // Self-trigger in 10 seconds
      setTimeout(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cron/process-critical`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cronSecret}`
          }
        }).catch(console.error);
      }, 10000);
    }

    const runtime = Date.now() - startTime;
    
    return res.status(200).json({
      success: true,
      processor: 'critical',
      runtime: `${(runtime / 1000).toFixed(1)}s`,
      pendingItems: pendingCount,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Critical Cron] Fatal error:', error);
    
    return res.status(500).json({
      error: 'Critical processor failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export const config = {
  maxDuration: 60
};