import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get queue depths
    const queueStats = await db.collection('webhook_queue').aggregate([
      { $match: { status: 'pending' } },
      { $group: { 
        _id: '$queueType', 
        count: { $sum: 1 },
        oldestItem: { $min: '$queuedAt' }
      }}
    ]).toArray();

    // Get recent processing stats
    const recentMetrics = await db.collection('webhook_metrics').aggregate([
      { $match: { 
        'timestamps.processingCompleted': { 
          $gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        } 
      }},
      { $group: {
        _id: '$type',
        count: { $sum: 1 },
        avgLatency: { $avg: '$metrics.totalLatency' },
        successCount: { $sum: { $cond: ['$success', 1, 0] } }
      }}
    ]).toArray();

    // Get processor status
    const processorLogs = await db.collection('processor_logs')
      .find({ event: 'end' })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    return res.status(200).json({
      status: 'healthy',
      queues: queueStats,
      recentProcessing: recentMetrics,
      lastProcessorRuns: processorLogs,
      timestamp: new Date()
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}