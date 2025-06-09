// src/utils/webhooks/queueManager.ts
import { Db, ObjectId } from 'mongodb';
import { generateTrackingId } from './router';

export interface QueueItem {
  _id?: ObjectId;
  webhookId: string;
  trackingId: string;
  
  // Routing
  type: string;
  queueType: string;
  priority: number;
  
  // Payload
  payload: any;
  locationId: string;
  companyId?: string;
  
  // Processing
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead';
  attempts: number;
  maxAttempts: number;
  
  // Timing
  receivedAt: Date;
  queuedAt: Date;
  processAfter: Date;
  processingStarted?: Date;
  processingCompleted?: Date;
  
  // Locking
  lockedUntil?: Date;
  processorId?: string;
  
  // Error tracking
  lastError?: string;
  errors?: Array<{
    attempt: number;
    error: string;
    timestamp: Date;
  }>;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  ttl: Date;
}

export class QueueManager {
  private db: Db;
  
  constructor(db: Db) {
    this.db = db;
  }
  
  /**
   * Add webhook to queue with full tracking
   */
  async addToQueue(params: {
    webhookId: string;
    type: string;
    queueType: string;
    priority: number;
    payload: any;
    receivedAt?: Date;
  }): Promise<QueueItem> {
    const now = new Date();
    const trackingId = generateTrackingId();
    
    // Extract IDs from payload
    const locationId = params.payload.locationId || 
                      params.payload.location?.id || 
                      '';
    const companyId = params.payload.companyId || 
                     params.payload.company?.id || 
                     '';
    
    const queueItem: QueueItem = {
      webhookId: params.webhookId,
      trackingId,
      
      // Routing
      type: params.type,
      queueType: params.queueType,
      priority: params.priority,
      
      // Payload
      payload: params.payload,
      locationId,
      companyId,
      
      // Processing
      status: 'pending',
      attempts: 0,
      maxAttempts: params.queueType === 'critical' ? 5 : 3,
      
      // Timing
      receivedAt: params.receivedAt || now,
      queuedAt: now,
      processAfter: now, // Process immediately unless retry
      
      // Metadata
      createdAt: now,
      updatedAt: now,
      ttl: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    try {
      // Insert into queue
      const result = await this.db.collection('webhook_queue').insertOne(queueItem);
      queueItem._id = result.insertedId;
      
      // Start metrics tracking
      await this.startMetricsTracking(queueItem);
      
      console.log(`[Queue] Added ${params.type} to ${params.queueType} queue with priority ${params.priority}`);
      
      return queueItem;
      
    } catch (error: any) {
      // Handle duplicate webhook ID
      if (error.code === 11000) {
        console.log(`[Queue] Duplicate webhook ${params.webhookId}, skipping`);
        throw new Error('DUPLICATE_WEBHOOK');
      }
      throw error;
    }
  }
  
  /**
   * Get next batch of items to process
   */
  async getNextBatch(queueType: string, batchSize: number = 50): Promise<QueueItem[]> {
    const now = new Date();
    const processorId = `${queueType}_${process.env.VERCEL_REGION || 'local'}_${Date.now()}`;
    const lockDuration = 5 * 60 * 1000; // 5 minutes
    
    // Find and lock items
    const items = await this.db.collection('webhook_queue').find({
      queueType,
      status: 'pending',
      processAfter: { $lte: now },
      $or: [
        { lockedUntil: { $exists: false } },
        { lockedUntil: { $lte: now } }
      ]
    })
    .sort({ priority: 1, queuedAt: 1 }) // Priority first, then FIFO
    .limit(batchSize)
    .toArray();
    
    if (items.length === 0) {
      return [];
    }
    
    // Lock all items
    const itemIds = items.map(item => item._id);
    const lockedUntil = new Date(now.getTime() + lockDuration);
    
    await this.db.collection('webhook_queue').updateMany(
      { _id: { $in: itemIds } },
      {
        $set: {
          lockedUntil,
          processorId,
          status: 'processing',
          processingStarted: now,
          updatedAt: now
        },
        $inc: { attempts: 1 }
      }
    );
    
    // Update metrics
    await this.db.collection('webhook_metrics').updateMany(
      { webhookId: { $in: items.map(i => i.webhookId) } },
      {
        $set: {
          'timestamps.processingStarted': now,
          processorId
        }
      }
    );
    
    return items as QueueItem[];
  }
  
  /**
   * Mark item as successfully completed
   */
    async markComplete(webhookId: string): Promise<void> {
      const now = new Date();
      
      const result = await this.db.collection('webhook_queue').findOneAndUpdate(
        { webhookId },
        {
          $set: {
            status: 'completed',
            processingCompleted: now,
            updatedAt: now
          },
          $unset: {
            lockedUntil: '',
            processorId: ''
          }
        },
        { returnDocument: 'after' }
      );
      
      // Fix: Check both result and result.value
      if (result && result.value) {
        await this.completeMetrics(result.value as QueueItem, true);
      } else {
        console.warn(`[QueueManager] Webhook ${webhookId} not found when marking complete - may have been processed by another worker`);
      }
    }
      
  /**
   * Mark item as failed and schedule retry
   */
  async markFailed(webhookId: string, error: string): Promise<void> {
    const now = new Date();
    
    const item = await this.db.collection('webhook_queue').findOne({ webhookId });
    if (!item) return;
    
    const attempts = item.attempts || 1;
    const maxAttempts = item.maxAttempts || 3;
    
    // Calculate exponential backoff
    const retryDelays = [
      1 * 60 * 1000,    // 1 minute
      5 * 60 * 1000,    // 5 minutes
      15 * 60 * 1000,   // 15 minutes
      60 * 60 * 1000,   // 1 hour
      24 * 60 * 60 * 1000 // 24 hours
    ];
    const delayIndex = Math.min(attempts - 1, retryDelays.length - 1);
    const retryDelay = retryDelays[delayIndex];
    
    const processAfter = new Date(now.getTime() + retryDelay);
    const status = attempts >= maxAttempts ? 'dead' : 'pending';
    
    await this.db.collection('webhook_queue').updateOne(
      { webhookId },
      {
        $set: {
          status,
          lastError: error,
          processAfter,
          processingCompleted: now,
          updatedAt: now
        },
        $unset: {
          lockedUntil: '',
          processorId: ''
        },
        $push: {
          errors: {
            attempt: attempts,
            error: error.substring(0, 1000), // Limit error message size
            timestamp: now
          }
        }
      }
    );
    
    await this.completeMetrics(item as QueueItem, false, error);
    
    if (status === 'dead') {
      console.error(`[Queue] Webhook ${webhookId} marked as dead after ${attempts} attempts`);
      // TODO: Send alert for dead letter queue
    }
  }
  
  /**
   * Start tracking metrics for queued item
   */
  private async startMetricsTracking(item: QueueItem): Promise<void> {
    const queueLatency = item.queuedAt.getTime() - item.receivedAt.getTime();
    
    await this.db.collection('webhook_metrics').insertOne({
      _id: new ObjectId(),
      webhookId: item.webhookId,
      trackingId: item.trackingId,
      
      // Classification
      type: item.type,
      queueType: item.queueType,
      locationId: item.locationId,
      companyId: item.companyId,
      priority: item.priority,
      
      // Timing
      timestamps: {
        webhookReceived: item.receivedAt,
        routerReceived: item.receivedAt, // Could be different if we add more hops
        queueAdded: item.queuedAt
      },
      
      // Initial metrics
      metrics: {
        queueLatency
      },
      
      // Status
      success: null,
      attempts: 0,
      createdAt: new Date()
    });
  }
  
  /**
   * Complete metrics tracking
   */
  private async completeMetrics(item: QueueItem, success: boolean, error?: string): Promise<void> {
    const processingTime = item.processingCompleted && item.processingStarted
      ? item.processingCompleted.getTime() - item.processingStarted.getTime()
      : 0;
    
    const queueWaitTime = item.processingStarted && item.queuedAt
      ? item.processingStarted.getTime() - item.queuedAt.getTime()
      : 0;
    
    const totalLatency = item.processingCompleted && item.receivedAt
      ? item.processingCompleted.getTime() - item.receivedAt.getTime()
      : 0;
    
    // Determine performance grade
    let grade = 'F';
    if (totalLatency < 1000) grade = 'A+';
    else if (totalLatency < 5000) grade = 'A';
    else if (totalLatency < 10000) grade = 'B';
    else if (totalLatency < 30000) grade = 'C';
    else if (totalLatency < 60000) grade = 'D';
    
    await this.db.collection('webhook_metrics').updateOne(
      { webhookId: item.webhookId },
      {
        $set: {
          'timestamps.processingCompleted': item.processingCompleted,
          'metrics.processingTime': processingTime,
          'metrics.queueWaitTime': queueWaitTime,
          'metrics.totalLatency': totalLatency,
          'performance.grade': grade,
          'performance.exceedsSLA': totalLatency > 60000,
          success,
          error,
          attempts: item.attempts,
          updatedAt: new Date()
        }
      }
    );
  }
  
  /**
   * Get queue depth for monitoring
   */
  async getQueueDepth(queueType?: string): Promise<any> {
    const match = queueType ? { queueType, status: 'pending' } : { status: 'pending' };
    
    return await this.db.collection('webhook_queue').aggregate([
      { $match: match },
      { $group: {
        _id: '$queueType',
        count: { $sum: 1 },
        oldestItem: { $min: '$queuedAt' }
      }}
    ]).toArray();
  }
}