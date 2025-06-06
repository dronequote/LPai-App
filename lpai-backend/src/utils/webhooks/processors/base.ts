// src/utils/webhooks/processors/base.ts
import { Db, MongoClient } from 'mongodb';
import { QueueManager, QueueItem } from '../queueManager';
import clientPromise from '../../../lib/mongodb';

export interface ProcessorConfig {
  queueType: string;
  batchSize: number;
  maxRuntime?: number; // Made optional with default
  maxProcessingTime?: number; // Alternative name used in some processors
  processorName: string;
  db?: Db; // Add optional db parameter
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

  constructor(config: ProcessorConfig) {
    this.config = config;
    // Handle both maxRuntime and maxProcessingTime
    if (!this.config.maxRuntime && this.config.maxProcessingTime) {
      this.config.maxRuntime = this.config.maxProcessingTime;
    }
    // Default to 50 seconds if not specified
    this.config.maxRuntime = this.config.maxRuntime || 50000;
    
    this.processorId = `${config.processorName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = Date.now();
    
    // If db is provided, use it
    if (config.db) {
      this.db = config.db;
    }
  }

  /**
   * Initialize database connection
   */
  protected async initialize(): Promise<void> {
    // Only initialize if db wasn't provided in constructor
    if (!this.db) {
      const client = await clientPromise;
      this.client = client;
      this.db = client.db('lpai');
    } else if (!this.client) {
      // If db was provided, get client from it
      this.client = this.db.client as MongoClient;
    }
    
    this.queueManager = new QueueManager(this.db);
    
    console.log(`[${this.config.processorName}] Initialized processor ${this.processorId}`);
  }

  /**
   * Main processing loop
   */
  async run(): Promise<void> {
    try {
      await this.initialize();
      
      // Log processor start
      await this.logProcessorStart();
      
      // Process until timeout
      while (this.shouldContinue()) {
        const items = await this.queueManager.getNextBatch(
          this.config.queueType,
          this.config.batchSize
        );
        
        if (items.length === 0) {
          // No items, wait a bit
          await this.sleep(1000);
          continue;
        }
        
        // Process batch
        await this.processBatch(items);
        
        // Check if we should yield to prevent hogging resources
        if (this.processedCount % 100 === 0 && this.processedCount > 0) {
          await this.sleep(100); // Brief pause every 100 items
        }
      }
      
      // Log processor completion
      await this.logProcessorEnd();
      
    } catch (error: any) {
      console.error(`[${this.config.processorName}] Fatal error:`, error);
      await this.logProcessorError(error);
      throw error;
    }
  }

  /**
   * Process a batch of items
   */
  protected async processBatch(items: QueueItem[]): Promise<void> {
    console.log(`[${this.config.processorName}] Processing batch of ${items.length} items`);

    // Process items in parallel with concurrency limit
    const concurrency = 5;
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      
      await Promise.all(
        batch.map(item => this.processItemSafe(item))
      );
    }
  }

  /**
   * Process single item with error handling
   */
  protected async processItemSafe(item: QueueItem): Promise<void> {
    const itemStartTime = Date.now();
    
    try {
      // Call the implementation-specific processing
      await this.processItem(item);
      
      // Mark as complete
      await this.queueManager.markComplete(item.webhookId);
      
      this.processedCount++;
      
      const duration = Date.now() - itemStartTime;
      console.log(`[${this.config.processorName}] Processed ${item.type} in ${duration}ms`);
      
    } catch (error: any) {
      this.errorCount++;
      
      console.error(`[${this.config.processorName}] Error processing ${item.webhookId}:`, error);
      
      // Mark as failed with retry
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
    return runtime < this.config.maxRuntime!;
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
  }

  /**
   * Log processor end
   */
  protected async logProcessorEnd(): Promise<void> {
    const runtime = Date.now() - this.startTime;
    
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
    
    console.log(`[${this.config.processorName}] Completed:`, {
      processed: this.processedCount,
      errors: this.errorCount,
      runtime: `${(runtime / 1000).toFixed(1)}s`,
      rate: `${(this.processedCount / (runtime / 1000)).toFixed(1)}/sec`
    });
  }

  /**
   * Log processor error
   */
  protected async logProcessorError(error: Error): Promise<void> {
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
  }

  /**
   * Log item processing error
   */
  protected async logItemError(item: QueueItem, error: Error): Promise<void> {
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
  }

  /**
   * Helper to get related records efficiently
   */
  protected async findContact(ghlContactId: string, locationId: string) {
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