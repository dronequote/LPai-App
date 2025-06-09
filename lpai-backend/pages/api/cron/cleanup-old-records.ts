import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

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
    
    const results = {
      webhook_queue: 0,
      install_locks: 0,
      install_retry_queue: 0
    };

    // 1. Clean old webhook_queue entries (older than 7 days)
    const webhookResult = await db.collection('webhook_queue').deleteMany({
      status: { $in: ['completed', 'failed'] },
      createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    results.webhook_queue = webhookResult.deletedCount;

    // 2. Clean expired install_locks (older than 1 hour)
    const lockResult = await db.collection('install_locks').deleteMany({
      expiresAt: { $lt: new Date() }
    });
    results.install_locks = lockResult.deletedCount;

    // 3. Clean old install_retry_queue entries (completed or failed after 30 days)
    const retryResult = await db.collection('install_retry_queue').deleteMany({
      status: { $in: ['completed', 'failed'] },
      createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
    results.install_retry_queue = retryResult.deletedCount;

    console.log(`[Cleanup Cron] Cleaned up old records:`, results);

    return res.status(200).json({
      success: true,
      cleaned: results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Cleanup Cron] Error:', error);
    return res.status(500).json({
      error: 'Cleanup failed',
      message: error.message
    });
  }
}

export const config = {
  maxDuration: 60
};