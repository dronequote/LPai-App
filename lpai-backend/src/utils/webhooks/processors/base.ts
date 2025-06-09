// src/utils/webhooks/processors/base.ts
import { Db, MongoClient } from 'mongodb';
import { QueueManager, QueueItem } from '../queueManager';
import clientPromise from '../../../lib/mongodb';
import { WebhookAnalytics } from '../../analytics/webhookAnalytics';

export interface ProcessorConfig {
  queueType: string;
  batchSize: number;
  maxRuntime?: number;
  maxProcessingTime?: number;
  processorName: string;
}


export abstract class BaseProcessor {
  protected db: Db;
  protected client: MongoClient;
  protected queueManager: QueueManager;
  protected config: ProcessorConfig;
  protected processorId: string;
  protected startTime: number;
  protected processedCount: number = 0;
  protected errorCount: number = 0;
  protected webhookAnalytics: WebhookAnalytics;

  constructor(config: ProcessorConfig, db?: Db) {
    console.log(`[${config.processorName}] Constructor called with db: ${db ? 'provided' : 'not provided'}`);
    
    this.config = config;
    
    // Handle both maxRuntime and maxProcessingTime
    if (!this.config.maxRuntime && this.config.maxProcessingTime) {
      this.config.maxRuntime = this.config.maxProcessingTime;
    }
    // Default to 50 seconds if not specified
    this.config.maxRuntime = this.config.maxRuntime || 50000;
    
    this.processorId = `${config.processorName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = Date.now();
    
    // Store db if provided
    if (db) {
      this.db = db;
      console.log(`[${this.config.processorName}] Database connection stored in constructor`);
    }
    
    console.log(`[${this.config.processorName}] Processor created with ID: ${this.processorId}`);
  }
  

  /**
   * Initialize database connection
   */
  protected async initialize(): Promise<void> {
    console.log(`[${this.config.processorName}] Starting initialization...`);
    
    try {
      // Only initialize if db wasn't provided in constructor
      if (!this.db) {
        console.log(`[${this.config.processorName}] No database provided, creating new connection...`);
        const client = await clientPromise;
        this.client = client;
        this.db = client.db('lpai');
        console.log(`[${this.config.processorName}] Database connection established`);
      } else {
        console.log(`[${this.config.processorName}] Using provided database connection`);
        // If db was provided, get client from it
        this.client = this.db.client as MongoClient;
      }
      
      console.log(`[${this.config.processorName}] Creating QueueManager...`);
      this.queueManager = new QueueManager(this.db);
      this.webhookAnalytics = new WebhookAnalytics(this.db);
      console.log(`[${this.config.processorName}] Initialization complete - Processor ${this.processorId} ready`);
    } catch (error) {
      console.error(`[${this.config.processorName}] Failed to initialize:`, error);
      throw error;
    }
  }

  /**
   * Main processing loop
   */
  async run(): Promise<void> {
    console.log(`[${this.config.processorName}] Starting run() method...`);
    
    try {
      await this.initialize();

      // Log processor start
      console.log(`[${this.config.processorName}] Logging processor start...`);
      await this.logProcessorStart();
      
      console.log(`[${this.config.processorName}] Entering processing loop...`);
      
      // Process until timeout
      while (this.shouldContinue()) {
        const remainingTime = this.config.maxRuntime! - (Date.now() - this.startTime);
        console.log(`[${this.config.processorName}] Fetching next batch (${Math.round(remainingTime / 1000)}s remaining)...`);
        
        const items = await this.queueManager.getNextBatch(
          this.config.queueType,
          this.config.batchSize
        );
        
        if (items.length === 0) {
          console.log(`[${this.config.processorName}] No items to process, sleeping for 1s...`);
          await this.sleep(1000);
          continue;
        }
        
        console.log(`[${this.config.processorName}] Retrieved ${items.length} items to process`);
        
        // Process batch
        await this.processBatch(items);
        
        // Check if we should yield to prevent hogging resources
        if (this.processedCount % 100 === 0 && this.processedCount > 0) {
          console.log(`[${this.config.processorName}] Processed ${this.processedCount} items, yielding...`);
          await this.sleep(100); // Brief pause every 100 items
        }
      }
      
      console.log(`[${this.config.processorName}] Processing loop ended, logging completion...`);
      
      // Log processor completion
      await this.logProcessorEnd();
      
    } catch (error: any) {
      console.error(`[${this.config.processorName}] Fatal error in run():`, error);
      console.error(`[${this.config.processorName}] Error stack:`, error.stack);
      await this.logProcessorError(error);
      throw error;
    }
  }

  /**
   * Process a batch of items
   */
  protected async processBatch(items: QueueItem[]): Promise<void> {
    console.log(`[${this.config.processorName}] Processing batch of ${items.length} items`);
    console.log(`[${this.config.processorName}] Item types: ${items.map(i => i.type).join(', ')}`);

    // Process items in parallel with concurrency limit
    const concurrency = 5;
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      console.log(`[${this.config.processorName}] Processing sub-batch ${i / concurrency + 1} with ${batch.length} items`);
      
      await Promise.all(
        batch.map(item => this.processItemSafe(item))
      );
    }
    
    console.log(`[${this.config.processorName}] Batch processing complete`);
  }

  /**
   * Process single item with error handling
   */
  protected async processItemSafe(item: QueueItem): Promise<void> {
    const itemStartTime = Date.now();
    console.log(`[${this.config.processorName}] Processing item ${item.webhookId} (${item.type})`);
    
    try {
      // Record when processing starts
      await this.webhookAnalytics.recordProcessingStarted(item.webhookId);
      
      // Call the implementation-specific processing
      await this.processItem(item);
      
      // Mark as complete
      console.log(`[${this.config.processorName}] Marking ${item.webhookId} as complete...`);
      await this.queueManager.markComplete(item.webhookId);
      await this.queueManager.markComplete(item._id);
      
      // Record successful completion
      await this.webhookAnalytics.recordProcessingCompleted(item.webhookId, true);

      this.processedCount++;
      
      const duration = Date.now() - itemStartTime;
      console.log(`[${this.config.processorName}] Successfully processed ${item.type} (${item.webhookId}) in ${duration}ms`);
      
    } catch (error: any) {
      this.errorCount++;
      
      console.error(`[${this.config.processorName}] Error processing ${item.webhookId}:`, error);
      console.error(`[${this.config.processorName}] Error stack:`, error.stack);
      
      // Record failure
      await this.webhookAnalytics.recordProcessingCompleted(
        item.webhookId, 
        false, 
        error.message || 'Unknown error'
      );
      
      // Mark as failed with retry
      console.log(`[${this.config.processorName}] Marking ${item.webhookId} as failed...`);
      await this.queueManager.markFailed(
        item.webhookId,
        error.message || 'Unknown error'
      );
      
      // Log specific error for monitoring
      await this.logItemError(item, error);
    }
  }

  /**
   * Abstract method - must be implemented by subclasses
   */
  protected abstract processItem(item: QueueItem): Promise<void>;

  /**
   * Check if processor should continue running
   */
  protected shouldContinue(): boolean {
    const runtime = Date.now() - this.startTime;
    const shouldContinue = runtime < this.config.maxRuntime!;
    
    if (!shouldContinue) {
      console.log(`[${this.config.processorName}] Max runtime reached (${runtime}ms >= ${this.config.maxRuntime}ms)`);
    }
    
    return shouldContinue;
  }

  /**
   * Helper sleep function
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log processor start
   */
  protected async logProcessorStart(): Promise<void> {
    console.log(`[${this.config.processorName}] Writing processor start log to database...`);
    
    try {
      await this.db.collection('processor_logs').insertOne({
        processorId: this.processorId,
        processorName: this.config.processorName,
        queueType: this.config.queueType,
        event: 'start',
        timestamp: new Date(),
        metadata: {
          batchSize: this.config.batchSize,
          maxRuntime: this.config.maxRuntime
        }
      });
      
      console.log(`[${this.config.processorName}] Processor start logged successfully`);
    } catch (error) {
      console.error(`[${this.config.processorName}] Failed to log processor start:`, error);
    }
  }

  /**
   * Log processor end
   */
  protected async logProcessorEnd(): Promise<void> {
    const runtime = Date.now() - this.startTime;
    
    console.log(`[${this.config.processorName}] Writing processor end log to database...`);
    
    try {
      await this.db.collection('processor_logs').insertOne({
        processorId: this.processorId,
        processorName: this.config.processorName,
        queueType: this.config.queueType,
        event: 'end',
        timestamp: new Date(),
        metadata: {
          runtime,
          processedCount: this.processedCount,
          errorCount: this.errorCount,
          averageTime: this.processedCount > 0 ? runtime / this.processedCount : 0,
          successRate: this.processedCount > 0 
            ? ((this.processedCount - this.errorCount) / this.processedCount) * 100 
            : 0
        }
      });
      
      console.log(`[${this.config.processorName}] Processor end logged successfully`);
    } catch (error) {
      console.error(`[${this.config.processorName}] Failed to log processor end:`, error);
    }
    
    console.log(`[${this.config.processorName}] === PROCESSOR SUMMARY ===`);
    console.log(`[${this.config.processorName}] Processed: ${this.processedCount} items`);
    console.log(`[${this.config.processorName}] Errors: ${this.errorCount}`);
    console.log(`[${this.config.processorName}] Runtime: ${(runtime / 1000).toFixed(1)}s`);
    console.log(`[${this.config.processorName}] Rate: ${(this.processedCount / (runtime / 1000)).toFixed(1)}/sec`);
    console.log(`[${this.config.processorName}] ========================`);
  }

  /**
   * Log processor error
   */
  protected async logProcessorError(error: Error): Promise<void> {
    console.log(`[${this.config.processorName}] Writing processor error log to database...`);
    
    try {
      await this.db.collection('processor_logs').insertOne({
        processorId: this.processorId,
        processorName: this.config.processorName,
        queueType: this.config.queueType,
        event: 'error',
        timestamp: new Date(),
        error: {
          message: error.message,
          stack: error.stack
        }
      });
      
      console.log(`[${this.config.processorName}] Processor error logged successfully`);
    } catch (logError) {
      console.error(`[${this.config.processorName}] Failed to log processor error:`, logError);
    }
  }

  /**
   * Log item processing error
   */
  protected async logItemError(item: QueueItem, error: Error): Promise<void> {
    console.log(`[${this.config.processorName}] Writing item error log to database for ${item.webhookId}...`);
    
    try {
      await this.db.collection('webhook_errors').insertOne({
        webhookId: item.webhookId,
        processorId: this.processorId,
        processorName: this.config.processorName,
        queueType: this.config.queueType,
        webhookType: item.type,
        attempt: item.attempts,
        timestamp: new Date(),
        error: {
          message: error.message,
          stack: error.stack
        },
        item: {
          locationId: item.locationId,
          companyId: item.companyId,
          priority: item.priority
        }
      });
      
      console.log(`[${this.config.processorName}] Item error logged successfully`);
    } catch (logError) {
      console.error(`[${this.config.processorName}] Failed to log item error:`, logError);
    }
  }

  /**
   * Helper to get related records efficiently
   */
  protected async findContact(ghlContactId: string, locationId: string) {
    console.log(`[${this.config.processorName}] Finding contact ${ghlContactId} in location ${locationId}...`);
    
    return await this.db.collection('contacts').findOne(
      { ghlContactId, locationId },
      { 
        projection: { 
          _id: 1, 
          firstName: 1, 
          lastName: 1, 
          email: 1, 
          phone: 1 
        } 
      }
    );
  }

  /**
   * Helper to find location
   */
  protected async findLocation(locationId: string) {
    console.log(`[${this.config.processorName}] Finding location ${locationId}...`);
    
    return await this.db.collection('locations').findOne(
      { locationId },
      { 
        projection: { 
          _id: 1, 
          name: 1, 
          companyId: 1,
          ghlOAuth: 1
        } 
      }
    );
  }
}