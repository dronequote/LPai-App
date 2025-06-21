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

export function generateTrackingId(): string {
  return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export interface RouteResult {
  queueType: string;
  priority: number;
  webhookType: string;
}

export function analyzeWebhook(payload: any): any {
  const type = payload.type;
  
  // Determine routing based on webhook type
  let queueType = 'general';
  let priority = 5;
  let shouldDirectProcess = false;
  
  switch (type) {
    // Critical events - highest priority
    case 'INSTALL':
    case 'UNINSTALL':
    case 'PLAN_CHANGE':
    case 'EXTERNAL_AUTH_CONNECTED':
    case 'UserCreate':
      queueType = 'critical';
      priority = 1;
      break;

    // Message events - high priority with direct processing option
    case 'InboundMessage':
    case 'OutboundMessage':
    case 'ConversationUnreadUpdate':
    case 'ConversationProviderOutboundMessage':
    case 'LCEmailStats':
      queueType = 'messages';
      priority = 2;
      shouldDirectProcess = type === 'InboundMessage' || type === 'OutboundMessage';
      break;

    // Contact events
    case 'ContactCreate':
    case 'ContactUpdate':
    case 'ContactDelete':
    case 'ContactDndUpdate':
    case 'ContactTagUpdate':
    case 'NoteCreate':    // Process with contacts
    case 'NoteUpdate':    // Process with contacts
    case 'NoteDelete':    // Process with contacts
    case 'TaskCreate':    // Process with contacts
    case 'TaskComplete':  // Process with contacts
    case 'TaskDelete':    // Process with contacts
      queueType = 'contacts';
      priority = 3;
      break;

    // Appointment events
    case 'AppointmentCreate':
    case 'AppointmentUpdate':
    case 'AppointmentDelete':
      queueType = 'appointments';
      priority = 3;
      break;

    // Opportunity/Project events
    case 'OpportunityCreate':
    case 'OpportunityUpdate':
    case 'OpportunityDelete':
    case 'OpportunityStatusUpdate':
    case 'OpportunityStageUpdate':
    case 'OpportunityAssignedToUpdate':
    case 'OpportunityMonetaryValueUpdate':
      queueType = 'projects'; // Changed from 'general'
      priority = 3;
      break;

    // Financial events
    case 'InvoiceCreate':
    case 'InvoiceUpdate':
    case 'InvoiceDelete':
    case 'InvoiceSent':
    case 'InvoicePaid':
    case 'InvoicePartiallyPaid':
    case 'InvoiceVoid':
    case 'OrderCreate':
    case 'OrderStatusUpdate':
    case 'ProductCreate':
    case 'ProductUpdate':
    case 'ProductDelete':
    case 'PriceCreate':
    case 'PriceUpdate':
    case 'PriceDelete':
      queueType = 'financial';
      priority = 3;
      break;

    // User & Location events
    case 'LocationCreate':
    case 'LocationUpdate':
      queueType = 'general';
      priority = 1;
      break;

    // Campaign events
    case 'CampaignStatusUpdate':
      queueType = 'general';
      priority = 5;
      break;

    // Custom Object events
    case 'ObjectSchemaCreate':
    case 'UpdateCustomObject':
    case 'RecordCreate':
    case 'RecordUpdate':
    case 'DeleteRecord':
      queueType = 'general';
      priority = 5;
      break;

    // Association/Relation events
    case 'AssociationCreated':
    case 'AssociationUpdated':
    case 'AssociationDeleted':
    case 'RelationCreate':
    case 'RelationDelete':
      queueType = 'general';
      priority = 5;
      break;

    // Everything else goes to general queue
    default:
      console.warn(`[Router] Unknown webhook type: ${type}`);
      queueType = 'general';
      priority = 5;
      break;
  }
  
  return {
    type,
    queueType,
    priority,
    shouldDirectProcess,
    isRecognized: true // We now recognize all webhook types
  };
}

export async function isSystemHealthy(db: Db): Promise<boolean> {
  try {
    // Check overall queue depth
    const totalQueueDepth = await db.collection('webhook_queue')
      .countDocuments({ status: 'pending' });
    
    // Check critical queue depth specifically
    const criticalQueueDepth = await db.collection('webhook_queue')
      .countDocuments({ 
        status: 'pending',
        queueType: 'critical'
      });
    
    // Check for stuck webhooks (pending for more than 5 minutes)
    const stuckWebhooks = await db.collection('webhook_queue')
      .countDocuments({
        status: 'pending',
        queuedAt: { $lte: new Date(Date.now() - 5 * 60 * 1000) }
      });
    
    // System is healthy if:
    // - Total queue depth is reasonable
    // - No critical webhooks are backing up
    // - No webhooks are stuck
    return totalQueueDepth < 5000 && 
           criticalQueueDepth < 50 && 
           stuckWebhooks < 100;
           
  } catch (error) {
    console.error('[Router] Error checking system health:', error);
    return false; // Assume unhealthy if we can't check
  }
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

    // Use the analyzeWebhook function for consistency
    const analysis = analyzeWebhook(payload);
    route = {
      queueType: analysis.queueType,
      priority: analysis.priority,
      webhookType: type
    };

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