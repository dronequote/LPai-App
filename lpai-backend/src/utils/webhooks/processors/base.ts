// src/utils/webhooks/processors/base.ts
import { Db, ObjectId } from 'mongodb';
import { WebhookAnalytics } from '../../analytics/webhookAnalytics';

export interface ProcessorConfig {
  db: Db;
  queueType: string;
  processorName: string;
  batchSize?: number;
  maxProcessingTime?: number; // in ms
}

export interface QueueItem {
  _id: ObjectId;
  webhookId: string;
  type: string;
  payload: any;
  locationId: string;
  attempts: number;
  status: string;
  queueType: string;
  priority: number;
  receivedAt: Date;
  processingStarted?: Date;
  lastError?: string;
}

export abstract class BaseProcessor {
  protected db: Db;
  protected queueType: string;
  protected processorName: string;
  protected batchSize: number;
  protected maxProcessingTime: number;
  protected isProcessing: boolean = false;
  protected analytics: WebhookAnalytics;

  constructor(config: ProcessorConfig) {
    this.db = config.db;
    this.queueType = config.queueType;
    this.processorName = config.processorName;
    this.batchSize = config.batchSize || 50;
    this.maxProcessingTime = config.maxProcessingTime || 50000; // 50 seconds default
    this.analytics = new WebhookAnalytics(this.db);
  }

  /**
   * Start processing loop
   */
  async run(): Promise<void> {
    if (this.isProcessing) {
      console.log(`[${this.processorName}] Already processing`);
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();
    let processedCount = 0;
    let errorCount = 0;

    console.log(`[${this.processorName}] Starting processing`);

    try {
      while (this.isProcessing && (Date.now() - startTime) < this.maxProcessingTime) {
        const batch = await this.fetchBatch();
        
        if (batch.length === 0) {
          // No items to process, wait a bit
          await this.sleep(1000);
          continue;
        }

        console.log(`[${this.processorName}] Processing batch of ${batch.length} items`);

        // Process items in parallel with error handling
        const results = await Promise.allSettled(
          batch.map(item => this.processItem(item))
        );

        // Count successes and failures
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            processedCount++;
          } else {
            errorCount++;
            console.error(`[${this.processorName}] Failed to process ${batch[index].webhookId}:`, result.reason);
          }
        });

        // Check if we should continue
        if ((Date.now() - startTime) >= this.maxProcessingTime) {
          console.log(`[${this.processorName}] Max processing time reached`);
          break;
        }
      }
    } catch (error) {
      console.error(`[${this.processorName}] Fatal error in processing loop:`, error);
    } finally {
      this.isProcessing = false;
      console.log(`[${this.processorName}] Completed - Processed: ${processedCount}, Errors: ${errorCount}`);
    }
  }

  /**
   * Stop processing
   */
  stop(): void {
    console.log(`[${this.processorName}] Stopping processor`);
    this.isProcessing = false;
  }

  /**
   * Fetch batch of items to process
   */
  protected async fetchBatch(): Promise<QueueItem[]> {
    const now = new Date();
    
    // Find items ready for processing
    const items = await this.db.collection('webhook_queue')
      .find({
        queueType: this.queueType,
        status: 'pending',
        processAfter: { $lte: now },
        $or: [
          { lockedUntil: { $exists: false } },
          { lockedUntil: { $lte: now } }
        ]
      })
      .sort({ priority: 1, receivedAt: 1 })
      .limit(this.batchSize)
      .toArray();

    if (items.length === 0) {
      return [];
    }

    // Lock items for processing
    const itemIds = items.map(item => item._id);
    const lockUntil = new Date(now.getTime() + 5 * 60 * 1000); // 5 minute lock

    await this.db.collection('webhook_queue').updateMany(
      { _id: { $in: itemIds } },
      {
        $set: {
          status: 'processing',
          processingStarted: now,
          lockedUntil: lockUntil,
          processorId: this.processorName
        }
      }
    );

    return items as QueueItem[];
  }

  /**
   * Process a single item
   */
  protected async processItem(item: QueueItem): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`[${this.processorName}] Processing ${item.type} webhook ${item.webhookId}`);
      
      // Record processing started
      await this.analytics.recordProcessingStarted(item.webhookId);
      
      // Call the implementation-specific handler
      await this.handleWebhook(item);
      
      // Mark as completed
      await this.markCompleted(item);
      
      // Record processing completed
      await this.analytics.recordProcessingCompleted(item.webhookId, true);
      
      const duration = Date.now() - startTime;
      console.log(`[${this.processorName}] Completed ${item.webhookId} in ${duration}ms`);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[${this.processorName}] Error processing ${item.webhookId} after ${duration}ms:`, error);
      
      // Record processing failed
      await this.analytics.recordProcessingCompleted(item.webhookId, false, error.message);
      
      await this.markFailed(item, error);
      throw error; // Re-throw to be caught by Promise.allSettled
    }
  }

  /**
   * Abstract method - must be implemented by subclasses
   */
  protected abstract handleWebhook(item: QueueItem): Promise<void>;

  /**
   * Mark item as completed
   */
  protected async markCompleted(item: QueueItem): Promise<void> {
    await this.db.collection('webhook_queue').updateOne(
      { _id: item._id },
      {
        $set: {
          status: 'completed',
          processingCompleted: new Date(),
          processingDuration: Date.now() - (item.processingStarted?.getTime() || Date.now())
        },
        $unset: {
          lockedUntil: '',
          processorId: ''
        }
      }
    );
  }

  /**
   * Mark item as failed
   */
  protected async markFailed(item: QueueItem, error: Error): Promise<void> {
    const nextRetry = this.calculateNextRetry(item.attempts);
    
    await this.db.collection('webhook_queue').updateOne(
      { _id: item._id },
      {
        $set: {
          status: 'failed',
          lastError: error.message,
          failedAt: new Date(),
          processAfter: nextRetry
        },
        $inc: { attempts: 1 },
        $unset: {
          lockedUntil: '',
          processorId: '',
          processingStarted: ''
        }
      }
    );
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  protected calculateNextRetry(attempts: number): Date {
    const baseDelay = 60 * 1000; // 1 minute
    const maxDelay = 60 * 60 * 1000; // 1 hour
    const delay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
    return new Date(Date.now() + delay);
  }

  /**
   * Helper to sleep
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get location details
   */
  protected async getLocation(locationId: string): Promise<any> {
    return await this.db.collection('locations').findOne({ locationId });
  }

  /**
   * Get contact by GHL ID
   */
  protected async getContactByGhlId(ghlContactId: string, locationId: string): Promise<any> {
    return await this.db.collection('contacts').findOne({
      ghlContactId,
      locationId
    });
  }

  /**
   * Get or create contact
   */
  protected async getOrCreateContact(contactData: any, locationId: string): Promise<any> {
    const existing = await this.getContactByGhlId(contactData.id || contactData.contactId, locationId);
    
    if (existing) {
      return existing;
    }

    // Create new contact
    const newContact = {
      _id: new ObjectId(),
      ghlContactId: contactData.id || contactData.contactId,
      locationId,
      email: contactData.email,
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      phone: contactData.phone,
      fullName: `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
      source: 'webhook'
    };

    await this.db.collection('contacts').insertOne(newContact);
    return newContact;
  }
}