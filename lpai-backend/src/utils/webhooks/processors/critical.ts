// src/utils/webhooks/processors/critical.ts
import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId, Db } from 'mongodb';

export class CriticalProcessor extends BaseProcessor {
  constructor(db?: Db) {
    super({
      queueType: 'critical',
      batchSize: 10, // Smaller batches for critical items
      maxRuntime: 50000, // 50 seconds
      processorName: 'CriticalProcessor'
    }, db);
  }

  /**
   * Process critical webhook types
   */
  protected async processItem(item: QueueItem): Promise<void> {
    const { type, payload, webhookId } = item;

    switch (type) {
      case 'INSTALL':
        await this.processInstall(payload, webhookId);
        break;
        
      case 'UNINSTALL':
        await this.processUninstall(payload, webhookId);
        break;
        
      case 'PLAN_CHANGE':
        await this.processPlanChange(payload, webhookId);
        break;
        
      default:
        console.warn(`[CriticalProcessor] Unknown critical type: ${type}`);
        throw new Error(`Unsupported critical webhook type: ${type}`);
    }
  }

  /**
   * Process app installation
   */
  private async processInstall(payload: any, webhookId: string): Promise<void> {
    const { installType, locationId, companyId, userId, companyName, planId } = payload;
    
    console.log(`[CriticalProcessor] Processing ${installType} install for ${locationId || companyId}`);

    // Track install start time
    const installStartTime = Date.now();
    
    // Update metrics with install steps
    await this.db.collection('webhook_metrics').updateOne(
      { webhookId },
      { 
        $set: { 
          'timestamps.steps.installStarted': new Date(),
          'installType': installType
        } 
      }
    );

    if (installType === 'Location' && locationId) {
      await this.processLocationInstall({
        locationId,
        companyId,
        userId,
        companyName,
        planId,
        webhookId,
        timestamp: payload.timestamp
      });
    } else if (installType === 'Company' && companyId) {
      await this.processCompanyInstall({
        companyId,
        companyName,
        planId,
        webhookId,
        timestamp: payload.timestamp
      });
    }

    // Update metrics with completion
    const installDuration = Date.now() - installStartTime;
    await this.db.collection('webhook_metrics').updateOne(
      { webhookId },
      { 
        $set: { 
          'timestamps.steps.installCompleted': new Date(),
          'metrics.stepDurations.totalInstall': installDuration
        } 
      }
    );

    console.log(`[CriticalProcessor] Install completed in ${installDuration}ms`);
  }

