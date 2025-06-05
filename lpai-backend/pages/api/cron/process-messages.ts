// pages/api/cron/process-messages.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { MessagesProcessor } from '../../../src/utils/webhooks/processors/messages';

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
    // Get database connection
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // Create and run processor with database
    const processor = new MessagesProcessor(db);
    await processor.run();

    const runtime = Date.now() - startTime;
    
    return res.status(200).json({
      success: true,
      processor: 'messages',
      runtime: `${(runtime / 1000).toFixed(1)}s`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Messages Cron] Fatal error:', error);
    
    return res.status(500).json({
      error: 'Messages processor failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export const config = {
  maxDuration: 60
};