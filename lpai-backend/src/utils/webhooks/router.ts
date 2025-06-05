// src/utils/webhooks/router.ts
import { Db, ObjectId } from 'mongodb';
import { WebhookAnalytics } from '../analytics/webhookAnalytics';

export interface WebhookData {
  webhookId: string;
  type: string;
  payload: any;
  locationId?: string;
  companyId?: string;
  timestamp?: Date;
}

export interface RouteResult {
  queueType: string;
  priority: number;
  webhookType: string;
}
// Add these functions to router.ts

export function analyzeWebhook(payload: any): any {
  const type = payload.type;
  
  // Determine routing based on webhook type
  let queueType = 'general';
  let priority = 5;
  let shouldDirectProcess = false;
  
  switch (type) {
    case 'INSTALL':
    case 'UNINSTALL':
      queueType = 'critical';
      priority = 1;
      break;
    case 'InboundMessage':
    case 'OutboundMessage':
      queueType = 'messages';
      priority = 2;
      shouldDirectProcess = true; // Direct process for low latency
      break;
    // ... other cases
  }
  
  return {
    type,
    queueType,
    priority,
    shouldDirectProcess,
    isRecognized: true // or check if type is known
  };
}

export async function isSystemHealthy(db: Db): Promise<boolean> {
  // Check queue depths, processing rates, etc.
  const queueDepth = await db.collection('webhook_queue')
    .countDocuments({ status: 'pending' });
  
  return queueDepth < 1000; // Example threshold
}

export class WebhookRouter {
  private db: Db;
  private analytics: WebhookAnalytics;

  constructor(db: Db) {
    this.db = db;
    this.analytics = new WebhookAnalytics(db);
  }

  
  /**
   * Route webhook to appropriate queue
   */
  async routeWebhook(webhookData: WebhookData): Promise<RouteResult> {
    const { type, payload } = webhookData;
    let route: RouteResult;

    // Determine routing based on webhook type
    switch (type) {
      // Critical events - highest priority
      case 'INSTALL':
      case 'UNINSTALL':
      case 'PLAN_CHANGE':
        route = { queueType: 'critical', priority: 1, webhookType: type };
        break;

      // Message events - high priority
      case 'InboundMessage':
      case 'OutboundMessage':
        route = { queueType: 'messages', priority: 2, webhookType: type };
        break;

      // Appointment events
      case 'AppointmentCreate':
      case 'AppointmentUpdate':
      case 'AppointmentDelete':
        route = { queueType: 'appointments', priority: 3, webhookType: type };
        break;

      // Contact events
      case 'ContactCreate':
      case 'ContactUpdate':
      case 'ContactDelete':
      case 'ContactDndUpdate':
      case 'ContactTagUpdate':
        route = { queueType: 'contacts', priority: 4, webhookType: type };
        break;

      // Financial events
      case 'InvoiceCreate':
      case 'InvoiceUpdate':
      case 'InvoicePaid':
      case 'InvoicePartiallyPaid':
      case 'InvoiceVoid':
      case 'InvoiceDelete':
      case 'OrderCreate':
      case 'OrderStatusUpdate':
      case 'ProductCreate':
      case 'ProductUpdate':
      case 'ProductDelete':
      case 'PriceCreate':
      case 'PriceUpdate':
      case 'PriceDelete':
        route = { queueType: 'financial', priority: 3, webhookType: type };
        break;

      // Everything else goes to general queue
      default:
        route = { queueType: 'general', priority: 5, webhookType: type };
        break;
    }

    // Record webhook received in analytics
    await this.analytics.recordWebhookReceived(
      webhookData.webhookId,
      route.webhookType,
      route.queueType,
      webhookData.locationId || ''
    );

    // Add to queue
    await this.addToQueue(webhookData, route);

    console.log(`[Router] Routed ${type} webhook ${webhookData.webhookId} to ${route.queueType} queue with priority ${route.priority}`);
    
    return route;
  }

  /**
   * Add webhook to queue
   */
  private async addToQueue(webhookData: WebhookData, route: RouteResult): Promise<void> {
    const now = new Date();
    
    const queueItem = {
      _id: new ObjectId(),
      webhookId: webhookData.webhookId,
      trackingId: webhookData.webhookId, // For end-to-end tracking
      type: webhookData.type,
      queueType: route.queueType,
      priority: route.priority,
      payload: webhookData.payload,
      locationId: webhookData.locationId || this.extractLocationId(webhookData.payload),
      companyId: webhookData.companyId || webhookData.payload.companyId,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      receivedAt: webhookData.timestamp || now,
      queuedAt: now,
      processAfter: now,
      createdAt: now,
      updatedAt: now,
      ttl: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    await this.db.collection('webhook_queue').insertOne(queueItem);
  }

  /**
   * Extract location ID from various payload formats
   */
  private extractLocationId(payload: any): string {
    return payload.locationId || 
           payload.location?.id || 
           payload.appointment?.locationId ||
           payload.contact?.locationId ||
           '';
  }

  /**
   * Check if webhook should be processed immediately (bypass queue)
   */
  shouldBypassQueue(type: string): boolean {
    // For now, we'll process everything through queues
    // This can be updated later for ultra-low latency requirements
    return false;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    const stats = await this.db.collection('webhook_queue').aggregate([
      {
        $match: { status: { $in: ['pending', 'processing'] } }
      },
      {
        $group: {
          _id: {
            queueType: '$queueType',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.queueType',
          pending: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', 'pending'] }, '$count', 0]
            }
          },
          processing: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', 'processing'] }, '$count', 0]
            }
          },
          total: { $sum: '$count' }
        }
      }
    ]).toArray();

    return stats.reduce((acc, stat) => {
      acc[stat._id] = {
        pending: stat.pending,
        processing: stat.processing,
        total: stat.total
      };
      return acc;
    }, {} as Record<string, any>);
  }
}