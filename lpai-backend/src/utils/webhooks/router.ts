// src/utils/webhooks/router.ts
import { Db } from 'mongodb';

export interface WebhookRoute {
  type: string;
  queueType: 'critical' | 'messages' | 'appointments' | 'contacts' | 'financial' | 'general';
  priority: number; // 1-5 (1 = highest)
  directProcess?: boolean; // Should bypass queue?
}

// Webhook type to queue/priority mapping
const WEBHOOK_ROUTES: Record<string, WebhookRoute> = {
  // Critical Events - Process ASAP
  'INSTALL': { type: 'INSTALL', queueType: 'critical', priority: 1 },
  'UNINSTALL': { type: 'UNINSTALL', queueType: 'critical', priority: 1 },
  'PLAN_CHANGE': { type: 'PLAN_CHANGE', queueType: 'critical', priority: 1 },
  
  // Message Events - Near real-time
  'InboundMessage': { type: 'InboundMessage', queueType: 'messages', priority: 2, directProcess: true },
  'OutboundMessage': { type: 'OutboundMessage', queueType: 'messages', priority: 3 },
  
  // Appointment Events
  'AppointmentCreate': { type: 'AppointmentCreate', queueType: 'appointments', priority: 2 },
  'AppointmentUpdate': { type: 'AppointmentUpdate', queueType: 'appointments', priority: 3 },
  'AppointmentDelete': { type: 'AppointmentDelete', queueType: 'appointments', priority: 3 },
  
  // Contact Events
  'ContactCreate': { type: 'ContactCreate', queueType: 'contacts', priority: 3 },
  'ContactUpdate': { type: 'ContactUpdate', queueType: 'contacts', priority: 4 },
  'ContactDelete': { type: 'ContactDelete', queueType: 'contacts', priority: 4 },
  'ContactTagUpdate': { type: 'ContactTagUpdate', queueType: 'contacts', priority: 5 },
  'ContactDndUpdate': { type: 'ContactDndUpdate', queueType: 'contacts', priority: 4 },
  
  // Financial Events
  'InvoicePaid': { type: 'InvoicePaid', queueType: 'financial', priority: 2 },
  'InvoicePartiallyPaid': { type: 'InvoicePartiallyPaid', queueType: 'financial', priority: 2 },
  'PaymentReceived': { type: 'PaymentReceived', queueType: 'financial', priority: 1, directProcess: true },
  'OrderCreate': { type: 'OrderCreate', queueType: 'financial', priority: 3 },
  
  // Location Events
  'LocationUpdate': { type: 'LocationUpdate', queueType: 'general', priority: 4 },
  'LocationCreate': { type: 'LocationCreate', queueType: 'general', priority: 3 },
  
  // Everything else
  'OpportunityCreate': { type: 'OpportunityCreate', queueType: 'general', priority: 3 },
  'OpportunityUpdate': { type: 'OpportunityUpdate', queueType: 'general', priority: 4 },
  'TaskCreate': { type: 'TaskCreate', queueType: 'general', priority: 5 },
  'NoteCreate': { type: 'NoteCreate', queueType: 'general', priority: 5 },
  'ConversationUnreadUpdate': { type: 'ConversationUnreadUpdate', queueType: 'general', priority: 5 },
};

export interface RouteDecision {
  type: string;
  queueType: string;
  priority: number;
  shouldDirectProcess: boolean;
  isRecognized: boolean;
}

/**
 * Analyzes webhook payload and determines routing
 */
export function analyzeWebhook(payload: any): RouteDecision {
  // Determine webhook type from payload
  const webhookType = payload.type || determineTypeFromPayload(payload);
  
  // Get routing info
  const route = WEBHOOK_ROUTES[webhookType];
  
  if (!route) {
    console.warn(`[Router] Unknown webhook type: ${webhookType}`);
    return {
      type: webhookType || 'unknown',
      queueType: 'general',
      priority: 5,
      shouldDirectProcess: false,
      isRecognized: false
    };
  }
  
  return {
    type: route.type,
    queueType: route.queueType,
    priority: route.priority,
    shouldDirectProcess: route.directProcess || false,
    isRecognized: true
  };
}

/**
 * Fallback type detection based on payload structure
 */
function determineTypeFromPayload(payload: any): string {
  // Native webhooks have type field
  if (payload.type) {
    return payload.type;
  }
  
  // Check for specific fields that indicate webhook type
  if (payload.appointment) return 'AppointmentCreate';
  if (payload.contact && payload.contact.id) return 'ContactUpdate';
  if (payload.message && payload.direction === 'inbound') return 'InboundMessage';
  if (payload.message && payload.direction === 'outbound') return 'OutboundMessage';
  if (payload.invoice) return 'InvoiceUpdate';
  if (payload.opportunity) return 'OpportunityUpdate';
  
  // Check for install/uninstall
  if (payload.installType) return 'INSTALL';
  if (payload.uninstallReason) return 'UNINSTALL';
  
  return 'unknown';
}

/**
 * Check if system is healthy enough for direct processing
 */
export async function isSystemHealthy(db: Db): Promise<boolean> {
  try {
    // Check queue depths
    const criticalQueueDepth = await db.collection('webhook_queue').countDocuments({
      queueType: 'critical',
      status: 'pending'
    });
    
    const messageQueueDepth = await db.collection('webhook_queue').countDocuments({
      queueType: 'messages', 
      status: 'pending'
    });
    
    // If queues are too deep, system is not healthy
    if (criticalQueueDepth > 100 || messageQueueDepth > 500) {
      return false;
    }
    
    // Check recent error rate
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentErrors = await db.collection('webhook_metrics').countDocuments({
      success: false,
      'timestamps.processingCompleted': { $gte: fiveMinutesAgo }
    });
    
    const recentTotal = await db.collection('webhook_metrics').countDocuments({
      'timestamps.processingCompleted': { $gte: fiveMinutesAgo }
    });
    
    // If error rate > 10%, system is not healthy
    if (recentTotal > 0 && (recentErrors / recentTotal) > 0.1) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Router] Error checking system health:', error);
    return false; // Default to not healthy if check fails
  }
}

/**
 * Generate tracking ID for end-to-end monitoring
 */
export function generateTrackingId(): string {
  return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}