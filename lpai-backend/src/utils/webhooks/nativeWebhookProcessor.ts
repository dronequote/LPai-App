// src/utils/webhooks/nativeWebhookProcessor.ts
import { ObjectId } from 'mongodb';

// Map native webhook types to your existing handler types
const WEBHOOK_TYPE_MAP: Record<string, string> = {
  // Contacts
  'ContactCreate': 'contact_create',
  'ContactUpdate': 'contact_update',
  'ContactDelete': 'contact_delete',
  'ContactTagUpdate': 'contact_tag_update',
  'ContactDndUpdate': 'contact_dnd_update',
  
  // Appointments
  'AppointmentCreate': 'appointment_create',
  'AppointmentUpdate': 'appointment_update',
  'AppointmentDelete': 'appointment_delete',
  
  // Opportunities
  'OpportunityCreate': 'opportunity_create',
  'OpportunityUpdate': 'opportunity_update',
  'OpportunityDelete': 'opportunity_delete',
  'OpportunityStageUpdate': 'opportunity_stage_update',
  'OpportunityStatusUpdate': 'opportunity_status_update',
  'OpportunityMonetaryValueUpdate': 'opportunity_value_update',
  'OpportunityAssignedToUpdate': 'opportunity_assigned_update',
  
  // Messages
  'InboundMessage': 'message_inbound',
  'OutboundMessage': 'message_outbound',
  
  // Tasks
  'TaskCreate': 'task_create',
  'TaskComplete': 'task_complete',
  'TaskDelete': 'task_delete',
  
  // Notes
  'NoteCreate': 'note_create',
  'NoteDelete': 'note_delete',
  
  // Conversations
  'ConversationUnreadUpdate': 'conversation_unread',
  'ConversationProviderOutboundMessage': 'conversation_provider_message',
  
  // Invoices
  'InvoiceCreate': 'invoice_create',
  'InvoiceUpdate': 'invoice_update',
  'InvoicePaid': 'invoice_paid',
  'InvoicePartiallyPaid': 'invoice_partial',
  'InvoiceVoid': 'invoice_void',
  'InvoiceDelete': 'invoice_delete',
  
  // Products & Prices
  'ProductCreate': 'product_create',
  'ProductUpdate': 'product_update',
  'ProductDelete': 'product_delete',
  'PriceCreate': 'price_create',
  'PriceUpdate': 'price_update',
  'PriceDelete': 'price_delete',
  
  // Orders
  'OrderCreate': 'order_create',
  'OrderStatusUpdate': 'order_status_update',
  
  // Campaigns
  'CampaignStatusUpdate': 'campaign_status_update',
  
  // Location
  'LocationCreate': 'location_create',
  'LocationUpdate': 'location_update',
  
  // Users
  'UserCreate': 'user_create',
  
  // Custom Objects
  'ObjectSchemaCreate': 'custom_object_create',
  'UpdateCustomObject': 'custom_object_update',
  'RecordCreate': 'record_create',
  'RecordUpdate': 'record_update',
  'DeleteRecord': 'record_delete',
  
  // Associations
  'AssociationCreated': 'association_create',
  'AssociationUpdated': 'association_update',
  'AssociationDeleted': 'association_delete',
  'RelationCreate': 'relation_create',
  'RelationDelete': 'relation_delete',
  
  // Other
  'LCEmailStats': 'email_stats',
  'PLAN_CHANGE': 'plan_change',
  'EXTERNAL_AUTH_CONNECTED': 'external_auth_connected'
};

