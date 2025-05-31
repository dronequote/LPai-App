// src/utils/webhookProcessor.ts
import { ObjectId } from 'mongodb';

export async function processWebhook(db: any, queueItem: any) {
  const { type, payload, webhookId } = queueItem;
  
  try {
    // Mark as processing
    await db.collection('webhook_queue').updateOne(
      { _id: queueItem._id },
      { $set: { status: 'processing', startedAt: new Date() } }
    );
    
    console.log(`[Webhook ${webhookId}] Processing ${type} webhook`);
    
    // Process based on type
    switch (type) {
      case 'contact_changed':
        await processContactChange(db, payload, webhookId);
        break;
      case 'appointment_booked':
      case 'appointment_cancelled':
      case 'appointment_changed':
      case 'appointment_showed':
      case 'appointment_noshow':
        await processAppointmentEvent(db, payload, webhookId, type);
        break;
      case 'opportunity_changed':
      case 'opportunity_won':
      case 'opportunity_lost':
      case 'opportunity_abandoned':
        await processOpportunityChange(db, payload, webhookId, type);
        break;
      case 'message_received':
        await processInboundMessage(db, payload, webhookId);
        break;
      case 'order_submitted':
        await processOrderSubmitted(db, payload, webhookId);
        break;
      case 'invoice_changed':
        await processInvoiceChange(db, payload, webhookId);
        break;
      case 'task_changed':
        await processTaskChange(db, payload, webhookId);
        break;
      case 'note_added':
        await processNoteAdded(db, payload, webhookId);
        break;
      default:
        console.log(`[Webhook ${webhookId}] Unknown event type: ${type}`);
    }
    
    // Mark as completed
    await db.collection('webhook_queue').updateOne(
      { _id: queueItem._id },
      { $set: { status: 'completed', completedAt: new Date() } }
    );
    
  } catch (error: any) {
    console.error(`[Webhook ${webhookId}] Processing error:`, error);
    
    // Mark as failed, increment attempts
    await db.collection('webhook_queue').updateOne(
      { _id: queueItem._id },
      { 
        $set: { 
          status: 'failed',
          lastError: error.message,
          processAfter: new Date(Date.now() + 5 * 60 * 1000) // Retry in 5 minutes
        },
        $inc: { attempts: 1 }
      }
    );
    throw error;
  }
}