  /**
   * Process location-specific installation
   */
  private async processLocationInstall(params: {
    locationId: string;
    companyId: string;
    userId: string;
    companyName?: string;
    planId?: string;
    webhookId: string;
    timestamp?: string;
  }): Promise<void> {
    const { locationId, companyId, userId, companyName, planId, webhookId, timestamp } = params;

    // Use a session for atomic operations
  const session = this.client.startSession();
    try {
      await session.withTransaction(async () => {
        // Update or create location record
        await this.db.collection('locations').updateOne(
          { locationId },
          {
            $set: {
              locationId,
              companyId,
              name: companyName || `Location ${locationId}`,
              appInstalled: true,
              installedAt: new Date(timestamp || Date.now()),
              installedBy: userId,
              installType: 'Location',
              planId,
              installWebhookId: webhookId,
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true, session }
        );

        // Record install event
        await this.db.collection('app_events').insertOne({
          _id: new ObjectId(),
          type: 'install',
          installType: 'Location',
          locationId,
          companyId,
          userId,
          planId,
          timestamp: new Date(timestamp || Date.now()),
          webhookId,
          processedAt: new Date()
        }, { session });
      });

      // Trigger location setup (outside transaction)
      await this.triggerLocationSetup(locationId, webhookId);

    } finally {
      await session.endSession();
    }
  }

  /**
   * Process company-level installation
   */
  private async processCompanyInstall(params: {
    companyId: string;
    companyName?: string;
    planId?: string;
    webhookId: string;
    timestamp?: string;
  }): Promise<void> {
    const { companyId, companyName, planId, webhookId, timestamp } = params;

    await this.db.collection('locations').updateOne(
      { companyId, locationId: null },
      {
        $set: {
          companyId,
          name: companyName || 'Company-Level Install',
          appInstalled: true,
          installedAt: new Date(timestamp || Date.now()),
          installType: 'Company',
          isCompanyLevel: true,
          planId,
          installWebhookId: webhookId,
          updatedAt: new Date()
        },
        $setOnInsert: {
          locationId: null,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    // Queue agency sync for later
    await this.queueAgencySync(companyId, webhookId);
  }

  /**
   * Trigger location setup process
   */
  private async triggerLocationSetup(locationId: string, webhookId: string): Promise<void> {
    try {
      console.log(`[CriticalProcessor] Triggering setup for location ${locationId}`);
      
      // Track setup start
      await this.db.collection('webhook_metrics').updateOne(
        { webhookId },
        { $set: { 'timestamps.steps.setupStarted': new Date() } }
      );

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app'}/api/locations/setup-location`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId, fullSync: true })
        }
      );

      if (response.ok) {
        const result = await response.json();
        
        // Track setup completion
        await this.db.collection('webhook_metrics').updateOne(
          { webhookId },
          { 
            $set: { 
              'timestamps.steps.setupCompleted': new Date(),
              'setupResult': result
            } 
          }
        );

        // Update location
        await this.db.collection('locations').updateOne(
          { locationId },
          {
            $set: {
              setupCompleted: true,
              setupCompletedAt: new Date(),
              lastSetupWebhook: webhookId
            }
          }
        );

        console.log(`[CriticalProcessor] Setup completed for ${locationId}`);
      } else {
        throw new Error(`Setup failed: ${response.statusText}`);
      }

    } catch (error: any) {
      console.error(`[CriticalProcessor] Setup failed for ${locationId}:`, error);
      
      // Mark location as needing manual setup
      await this.db.collection('locations').updateOne(
        { locationId },
        {
          $set: {
            setupError: error.message,
            needsManualSetup: true,
            setupFailedAt: new Date()
          }
        }
      );

      // Don't throw - install succeeded even if setup failed
    }
  }

  /**
   * Process app uninstallation
   */
  private async processUninstall(payload: any, webhookId: string): Promise<void> {
    const { locationId, companyId, userId, reason, timestamp } = payload;
    
    console.log(`[CriticalProcessor] Processing uninstall for ${locationId || companyId}`);

    if (locationId) {
      // Location-specific uninstall
      await this.db.collection('locations').updateOne(
        { locationId },
        {
          $set: {
            appInstalled: false,
            uninstalledAt: new Date(timestamp || Date.now()),
            uninstalledBy: userId,
            uninstallReason: reason || 'User uninstalled',
            uninstallWebhookId: webhookId,
            updatedAt: new Date()
          },
          $unset: {
            ghlOAuth: '',
            installedAt: '',
            installedBy: '',
            setupCompleted: ''
          }
        }
      );

      // Mark users as needing reauth
      await this.db.collection('users').updateMany(
        { locationId },
        { $set: { requiresReauth: true } }
      );

    } else if (companyId) {
      // Company-level uninstall
      await this.db.collection('locations').updateOne(
        { companyId, locationId: null, isCompanyLevel: true },
        {
          $set: {
            appInstalled: false,
            uninstalledAt: new Date(timestamp || Date.now()),
            uninstallWebhookId: webhookId
          },
          $unset: {
            ghlOAuth: '',
            installedAt: ''
          }
        }
      );

      // Mark all locations under company as needing reauth
      await this.db.collection('locations').updateMany(
        { companyId, locationId: { $ne: null } },
        { $set: { hasCompanyOAuth: false } }
      );
    }

    // Record uninstall event
    await this.db.collection('app_events').insertOne({
      _id: new ObjectId(),
      type: 'uninstall',
      locationId,
      companyId,
      userId,
      reason,
      timestamp: new Date(timestamp || Date.now()),
      webhookId,
      processedAt: new Date()
    });
  }

  /**
   * Process plan changes
   */
  private async processPlanChange(payload: any, webhookId: string): Promise<void> {
    const { locationId, companyId, oldPlanId, newPlanId, timestamp } = payload;
    
    console.log(`[CriticalProcessor] Processing plan change from ${oldPlanId} to ${newPlanId}`);

    const filter = locationId ? { locationId } : { companyId, isCompanyLevel: true };
    
    await this.db.collection('locations').updateOne(
      filter,
      {
        $set: {
          planId: newPlanId,
          previousPlanId: oldPlanId,
          planChangedAt: new Date(timestamp || Date.now()),
          planChangeWebhookId: webhookId,
          updatedAt: new Date()
        }
      }
    );

    // Record plan change event
    await this.db.collection('app_events').insertOne({
      _id: new ObjectId(),
      type: 'plan_change',
      locationId,
      companyId,
      oldPlanId,
      newPlanId,
      timestamp: new Date(timestamp || Date.now()),
      webhookId,
      processedAt: new Date()
    });
  }

  /**
   * Queue agency sync for later processing
   */
  private async queueAgencySync(companyId: string, webhookId: string): Promise<void> {
    await this.db.collection('sync_queue').insertOne({
      _id: new ObjectId(),
      type: 'agency_sync',
      companyId,
      webhookId,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
      scheduledFor: new Date(Date.now() + 5000) // 5 seconds from now
    });
  }
}