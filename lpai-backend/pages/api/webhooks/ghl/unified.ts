// pages/api/webhooks/ghl/unified.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

// Function to determine event type based on GHL webhook payload
function determineEventType(payload: any): string {
  // Based on presence of specific fields
  if (payload.calendar?.appointmentId) {
    if (payload.calendar.status === 'booked' || payload.calendar.appointmentStatus === 'confirmed') {
      return 'appointment_booked';
    }
    if (payload.calendar.status === 'cancelled' || payload.calendar.appointmentStatus === 'cancelled') {
      return 'appointment_cancelled';
    }
    if (payload.calendar.status === 'showed' || payload.calendar.appointmentStatus === 'showed') {
      return 'appointment_showed';
    }
    if (payload.calendar.status === 'noshow' || payload.calendar.appointmentStatus === 'noshow') {
      return 'appointment_noshow';
    }
    return 'appointment_changed';
  }
  
  if (payload.opportunity_name || payload.pipeline_id) {
    // Check for specific opportunity changes
    if (payload.status === 'won') return 'opportunity_won';
    if (payload.status === 'lost') return 'opportunity_lost';
    if (payload.status === 'abandoned') return 'opportunity_abandoned';
    return 'opportunity_changed';
  }
  
  if (payload.order) return 'order_submitted';
  if (payload.invoice) return 'invoice_changed';
  if (payload.task) return 'task_changed';
  if (payload.note) return 'note_added';
  if (payload.message) {
    if (payload.message.direction === 'inbound') return 'message_received';
    return 'message_sent';
  }
  
  // Default to contact change if contact fields present
  if (payload.first_name || payload.email || payload.phone || payload.contact_id) {
    return 'contact_changed';
  }
  
  // Campaign events
  if (payload.campaign) return 'campaign_event';
  
  // Workflow events
  if (payload.workflow) return 'workflow_triggered';
  
  return 'unknown';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const webhookId = new ObjectId().toString();
  
  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // Log raw webhook for debugging (in development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Webhook] Raw payload:', JSON.stringify(req.body, null, 2));
    }
    
    // Validate webhook has data
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    // Extract location ID from payload
    const locationId = req.body.location?.id || req.body.locationId || null;
    
    if (!locationId) {
      console.warn(`[Webhook ${webhookId}] No location ID found in payload`);
    }
    
    // Determine event type
    const eventType = determineEventType(req.body);
    
    // Store in webhook queue for processing
    await db.collection('webhook_queue').insertOne({
      _id: new ObjectId(),
      webhookId,
      type: eventType,
      payload: req.body,
      locationId: locationId,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
      processAfter: new Date(), // Process immediately
      // Store key identifiers for easier debugging
      metadata: {
        contactId: req.body.contact_id || req.body.contactId || req.body.id,
        email: req.body.email,
        appointmentId: req.body.calendar?.appointmentId,
        opportunityId: req.body.opportunity_id || req.body.id,
        invoiceId: req.body.invoice?.id,
        orderId: req.body.order?.id
      }
    });
    
    console.log(`[Webhook ${webhookId}] Queued ${eventType} webhook for location ${locationId}`);
    
    // Return immediately (don't block GHL)
    return res.status(200).json({ 
      success: true, 
      webhookId,
      type: eventType,
      queued: true 
    });
    
  } catch (error: any) {
    console.error(`[Webhook ${webhookId}] Queue error:`, error);
    
    // Still return 200 to prevent GHL from retrying
    return res.status(200).json({ 
      success: false,
      error: 'Internal error',
      webhookId
    });
  }
}