// Process contact changes from GHL
async function processContactChange(db: any, payload: any, webhookId: string) {
  // Extract GHL contact ID (can be in different fields)
  const ghlContactId = payload.contact_id || payload.contactId || payload.id;
  const locationId = payload.location?.id;
  
  if (!ghlContactId || !locationId) {
    console.log(`[Webhook ${webhookId}] Missing contact ID or location ID`);
    return;
  }
  
  // Map GHL fields to our MongoDB schema
  const contactData = {
    ghlContactId: ghlContactId,
    locationId: locationId,
    firstName: payload.first_name || '',
    lastName: payload.last_name || '',
    email: payload.email || '',
    phone: payload.phone || '',
    address: payload.address1 || '',
    city: payload.city || '',
    state: payload.state || '',
    postalCode: payload.postal_code || '',
    country: payload.country || '',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    source: payload.contact_source || 'ghl_webhook',
    companyName: payload.company_name || '',
    website: payload.website || '',
    timezone: payload.timezone || '',
    dateOfBirth: payload.date_of_birth ? new Date(payload.date_of_birth) : null,
    ghlCreatedAt: payload.date_created ? new Date(payload.date_created) : null,
    contactType: payload.contact_type || '',
    notes: payload.notes || '',
    lastWebhookUpdate: new Date(),
    lastWebhookId: webhookId
  };
  
  // Remove null/undefined values
  Object.keys(contactData).forEach(key => {
    if (contactData[key] === null || contactData[key] === undefined) {
      delete contactData[key];
    }
  });
  
  // Check if contact already exists
  const existing = await db.collection('contacts').findOne({
    ghlContactId: ghlContactId
  });
  
  if (!existing) {
    // Check if this is a recent creation from our app (deduplication)
    const recentAppCreation = await db.collection('contacts').findOne({
      email: contactData.email,
      locationId: locationId,
      createdAt: { $gte: new Date(Date.now() - 60000) } // Within last minute
    });
    
    if (recentAppCreation && !recentAppCreation.ghlContactId) {
      // Update the recently created contact with GHL ID
      await db.collection('contacts').updateOne(
        { _id: recentAppCreation._id },
        { 
          $set: { 
            ghlContactId: ghlContactId,
            ...contactData
          } 
        }
      );
      console.log(`[Webhook ${webhookId}] Linked GHL ID to existing contact: ${contactData.email}`);
      return;
    }
    
    // Create new contact
    await db.collection('contacts').insertOne({
      _id: new ObjectId(),
      ...contactData,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByWebhook: webhookId
    });
    console.log(`[Webhook ${webhookId}] Created new contact: ${contactData.email}`);
    return;
  }
  
  // Check for actual changes
  const fieldsToCheck = [
    'firstName', 'lastName', 'email', 'phone', 'address',
    'city', 'state', 'postalCode', 'country', 'tags', 
    'companyName', 'website', 'timezone', 'dateOfBirth', 'contactType'
  ];
  
  const changes: any = {};
  for (const field of fieldsToCheck) {
    const newValue = contactData[field];
    const oldValue = existing[field];
    
    // Special handling for arrays (tags)
    if (Array.isArray(newValue) && Array.isArray(oldValue)) {
      if (JSON.stringify(newValue.sort()) !== JSON.stringify(oldValue.sort())) {
        changes[field] = newValue;
      }
    } else if (newValue !== oldValue && newValue !== undefined) {
      changes[field] = newValue;
    }
  }
  
  if (Object.keys(changes).length === 0) {
    console.log(`[Webhook ${webhookId}] No changes detected for contact ${ghlContactId}`);
    return;
  }
  
  // Apply changes
  await db.collection('contacts').updateOne(
    { _id: existing._id },
    {
      $set: {
        ...changes,
        updatedAt: new Date(),
        lastWebhookUpdate: new Date(),
        lastWebhookId: webhookId
      }
    }
  );
  
  console.log(`[Webhook ${webhookId}] Updated contact ${contactData.email} with changes:`, Object.keys(changes));
}

