import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { BaseProcessor } from '../../../src/utils/webhooks/processors/base';

// Custom processor with db injection
class MessagesProcessorWithDb extends BaseProcessor {
  constructor(db: any) {
    super({
      db: db,
      queueType: 'messages',
      batchSize: 50,
      maxProcessingTime: 50000,
      processorName: 'MessagesProcessor'
    });
  }

  protected async handleWebhook(item: any): Promise<void> {
    // Import the actual processor logic
    const { MessagesProcessor } = await import('../../../src/utils/webhooks/processors/messages');
    const processor = new MessagesProcessor();
    // Call the processItem method directly
    await processor['processItem'](item);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ... existing auth check ...

  const startTime = Date.now();

  try {
    // Get database connection
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // Create processor with database
    const processor = new MessagesProcessorWithDb(db);
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