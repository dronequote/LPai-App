// lpai-backend/src/utils/deduplication.ts
import crypto from 'crypto';

export async function isDuplicateWebhook(db: any, payload: any): Promise<boolean> {
  // Create a unique hash from the webhook data
  const hash = createWebhookHash(payload);
  
  // Check if we've seen this exact webhook recently
  const duplicate = await db.collection('webhook_hashes').findOne({
    hash,
    createdAt: { $gte: new Date(Date.now() - 60000) } // Within 1 minute
  });
  
  if (!duplicate) {
    // Store hash to prevent future duplicates
    await db.collection('webhook_hashes').insertOne({
      hash,
      createdAt: new Date(),
      expireAt: new Date(Date.now() + 300000) // Expire after 5 minutes
    });
  }
  
  return !!duplicate;
}

export function createWebhookHash(payload: any): string {
  // Create hash based on GHL webhook structure
  const hashComponents = [];
  
  // Contact identifiers
  if (payload.contact_id || payload.contactId || payload.id) {
    hashComponents.push(payload.contact_id || payload.contactId || payload.id);
  }
  if (payload.email) {
    hashComponents.push(payload.email);
  }
  
  // Location
  if (payload.location?.id) {
    hashComponents.push(payload.location.id);
  }
  
  // Appointment data
  if (payload.calendar?.appointmentId) {
    hashComponents.push(payload.calendar.appointmentId);
    hashComponents.push(payload.calendar.status || payload.calendar.appointmentStatus || '');
  }
  
  // Opportunity data
  if (payload.opportunity_id || payload.opportunity_name) {
    hashComponents.push(payload.opportunity_id || '');
    hashComponents.push(payload.opportunity_name || '');
    hashComponents.push(payload.status || '');
    hashComponents.push(payload.pipeline_stage || '');
  }
  
  // Order data
  if (payload.order?.id) {
    hashComponents.push(payload.order.id);
  }
  
  // Invoice data
  if (payload.invoice?.id) {
    hashComponents.push(payload.invoice.id);
    hashComponents.push(payload.invoice.status || '');
  }
  
  // Message data
  if (payload.message) {
    hashComponents.push(payload.message.type || '');
    hashComponents.push(payload.message.direction || '');
    // Include a hash of the message body to detect duplicates
    if (payload.message.body) {
      hashComponents.push(crypto.createHash('md5').update(payload.message.body).digest('hex'));
    }
  }
  
  // Task data
  if (payload.task) {
    hashComponents.push(payload.task.title || '');
    hashComponents.push(payload.task.dueDate || '');
  }
  
  // Note data
  if (payload.note?.body) {
    // Hash the note body
    hashComponents.push(crypto.createHash('md5').update(payload.note.body).digest('hex'));
  }
  
  // Timestamps to detect actual changes
  if (payload.date_created) {
    hashComponents.push(payload.date_created);
  }
  if (payload.date_modified) {
    hashComponents.push(payload.date_modified);
  }
  
  // Campaign and workflow identifiers
  if (payload.campaign?.id) {
    hashComponents.push(payload.campaign.id);
  }
  if (payload.workflow?.id) {
    hashComponents.push(payload.workflow.id);
  }
  
  // Custom fields (if any)
  // GHL can send custom fields at root level, so we'll create a hash of all unknown fields
  const knownFields = [
    'first_name', 'last_name', 'full_name', 'email', 'phone', 'tags',
    'address1', 'city', 'state', 'country', 'timezone', 'date_created',
    'postal_code', 'company_name', 'website', 'date_of_birth',
    'contact_source', 'full_address', 'contact_type', 'gclid',
    'location', 'opportunity_name', 'status', 'lead_value',
    'opportunity_source', 'source', 'pipeline_stage', 'pipeline_id',
    'id', 'pipeline_name', 'campaign', 'user', 'calendar', 'order',
    'invoice', 'task', 'note', 'message', 'workflow', 'contact_id',
    'contactId', 'opportunity_id', 'date_modified'
  ];
  
  const customFields: Record<string, any> = {};
  Object.keys(payload).forEach(key => {
    if (!knownFields.includes(key)) {
      customFields[key] = payload[key];
    }
  });
  
  if (Object.keys(customFields).length > 0) {
    hashComponents.push(JSON.stringify(customFields));
  }
  
  // Create final hash
  const key = hashComponents.filter(Boolean).join('|');
  return crypto.createHash('md5').update(key).digest('hex');
}

// Helper function to check if webhook should be processed
export async function shouldProcessWebhook(db: any, payload: any): Promise<boolean> {
  // First check for duplicates
  const isDuplicate = await isDuplicateWebhook(db, payload);
  if (isDuplicate) {
    console.log('[Webhook Dedup] Duplicate webhook detected, skipping');
    return false;
  }
  
  // Check if this is a test webhook
  if (payload.test || payload.is_test) {
    console.log('[Webhook Dedup] Test webhook detected, skipping');
    return false;
  }
  
  // Check if location exists (for multi-tenant security)
  if (payload.location?.id) {
    const locationExists = await db.collection('locations').findOne({
      locationId: payload.location.id
    });
    
    if (!locationExists) {
      console.log(`[Webhook Dedup] Unknown location: ${payload.location.id}, skipping`);
      return false;
    }
  }
  
  return true;
}