// Process appointment events
async function processAppointmentEvent(db: any, payload: any, webhookId: string, eventType: string) {
  const calendar = payload.calendar;
  if (!calendar || !calendar.appointmentId) {
    console.log(`[Webhook ${webhookId}] No appointment data in payload`);
    return;
  }
  
  const locationId = payload.location?.id;
  const ghlContactId = payload.contact_id || payload.contactId || payload.id;
  
  if (!locationId || !ghlContactId) {
    console.log(`[Webhook ${webhookId}] Missing location or contact ID for appointment`);
    return;
  }
  
  // Find contact by GHL ID
  const contact = await db.collection('contacts').findOne({
    ghlContactId: ghlContactId,
    locationId: locationId
  });
  
  if (!contact) {
    console.log(`[Webhook ${webhookId}] Contact not found for appointment, will create`);
    // Create basic contact from webhook data
    const newContact = {
      _id: new ObjectId(),
      ghlContactId: ghlContactId,
      locationId: locationId,
      firstName: payload.first_name || '',
      lastName: payload.last_name || '',
      email: payload.email || '',
      phone: payload.phone || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByWebhook: webhookId,
      source: 'appointment_webhook'
    };
    await db.collection('contacts').insertOne(newContact);
    contact._id = newContact._id;
  }
  
  // Check if appointment already exists
  const existing = await db.collection('appointments').findOne({
    ghlAppointmentId: calendar.appointmentId
  });
  
  if (existing) {
    // Update appointment status if changed
    const updates: any = {
      status: calendar.status || calendar.appointmentStatus,
      updatedAt: new Date(),
      lastWebhookUpdate: new Date(),
      lastWebhookId: webhookId
    };
    
    // Update notes if changed
    if (calendar.notes && calendar.notes !== existing.notes) {
      updates.notes = calendar.notes;
    }
    
    await db.collection('appointments').updateOne(
      { _id: existing._id },
      { $set: updates }
    );
    
    console.log(`[Webhook ${webhookId}] Updated appointment ${calendar.appointmentId} - ${eventType}`);
    return;
  }
  
  // Create new appointment
  const appointment = {
    _id: new ObjectId(),
    ghlAppointmentId: calendar.appointmentId,
    calendarId: calendar.id,
    calendarName: calendar.calendarName || '',
    locationId: locationId,
    contactId: contact._id.toString(),
    title: calendar.title || 'Appointment',
    start: new Date(calendar.startTime),
    end: new Date(calendar.endTime),
    status: calendar.status || calendar.appointmentStatus,
    address: calendar.address || '',
    notes: calendar.notes || '',
    timezone: calendar.selectedTimezone || 'UTC',
    createdBy: calendar.created_by || '',
    createdByUserId: calendar.created_by_user_id || '',
    ghlCreatedAt: calendar.date_created ? new Date(calendar.date_created) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdByWebhook: webhookId,
    source: calendar.created_by_meta?.source || 'ghl_webhook'
  };
  
  await db.collection('appointments').insertOne(appointment);
  console.log(`[Webhook ${webhookId}] Created appointment ${calendar.appointmentId} - ${eventType}`);
  
  // Update project timeline if contact has active projects
  const activeProject = await db.collection('projects').findOne({
    contactId: contact._id.toString(),
    locationId: locationId,
    status: { $in: ['open', 'in_progress', 'quoted'] }
  });
  
  if (activeProject) {
    await db.collection('projects').updateOne(
      { _id: activeProject._id },
      {
        $push: {
          timeline: {
            id: new ObjectId().toString(),
            event: 'appointment_scheduled',
            description: `${calendar.title} scheduled for ${new Date(calendar.startTime).toLocaleDateString()}`,
            timestamp: new Date().toISOString(),
            metadata: {
              appointmentId: appointment._id.toString(),
              ghlAppointmentId: calendar.appointmentId,
              webhookId
            }
          }
        }
      }
    );
  }
}

// Process opportunity changes
async function processOpportunityChange(db: any, payload: any, webhookId: string, eventType: string) {
  const ghlOpportunityId = payload.opportunity_id || payload.id;
  const locationId = payload.location?.id;
  const ghlContactId = payload.contact_id || payload.contactId;
  
  if (!ghlOpportunityId || !locationId) {
    console.log(`[Webhook ${webhookId}] Missing opportunity or location ID`);
    return;
  }
  
  // Find contact
  const contact = await db.collection('contacts').findOne({
    ghlContactId: ghlContactId,
    locationId: locationId
  });
  
  if (!contact) {
    console.log(`[Webhook ${webhookId}] Contact not found for opportunity`);
    return;
  }
  
  // Check if project exists
  const existing = await db.collection('projects').findOne({
    ghlOpportunityId: ghlOpportunityId
  });
  
  const projectData = {
    ghlOpportunityId: ghlOpportunityId,
    locationId: locationId,
    contactId: contact._id.toString(),
    title: payload.opportunity_name || 'Untitled Project',
    status: mapGHLStatusToProjectStatus(payload.status),
    monetaryValue: parseFloat(payload.lead_value) || 0,
    pipelineId: payload.pipeline_id || '',
    pipelineName: payload.pipeline_name || '',
    pipelineStage: payload.pipeline_stage || '',
    source: payload.opportunity_source || payload.source || '',
    lastWebhookUpdate: new Date(),
    lastWebhookId: webhookId
  };
  
  if (!existing) {
    // Create new project
    await db.collection('projects').insertOne({
      _id: new ObjectId(),
      ...projectData,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByWebhook: webhookId,
      timeline: [{
        id: new ObjectId().toString(),
        event: 'project_created',
        description: `Project created from GHL opportunity`,
        timestamp: new Date().toISOString(),
        metadata: { webhookId, eventType }
      }]
    });
    console.log(`[Webhook ${webhookId}] Created project from opportunity ${ghlOpportunityId}`);
    return;
  }
  
  // Update existing project
  const changes: any = {};
  const fieldsToCheck = ['title', 'status', 'monetaryValue', 'pipelineStage', 'source'];
  
  for (const field of fieldsToCheck) {
    if (projectData[field] !== existing[field] && projectData[field] !== undefined) {
      changes[field] = projectData[field];
    }
  }
  
  if (Object.keys(changes).length > 0) {
    await db.collection('projects').updateOne(
      { _id: existing._id },
      {
        $set: {
          ...changes,
          updatedAt: new Date(),
          lastWebhookUpdate: new Date(),
          lastWebhookId: webhookId
        },
        $push: {
          timeline: {
            id: new ObjectId().toString(),
            event: eventType,
            description: `Status changed to ${payload.status}`,
            timestamp: new Date().toISOString(),
            metadata: { 
              webhookId, 
              changes: Object.keys(changes),
              previousStatus: existing.status,
              newStatus: projectData.status
            }
          }
        }
      }
    );
    console.log(`[Webhook ${webhookId}] Updated project ${existing._id} with changes:`, Object.keys(changes));
  }
}