export async function processNativeWebhook(db: any, queueItem: any) {
  const { type, payload, webhookId } = queueItem;
  const mappedType = WEBHOOK_TYPE_MAP[type] || type;
  
  console.log(`[Native Webhook ${webhookId}] Processing ${type} as ${mappedType}`);
  
  try {
    switch (type) {
      // Contact Events
      case 'ContactCreate':
      case 'ContactUpdate':
        await processContactChange(db, payload, webhookId, type);
        break;
        
      case 'ContactDelete':
        await processContactDelete(db, payload, webhookId);
        break;
        
      case 'ContactTagUpdate':
        await processContactTagUpdate(db, payload, webhookId);
        break;
        
      case 'ContactDndUpdate':
        await processContactDndUpdate(db, payload, webhookId);
        break;
        
      // Appointment Events
      case 'AppointmentCreate':
      case 'AppointmentUpdate':
      case 'AppointmentDelete':
        await processAppointmentEvent(db, payload, webhookId, type);
        break;
        
      // Opportunity Events
      case 'OpportunityCreate':
      case 'OpportunityUpdate':
      case 'OpportunityDelete':
      case 'OpportunityStageUpdate':
      case 'OpportunityStatusUpdate':
      case 'OpportunityMonetaryValueUpdate':
      case 'OpportunityAssignedToUpdate':
        await processOpportunityEvent(db, payload, webhookId, type);
        break;
        
      // Message Events
      case 'InboundMessage':
      case 'OutboundMessage':
        await processMessageEvent(db, payload, webhookId, type);
        break;
        
      // Task Events
      case 'TaskCreate':
      case 'TaskComplete':
      case 'TaskDelete':
        await processTaskEvent(db, payload, webhookId, type);
        break;
        
      // Note Events
      case 'NoteCreate':
      case 'NoteDelete':
        await processNoteEvent(db, payload, webhookId, type);
        break;
        
      // Invoice Events
      case 'InvoiceCreate':
      case 'InvoiceUpdate':
      case 'InvoicePaid':
      case 'InvoicePartiallyPaid':
      case 'InvoiceVoid':
      case 'InvoiceDelete':
        await processInvoiceEvent(db, payload, webhookId, type);
        break;
        
      // Order Events
      case 'OrderCreate':
      case 'OrderStatusUpdate':
        await processOrderEvent(db, payload, webhookId, type);
        break;
        
      default:
        console.log(`[Native Webhook ${webhookId}] Unhandled type: ${type}`);
    }
    
    // Mark as completed
    await db.collection('webhook_queue').updateOne(
      { _id: queueItem._id },
      { $set: { status: 'completed', completedAt: new Date() } }
    );
    
  } catch (error: any) {
    console.error(`[Native Webhook ${webhookId}] Processing error:`, error);
    
    // Mark as failed
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

// ===== CONTACT EVENT PROCESSORS =====
// Process contact create/update
async function processContactChange(db: any, payload: any, webhookId: string, eventType: string) {
  const {
    id,
    locationId,
    firstName,
    lastName,
    email,
    phone,
    address1,
    city,
    state,
    postalCode,
    country,
    tags,
    source,
    companyName,
    website,
    dateOfBirth,
    dnd,
    dndSettings,
    assignedTo,
    customFields,
    attachments,
    dateAdded
  } = payload;
  
  if (!id || !locationId) {
    console.log(`[Webhook ${webhookId}] Missing contact ID or location ID`);
    return;
  }
  
  const contactData = {
    ghlContactId: id,
    locationId: locationId,
    firstName: firstName || '',
    lastName: lastName || '',
    email: email || '',
    phone: phone || '',
    address: address1 || '',
    city: city || '',
    state: state || '',
    postalCode: postalCode || '',
    country: country || '',
    tags: tags || [],
    source: source || 'ghl_webhook',
    companyName: companyName || '',
    website: website || '',
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    dnd: dnd || false,
    dndSettings: dndSettings || {},
    assignedTo: assignedTo || null,
    customFields: customFields || [],
    attachments: attachments || [],
    ghlCreatedAt: dateAdded ? new Date(dateAdded) : null,
    lastWebhookUpdate: new Date(),
    lastWebhookId: webhookId
  };
  
  // Remove null values
  Object.keys(contactData).forEach(key => {
    if (contactData[key] === null || contactData[key] === undefined) {
      delete contactData[key];
    }
  });
  
  // Check if contact exists
  const existing = await db.collection('contacts').findOne({
    ghlContactId: id,
    locationId: locationId
  });
  
  if (!existing && eventType === 'ContactCreate') {
    // Create new contact
    await db.collection('contacts').insertOne({
      _id: new ObjectId(),
      ...contactData,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByWebhook: webhookId
    });
    console.log(`[Webhook ${webhookId}] Created contact: ${email}`);
    
  } else if (existing) {
    // Update existing contact
    await db.collection('contacts').updateOne(
      { _id: existing._id },
      {
        $set: {
          ...contactData,
          updatedAt: new Date()
        }
      }
    );
    console.log(`[Webhook ${webhookId}] Updated contact: ${email}`);
  }
}

// Process contact delete
async function processContactDelete(db: any, payload: any, webhookId: string) {
  const { id, locationId } = payload;
  
  const contact = await db.collection('contacts').findOne({
    ghlContactId: id,
    locationId: locationId
  });
  
  if (contact) {
    // Soft delete - mark as deleted but keep record
    await db.collection('contacts').updateOne(
      { _id: contact._id },
      {
        $set: {
          deleted: true,
          deletedAt: new Date(),
          deletedByWebhook: webhookId
        }
      }
    );
    console.log(`[Webhook ${webhookId}] Soft deleted contact: ${contact.email}`);
  }
}

// Process contact tag update
async function processContactTagUpdate(db: any, payload: any, webhookId: string) {
  const { id, locationId, tags } = payload;
  
  await db.collection('contacts').updateOne(
    { ghlContactId: id, locationId: locationId },
    {
      $set: {
        tags: tags || [],
        updatedAt: new Date(),
        lastWebhookUpdate: new Date(),
        lastWebhookId: webhookId
      }
    }
  );
  console.log(`[Webhook ${webhookId}] Updated tags for contact ${id}`);
}

// Process contact DND update
async function processContactDndUpdate(db: any, payload: any, webhookId: string) {
  const { id, locationId, dnd, dndSettings } = payload;
  
  await db.collection('contacts').updateOne(
    { ghlContactId: id, locationId: locationId },
    {
      $set: {
        dnd: dnd || false,
        dndSettings: dndSettings || {},
        updatedAt: new Date(),
        lastWebhookUpdate: new Date(),
        lastWebhookId: webhookId
      }
    }
  );
  console.log(`[Webhook ${webhookId}] Updated DND settings for contact ${id}`);
}

// ===== APPOINTMENT EVENT PROCESSORS =====
// Process appointment events
async function processAppointmentEvent(db: any, payload: any, webhookId: string, eventType: string) {
  const { appointment, locationId } = payload;
  
  if (!appointment || !appointment.id) {
    console.log(`[Webhook ${webhookId}] No appointment data in payload`);
    return;
  }
  
  // Map appointment data
  const appointmentData = {
    ghlAppointmentId: appointment.id,
    locationId: locationId,
    contactId: appointment.contactId,
    calendarId: appointment.calendarId,
    title: appointment.title || '',
    address: appointment.address || '',
    appointmentStatus: appointment.appointmentStatus || 'confirmed',
    assignedUserId: appointment.assignedUserId || null,
    users: appointment.users || [],
    notes: appointment.notes || '',
    source: appointment.source || 'ghl_webhook',
    start: new Date(appointment.startTime),
    end: new Date(appointment.endTime),
    dateAdded: appointment.dateAdded ? new Date(appointment.dateAdded) : new Date(),
    dateUpdated: appointment.dateUpdated ? new Date(appointment.dateUpdated) : new Date(),
    groupId: appointment.groupId || null
  };
  
  if (eventType === 'AppointmentDelete') {
    // Soft delete appointment
    await db.collection('appointments').updateOne(
      { ghlAppointmentId: appointment.id },
      {
        $set: {
          deleted: true,
          deletedAt: new Date(),
          deletedByWebhook: webhookId,
          status: 'cancelled'
        }
      }
    );
    console.log(`[Webhook ${webhookId}] Deleted appointment ${appointment.id}`);
    return;
  }
  
  // Find contact in our DB
  let contact = await db.collection('contacts').findOne({
    ghlContactId: appointment.contactId,
    locationId: locationId
  });
  
  if (!contact) {
    console.log(`[Webhook ${webhookId}] Contact not found for appointment, creating basic contact`);
    // Create basic contact
    const newContact = await db.collection('contacts').insertOne({
      _id: new ObjectId(),
      ghlContactId: appointment.contactId,
      locationId: locationId,
      firstName: 'Unknown',
      lastName: 'Contact',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByWebhook: webhookId,
      source: 'appointment_webhook'
    });
    contact = { _id: newContact.insertedId };
  }
  
  // Update appointment data with our contact ID
  appointmentData.contactId = contact._id.toString();
  
  // Check if appointment exists
  const existing = await db.collection('appointments').findOne({
    ghlAppointmentId: appointment.id
  });
  
  if (!existing && eventType === 'AppointmentCreate') {
    // Create new appointment
    await db.collection('appointments').insertOne({
      _id: new ObjectId(),
      ...appointmentData,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByWebhook: webhookId
    });
    console.log(`[Webhook ${webhookId}] Created appointment ${appointment.id}`);
    
  } else if (existing) {
    // Update existing appointment
    await db.collection('appointments').updateOne(
      { _id: existing._id },
      {
        $set: {
          ...appointmentData,
          updatedAt: new Date(),
          lastWebhookUpdate: new Date(),
          lastWebhookId: webhookId
        }
      }
    );
    console.log(`[Webhook ${webhookId}] Updated appointment ${appointment.id}`);
  }
  
  // Update project timeline if contact has active projects
  const activeProject = await db.collection('projects').findOne({
    contactId: contact._id.toString(),
    locationId: locationId,
    status: { $in: ['open', 'in_progress', 'quoted', 'won'] }
  });
  
  if (activeProject) {
    const timelineEvent = {
      id: new ObjectId().toString(),
      event: eventType === 'AppointmentCreate' ? 'appointment_scheduled' : 'appointment_updated',
      description: `${appointment.title} - ${appointment.appointmentStatus}`,
      timestamp: new Date().toISOString(),
      metadata: {
        appointmentId: appointment.id,
        status: appointment.appointmentStatus,
        webhookId
      }
    };
    
    await db.collection('projects').updateOne(
      { _id: activeProject._id },
      {
        $push: { timeline: timelineEvent }
      }
    );
  }
}

// ===== OPPORTUNITY/PROJECT EVENT PROCESSORS =====
// Process opportunity events (projects in your system)
async function processOpportunityEvent(db: any, payload: any, webhookId: string, eventType: string) {
  const {
    id,
    locationId,
    assignedTo,
    contactId,
    monetaryValue,
    name,
    pipelineId,
    pipelineStageId,
    source,
    status,
    dateAdded
  } = payload;
  
  if (!id || !locationId || !contactId) {
    console.log(`[Webhook ${webhookId}] Missing required opportunity fields`);
    return;
  }
  
  // Find contact in our DB
  const contact = await db.collection('contacts').findOne({
    ghlContactId: contactId,
    locationId: locationId
  });
  
  if (!contact) {
    console.log(`[Webhook ${webhookId}] Contact not found for opportunity ${id}`);
    return;
  }
  
  const projectData = {
    ghlOpportunityId: id,
    locationId: locationId,
    contactId: contact._id.toString(),
    title: name || 'Untitled Project',
    assignedTo: assignedTo || null,
    monetaryValue: parseFloat(monetaryValue) || 0,
    pipelineId: pipelineId || '',
    pipelineStageId: pipelineStageId || '',
    source: source || 'ghl_webhook',
    status: mapGHLStatusToProjectStatus(status),
    ghlCreatedAt: dateAdded ? new Date(dateAdded) : null,
    lastWebhookUpdate: new Date(),
    lastWebhookId: webhookId
  };
  
  if (eventType === 'OpportunityDelete') {
    // Soft delete
    await db.collection('projects').updateOne(
      { ghlOpportunityId: id },
      {
        $set: {
          deleted: true,
          deletedAt: new Date(),
          deletedByWebhook: webhookId,
          status: 'deleted'
        }
      }
    );
    console.log(`[Webhook ${webhookId}] Deleted opportunity/project ${id}`);
    return;
  }
  
  // Check if project exists
  const existing = await db.collection('projects').findOne({
    ghlOpportunityId: id
  });
  
  if (!existing && eventType === 'OpportunityCreate') {
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
    console.log(`[Webhook ${webhookId}] Created project from opportunity ${id}`);
    
  } else if (existing) {
    // Build timeline entry based on event type
    let timelineEvent = null;
    
    switch (eventType) {
      case 'OpportunityStageUpdate':
        timelineEvent = {
          id: new ObjectId().toString(),
          event: 'stage_changed',
          description: `Stage changed to ${pipelineStageId}`,
          timestamp: new Date().toISOString(),
          metadata: { 
            webhookId,
            previousStage: existing.pipelineStageId,
            newStage: pipelineStageId
          }
        };
        break;
        
      case 'OpportunityStatusUpdate':
        timelineEvent = {
          id: new ObjectId().toString(),
          event: 'status_changed',
          description: `Status changed to ${status}`,
          timestamp: new Date().toISOString(),
          metadata: { 
            webhookId,
            previousStatus: existing.status,
            newStatus: projectData.status
          }
        };
        break;
        
      case 'OpportunityMonetaryValueUpdate':
        timelineEvent = {
          id: new ObjectId().toString(),
          event: 'value_changed',
          description: `Value changed from $${existing.monetaryValue} to $${monetaryValue}`,
          timestamp: new Date().toISOString(),
          metadata: { 
            webhookId,
            previousValue: existing.monetaryValue,
            newValue: parseFloat(monetaryValue)
          }
        };
        break;
        
      case 'OpportunityAssignedToUpdate':
        timelineEvent = {
          id: new ObjectId().toString(),
          event: 'assigned_changed',
          description: `Assigned to ${assignedTo || 'Unassigned'}`,
          timestamp: new Date().toISOString(),
          metadata: { 
            webhookId,
            previousAssigned: existing.assignedTo,
            newAssigned: assignedTo
          }
        };
        break;
    }
    
    // Update project
    const updateData: any = {
      ...projectData,
      updatedAt: new Date()
    };
    
    if (timelineEvent) {
      await db.collection('projects').updateOne(
        { _id: existing._id },
        {
          $set: updateData,
          $push: { timeline: timelineEvent }
        }
      );
    } else {
      await db.collection('projects').updateOne(
        { _id: existing._id },
        { $set: updateData }
      );
    }
    
    console.log(`[Webhook ${webhookId}] Updated project ${id} - ${eventType}`);
  }
}

// Helper function to map GHL status to project status
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

// ===== MESSAGE EVENT PROCESSORS =====
async function processMessageEvent(db: any, payload: any, webhookId: string, eventType: string) {
  // TODO: Implement message processing
  console.log(`[Webhook ${webhookId}] Message event processing not implemented yet`);
}

// ===== TASK EVENT PROCESSORS =====
async function processTaskEvent(db: any, payload: any, webhookId: string, eventType: string) {
  // TODO: Implement task processing
  console.log(`[Webhook ${webhookId}] Task event processing not implemented yet`);
}

// ===== NOTE EVENT PROCESSORS =====
async function processNoteEvent(db: any, payload: any, webhookId: string, eventType: string) {
  // TODO: Implement note processing
  console.log(`[Webhook ${webhookId}] Note event processing not implemented yet`);
}

// ===== INVOICE EVENT PROCESSORS =====
async function processInvoiceEvent(db: any, payload: any, webhookId: string, eventType: string) {
  // TODO: Implement invoice processing
  console.log(`[Webhook ${webhookId}] Invoice event processing not implemented yet`);
}

// ===== ORDER EVENT PROCESSORS =====
async function processOrderEvent(db: any, payload: any, webhookId: string, eventType: string) {
  // TODO: Implement order processing
  console.log(`[Webhook ${webhookId}] Order event processing not implemented yet`);
}