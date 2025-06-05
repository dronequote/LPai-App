// /src/utils/analytics/webhookAnalytics.ts
import { Db, ObjectId } from 'mongodb';

export interface WebhookMetrics {
  webhookId: string;
  type: string;
  queueType: string;
  locationId: string;
  
  // Timing
  receivedAt: Date;
  queuedAt: Date;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  
  // Durations (in ms)
  routingDuration: number;
  queueWaitDuration?: number;
  processingDuration?: number;
  totalDuration?: number;
  
  // Status
  status: 'success' | 'failed' | 'timeout';
  error?: string;
  attempts: number;
  
  // Performance
  exceedsSLA: boolean;
  slaTarget: number;
}

export class WebhookAnalytics {
  private db: Db;
  
  constructor(db: Db) {
    this.db = db;
  }
  
  /**
   * Record webhook arrival and routing
   */
  async recordWebhookReceived(
    webhookId: string,
    type: string,
    queueType: string,
    locationId: string
  ): Promise<void> {
    const now = new Date();
    
    await this.db.collection('webhook_metrics').insertOne({
      _id: new ObjectId(),
      webhookId,
      type,
      queueType,
      locationId,
      receivedAt: now,
      queuedAt: now,
      routingDuration: 0, // Will be updated when queued
      status: 'queued',
      attempts: 0,
      slaTarget: this.getSLATarget(queueType),
      createdAt: now
    });
  }
  
  /**
   * Update when webhook is picked up for processing
   */
  async recordProcessingStarted(webhookId: string): Promise<void> {
    const now = new Date();
    
    const metric = await this.db.collection('webhook_metrics').findOne(
      { webhookId },
      { sort: { createdAt: -1 } }
    );
    
    if (metric) {
      const queueWaitDuration = now.getTime() - new Date(metric.queuedAt).getTime();
      
      await this.db.collection('webhook_metrics').updateOne(
        { _id: metric._id },
        {
          $set: {
            processingStartedAt: now,
            queueWaitDuration,
            status: 'processing'
          },
          $inc: { attempts: 1 }
        }
      );
    }
  }
  
  /**
   * Record webhook completion
   */
  async recordProcessingCompleted(
    webhookId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    const now = new Date();
    
    const metric = await this.db.collection('webhook_metrics').findOne(
      { webhookId },
      { sort: { createdAt: -1 } }
    );
    
    if (metric && metric.processingStartedAt) {
      const processingDuration = now.getTime() - new Date(metric.processingStartedAt).getTime();
      const totalDuration = now.getTime() - new Date(metric.receivedAt).getTime();
      
      await this.db.collection('webhook_metrics').updateOne(
        { _id: metric._id },
        {
          $set: {
            processingCompletedAt: now,
            processingDuration,
            totalDuration,
            status: success ? 'success' : 'failed',
            error: error || undefined,
            exceedsSLA: totalDuration > metric.slaTarget
          }
        }
      );
    }
  }
  
  /**
   * Get SLA target in milliseconds based on queue type
   */
  private getSLATarget(queueType: string): number {
    const slaTargets: Record<string, number> = {
      'critical': 5000,      // 5 seconds
      'messages': 2000,      // 2 seconds
      'appointments': 30000, // 30 seconds
      'contacts': 60000,     // 60 seconds
      'financial': 30000,    // 30 seconds
      'general': 120000      // 2 minutes
    };
    
    return slaTargets[queueType] || 60000;
  }
  
  /**
   * Get analytics for a time period
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<any> {
    const pipeline = [
      {
        $match: {
          receivedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            queueType: '$queueType',
            status: '$status'
          },
          count: { $sum: 1 },
          avgTotalDuration: { $avg: '$totalDuration' },
          avgQueueWaitDuration: { $avg: '$queueWaitDuration' },
          avgProcessingDuration: { $avg: '$processingDuration' },
          maxTotalDuration: { $max: '$totalDuration' },
          minTotalDuration: { $min: '$totalDuration' },
          slaViolations: {
            $sum: { $cond: ['$exceedsSLA', 1, 0] }
          }
        }
      },
      {
        $group: {
          _id: '$_id.queueType',
          total: { $sum: '$count' },
          byStatus: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          avgTotalDuration: { $first: '$avgTotalDuration' },
          avgQueueWaitDuration: { $first: '$avgQueueWaitDuration' },
          avgProcessingDuration: { $first: '$avgProcessingDuration' },
          maxTotalDuration: { $first: '$maxTotalDuration' },
          minTotalDuration: { $first: '$minTotalDuration' },
          slaViolations: { $first: '$slaViolations' }
        }
      }
    ];
    
    const results = await this.db.collection('webhook_metrics')
      .aggregate(pipeline)
      .toArray();
    
    // Get top errors
    const topErrors = await this.db.collection('webhook_metrics')
      .aggregate([
        {
          $match: {
            receivedAt: { $gte: startDate, $lte: endDate },
            status: 'failed',
            error: { $exists: true }
          }
        },
        {
          $group: {
            _id: '$error',
            count: { $sum: 1 },
            types: { $addToSet: '$type' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
      .toArray();
    
    // Get slowest webhooks
    const slowestWebhooks = await this.db.collection('webhook_metrics')
      .find({
        receivedAt: { $gte: startDate, $lte: endDate },
        totalDuration: { $exists: true }
      })
      .sort({ totalDuration: -1 })
      .limit(10)
      .toArray();
    
    return {
      byQueue: results,
      topErrors,
      slowestWebhooks,
      period: {
        start: startDate,
        end: endDate
      }
    };
  }
}