// Process inbound messages (SMS/Email)
async function processInboundMessage(db: any, payload: any, webhookId: string) {
  const message = payload.message;
  if (!message || message.direction !== 'inbound') {
    return;
  }
  
  const ghlContactId = payload.contact_id || payload.contactId;
  const locationId = payload.location?.id;
  
  const contact = await db.collection('contacts').findOne({
    ghlContactId: ghlContactId,
    locationId: locationId
  });
  
  if (!contact) {
    console.log(`[Webhook ${webhookId}] Contact not found for message`);
    return;
  }
  
  // Store message for conversation tracking
  const messageRecord = {
    _id: new ObjectId(),
    contactId: contact._id,
    locationId: locationId,
    type: message.type, // SMS, Email, etc.
    direction: 'inbound',
    body: message.body,
    status: message.status,
    ghlMessageId: payload.message_id || payload.id,
    receivedAt: new Date(),
    webhookId: webhookId
  };
  
  await db.collection('messages').insertOne(messageRecord);
  console.log(`[Webhook ${webhookId}] Stored inbound ${message.type} from ${contact.email}`);
}

// Helper function to map GHL status to our project status
function mapGHLStatusToProjectStatus(ghlStatus: string): string {
  const statusMap: Record<string, string> = {
    'open': 'open',
    'won': 'won',
    'lost': 'lost',
    'abandoned': 'abandoned',
    'deleted': 'deleted'
  };
  
  return statusMap[ghlStatus?.toLowerCase()] || 'open';
}

// Process order submission
async function processOrderSubmitted(db: any, payload: any, webhookId: string) {
  console.log(`[Webhook ${webhookId}] Processing order submission`);
  // TODO: Implement order processing logic
  // Store order data, update project/contact, etc.
}

// Process invoice changes
async function processInvoiceChange(db: any, payload: any, webhookId: string) {
  console.log(`[Webhook ${webhookId}] Processing invoice change`);
  // TODO: Implement invoice processing logic
  // Update payment records, project status, etc.
}

// Process task changes
async function processTaskChange(db: any, payload: any, webhookId: string) {
  const task = payload.task;
  if (!task) return;
  
  console.log(`[Webhook ${webhookId}] Processing task change`);
  // TODO: Implement task processing
  // Could create tasks in your system or update project timelines
}

// Process note additions
async function processNoteAdded(db: any, payload: any, webhookId: string) {
  const note = payload.note;
  if (!note) return;
  
  console.log(`[Webhook ${webhookId}] Processing note addition`);
  // TODO: Add note to contact or project
}