// src/utils/webhooks/nativeWebhookProcessor.ts
import { ObjectId } from 'mongodb';

export async function processNativeWebhook(db: any, queueItem: any) {
  const { type, payload, webhookId } = queueItem;
  
  try {
    // Mark as processing
    await db.collection('webhook_queue').updateOne(
      { _id: queueItem._id },
      { $set: { status: 'processing', startedAt: new Date() } }
    );
    
    console.log(`[Native Webhook ${webhookId}] Processing ${type} webhook`);
    
    // Process based on type
    switch (type) {
      // Contact Events
      case 'ContactCreate':
        await processContactCreate(db, payload, webhookId);
        break;
      case 'ContactUpdate':
        await processContactUpdate(db, payload, webhookId);
        break;
      case 'ContactDelete':
        await processContactDelete(db, payload, webhookId);
        break;
      case 'ContactDndUpdate':
        await processContactDndUpdate(db, payload, webhookId);
        break;
      case 'ContactTagUpdate':
        await processContactTagUpdate(db, payload, webhookId);
        break;
        
      // Appointment Events
      case 'AppointmentCreate':
        await processAppointmentCreate(db, payload, webhookId);
        break;
      case 'AppointmentUpdate':
        await processAppointmentUpdate(db, payload, webhookId);
        break;
      case 'AppointmentDelete':
        await processAppointmentDelete(db, payload, webhookId);
        break;
        
      // Opportunity Events
      case 'OpportunityCreate':
        await processOpportunityCreate(db, payload, webhookId);
        break;
      case 'OpportunityUpdate':
        await processOpportunityUpdate(db, payload, webhookId);
        break;
      case 'OpportunityDelete':
        await processOpportunityDelete(db, payload, webhookId);
        break;
      case 'OpportunityStageUpdate':
        await processOpportunityStageUpdate(db, payload, webhookId);
        break;
      case 'OpportunityStatusUpdate':
        await processOpportunityStatusUpdate(db, payload, webhookId);
        break;
      case 'OpportunityMonetaryValueUpdate':
        await processOpportunityMonetaryValueUpdate(db, payload, webhookId);
        break;
      case 'OpportunityAssignedToUpdate':
        await processOpportunityAssignedToUpdate(db, payload, webhookId);
        break;
        
      // Task Events
      case 'TaskCreate':
        await processTaskCreate(db, payload, webhookId);
        break;
      case 'TaskComplete':
        await processTaskComplete(db, payload, webhookId);
        break;
      case 'TaskDelete':
        await processTaskDelete(db, payload, webhookId);
        break;
        
      // Note Events
      case 'NoteCreate':
        await processNoteCreate(db, payload, webhookId);
        break;
      case 'NoteDelete':
        await processNoteDelete(db, payload, webhookId);
        break;
        
      // Message Events
      case 'InboundMessage':
        await processInboundMessage(db, payload, webhookId);
        break;
      case 'OutboundMessage':
        await processOutboundMessage(db, payload, webhookId);
        break;
        
      // Invoice Events
      case 'InvoiceCreate':
        await processInvoiceCreate(db, payload, webhookId);
        break;
      case 'InvoiceUpdate':
        await processInvoiceUpdate(db, payload, webhookId);
        break;
      case 'InvoiceDelete':
        await processInvoiceDelete(db, payload, webhookId);
        break;
      case 'InvoiceVoid':
        await processInvoiceVoid(db, payload, webhookId);
        break;
      case 'InvoicePaid':
        await processInvoicePaid(db, payload, webhookId);
        break;
      case 'InvoicePartiallyPaid':
        await processInvoicePartiallyPaid(db, payload, webhookId);
        break;
        
      // Order Events
      case 'OrderCreate':
        await processOrderCreate(db, payload, webhookId);
        break;
      case 'OrderStatusUpdate':
        await processOrderStatusUpdate(db, payload, webhookId);
        break;
        
      // Product/Price Events
      case 'ProductCreate':
        await processProductCreate(db, payload, webhookId);
        break;
      case 'ProductUpdate':
        await processProductUpdate(db, payload, webhookId);
        break;
      case 'ProductDelete':
        await processProductDelete(db, payload, webhookId);
        break;
      case 'PriceCreate':
        await processPriceCreate(db, payload, webhookId);
        break;
      case 'PriceUpdate':
        await processPriceUpdate(db, payload, webhookId);
        break;
      case 'PriceDelete':
        await processPriceDelete(db, payload, webhookId);
        break;
        
      // User Events
      case 'UserCreate':
        await processUserCreate(db, payload, webhookId);
        break;
        
      // Location Events
      case 'LocationCreate':
        await processLocationCreate(db, payload, webhookId);
        break;
      case 'LocationUpdate':
        await processLocationUpdate(db, payload, webhookId);
        break;
        
      // Campaign Events
      case 'CampaignStatusUpdate':
        await processCampaignStatusUpdate(db, payload, webhookId);
        break;
        
      // Conversation Events
      case 'ConversationUnreadUpdate':
        await processConversationUnreadUpdate(db, payload, webhookId);
        break;
      case 'ConversationProviderOutboundMessage':
        await processConversationProviderOutboundMessage(db, payload, webhookId);
        break;
        
      // LC Email Events
      case 'LCEmailStats':
        await processLCEmailStats(db, payload, webhookId);
        break;
        
      // App Events
      case 'INSTALL':
        await processInstallEvent(db, payload, webhookId);
        break;
      case 'UNINSTALL':
        await processUninstallEvent(db, payload, webhookId);
        break;
      case 'PLAN_CHANGE':
        await processPlanChange(db, payload, webhookId);
        break;
        
      // External Auth Events
      case 'EXTERNAL_AUTH_CONNECTED':
        await processExternalAuthConnected(db, payload, webhookId);
        break;
        
      // Object Events
      case 'ObjectSchemaCreate':
        await processObjectSchemaCreate(db, payload, webhookId);
        break;
      case 'UpdateCustomObject':
        await processUpdateCustomObject(db, payload, webhookId);
        break;
      case 'RecordCreate':
        await processRecordCreate(db, payload, webhookId);
        break;
      case 'RecordUpdate':
        await processRecordUpdate(db, payload, webhookId);
        break;
      case 'DeleteRecord':
        await processDeleteRecord(db, payload, webhookId);
        break;
        
      // Association Events
      case 'AssociationCreated':
        await processAssociationCreated(db, payload, webhookId);
        break;
      case 'AssociationUpdated':
        await processAssociationUpdated(db, payload, webhookId);
        break;
      case 'AssociationDeleted':
        await processAssociationDeleted(db, payload, webhookId);
        break;
      case 'RelationCreate':
        await processRelationCreate(db, payload, webhookId);
        break;
      case 'RelationDelete':
        await processRelationDelete(db, payload, webhookId);
        break;
        
      default:
        console.log(`[Native Webhook ${webhookId}] Unknown event type: ${type}`);
    }
    
    // Mark as completed
    await db.collection('webhook_queue').updateOne(
      { _id: queueItem._id },
      { $set: { status: 'completed', completedAt: new Date() } }
    );
    
  } catch (error: any) {
    console.error(`[Native Webhook ${webhookId}] Processing error:`, error);
    
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

// Contact Event Handlers
async function processContactCreate(db: any, payload: any, webhookId: string) {
  const { locationId, id, email, firstName, lastName, phone } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Creating contact ${email} for location ${locationId}`);
  
  await db.collection('contacts').updateOne(
    { ghlContactId: id, locationId },
    {
      $set: {
        ghlContactId: id,
        locationId,
        email,
        firstName,
        lastName,
        phone,
        fullName: `${firstName || ''} ${lastName || ''}`.trim(),
        tags: payload.tags || [],
        source: payload.source || 'webhook',
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
        address1: payload.address1,
        city: payload.city,
        state: payload.state,
        country: payload.country,
        postalCode: payload.postalCode,
        companyName: payload.companyName,
        website: payload.website,
        dnd: payload.dnd || false,
        dndSettings: payload.dndSettings,
        customFields: payload.customFields || [],
        lastWebhookUpdate: new Date(),
        updatedAt: new Date()
      },
      $setOnInsert: {
        _id: new ObjectId(),
        createdAt: new Date(),
        createdByWebhook: webhookId
      }
    },
    { upsert: true }
  );
}

async function processContactUpdate(db: any, payload: any, webhookId: string) {
  const { locationId, id } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Updating contact ${id} for location ${locationId}`);
  
  const updateData: any = {
    lastWebhookUpdate: new Date(),
    updatedAt: new Date()
  };
  
  // Only update fields that are present in the payload
  const fieldsToUpdate = [
    'email', 'firstName', 'lastName', 'phone', 'tags', 'source',
    'dateOfBirth', 'address1', 'city', 'state', 'country', 'postalCode',
    'companyName', 'website', 'dnd', 'dndSettings', 'customFields'
  ];
  
  fieldsToUpdate.forEach(field => {
    if (payload[field] !== undefined) {
      updateData[field] = payload[field];
    }
  });
  
  // Update fullName if name fields changed
  if (payload.firstName !== undefined || payload.lastName !== undefined) {
    updateData.fullName = `${payload.firstName || ''} ${payload.lastName || ''}`.trim();
  }
  
  await db.collection('contacts').updateOne(
    { ghlContactId: id, locationId },
    { $set: updateData }
  );
}

async function processContactDelete(db: any, payload: any, webhookId: string) {
  const { locationId, id } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Deleting contact ${id} for location ${locationId}`);
  
  await db.collection('contacts').updateOne(
    { ghlContactId: id, locationId },
    { 
      $set: { 
        deleted: true,
        deletedAt: new Date(),
        deletedByWebhook: webhookId
      } 
    }
  );
}

async function processContactDndUpdate(db: any, payload: any, webhookId: string) {
  const { locationId, id, dnd, dndSettings } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Updating DND for contact ${id}`);
  
  await db.collection('contacts').updateOne(
    { ghlContactId: id, locationId },
    { 
      $set: { 
        dnd,
        dndSettings,
        lastWebhookUpdate: new Date()
      } 
    }
  );
}

async function processContactTagUpdate(db: any, payload: any, webhookId: string) {
  const { locationId, id, tags } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Updating tags for contact ${id}`);
  
  await db.collection('contacts').updateOne(
    { ghlContactId: id, locationId },
    { 
      $set: { 
        tags: tags || [],
        lastWebhookUpdate: new Date()
      } 
    }
  );
}

// Appointment Event Handlers
async function processAppointmentCreate(db: any, payload: any, webhookId: string) {
  const { locationId, appointment } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Creating appointment ${appointment.id}`);
  
  await db.collection('appointments').updateOne(
    { ghlAppointmentId: appointment.id, locationId },
    {
      $set: {
        ghlAppointmentId: appointment.id,
        locationId,
        contactId: appointment.contactId,
        calendarId: appointment.calendarId,
        groupId: appointment.groupId,
        title: appointment.title,
        appointmentStatus: appointment.appointmentStatus,
        assignedUserId: appointment.assignedUserId,
        users: appointment.users || [],
        notes: appointment.notes,
        source: appointment.source,
        startTime: new Date(appointment.startTime),
        endTime: new Date(appointment.endTime),
        address: appointment.address,
        lastWebhookUpdate: new Date(),
        updatedAt: new Date()
      },
      $setOnInsert: {
        _id: new ObjectId(),
        createdAt: new Date(),
        createdByWebhook: webhookId
      }
    },
    { upsert: true }
  );
}

async function processAppointmentUpdate(db: any, payload: any, webhookId: string) {
  const { locationId, appointment } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Updating appointment ${appointment.id}`);
  
  const updateData: any = {
    lastWebhookUpdate: new Date(),
    updatedAt: new Date()
  };
  
  // Update fields that might change
  const fieldsToUpdate = [
    'title', 'appointmentStatus', 'assignedUserId', 'users',
    'notes', 'source', 'address'
  ];
  
  fieldsToUpdate.forEach(field => {
    if (appointment[field] !== undefined) {
      updateData[field] = appointment[field];
    }
  });
  
  // Handle date fields
  if (appointment.startTime) updateData.startTime = new Date(appointment.startTime);
  if (appointment.endTime) updateData.endTime = new Date(appointment.endTime);
  
  await db.collection('appointments').updateOne(
    { ghlAppointmentId: appointment.id, locationId },
    { $set: updateData }
  );
}

async function processAppointmentDelete(db: any, payload: any, webhookId: string) {
  const { locationId, appointment } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Deleting appointment ${appointment.id}`);
  
  await db.collection('appointments').updateOne(
    { ghlAppointmentId: appointment.id, locationId },
    { 
      $set: { 
        deleted: true,
        deletedAt: new Date(),
        deletedByWebhook: webhookId
      } 
    }
  );
}

// Message Event Handlers
async function processInboundMessage(db: any, payload: any, webhookId: string) {
  const { locationId, contactId, conversationId, message } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Processing inbound message`);
  console.log(`[Native Webhook ${webhookId}] Message type: ${message?.type}`);
  
  try {
    // Find contact by GHL ID
    const contact = await db.collection('contacts').findOne({
      ghlContactId: contactId,
      locationId: locationId
    });
    
    if (!contact) {
      console.warn(`[Native Webhook ${webhookId}] Contact not found: ${contactId}`);
      return;
    }
    
    // Find or create conversation
    const conversationData = {
      ghlConversationId: conversationId || message.conversationId,
      locationId: locationId,
      contactId: contact._id.toString(),
      type: message.type === 1 ? 'TYPE_PHONE' : message.type === 3 ? 'TYPE_EMAIL' : 'TYPE_OTHER',
      lastMessageDate: new Date(),
      lastMessageBody: message.body?.substring(0, 200) || '', // Preview
      lastMessageType: getMessageTypeName(message.type),
      lastMessageDirection: 'inbound',
      contactName: contact.fullName || `${contact.firstName} ${contact.lastName}`,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      updatedAt: new Date()
    };
    
    const conversation = await db.collection('conversations').findOneAndUpdate(
      { 
        ghlConversationId: conversationId,
        locationId: locationId 
      },
      {
        $set: conversationData,
        $inc: { unreadCount: 1 },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: new Date(),
          createdByWebhook: webhookId
        }
      },
      { 
        upsert: true,
        returnDocument: 'after'
      }
    );
    
    // Store the message
    const messageData: any = {
      _id: new ObjectId(),
      ghlMessageId: message.id,
      conversationId: conversation.value._id.toString(),
      ghlConversationId: conversationId,
      locationId: locationId,
      contactId: contact._id.toString(),
      type: message.type,
      messageType: message.messageType || getMessageTypeName(message.type),
      direction: 'inbound',
      contentType: message.contentType,
      source: message.source || 'webhook',
      dateAdded: new Date(message.dateAdded || Date.now()),
      read: false,
      createdAt: new Date(),
      createdByWebhook: webhookId
    };
    
    // Handle different message types
    switch (message.type) {
      case 1: // SMS
        messageData.body = message.body || '';
        messageData.status = message.status || 'received';
        break;
        
      case 3: // Email
        // For emails, store the reference only
        if (message.meta?.email?.messageIds?.[0]) {
          messageData.emailMessageId = message.meta.email.messageIds[0];
          messageData.needsContentFetch = true;
          // Don't store full HTML body
        }
        break;
        
      case 4: // WhatsApp
        messageData.body = message.body || '';
        messageData.mediaUrl = message.mediaUrl;
        messageData.mediaType = message.mediaType;
        break;
        
      default:
        messageData.body = message.body || '';
        messageData.meta = message.meta || {};
    }
    
    // Find related project if exists
    const project = await db.collection('projects').findOne({
      contactId: contact._id.toString(),
      locationId: locationId,
      status: { $in: ['open', 'quoted', 'won', 'in_progress'] }
    });
    
    if (project) {
      messageData.projectId = project._id.toString();
    }
    
    await db.collection('messages').insertOne(messageData);
    
    console.log(`[Native Webhook ${webhookId}] Inbound message processed: ${message.type}`);
    
    // TODO: Send push notification to assigned users
    
  } catch (error: any) {
    console.error(`[Native Webhook ${webhookId}] Error processing inbound message:`, error);
    throw error;
  }
}

async function processOutboundMessage(db: any, payload: any, webhookId: string) {
  const { locationId, contactId, conversationId, message, userId } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Processing outbound message`);
  
  try {
    // Find contact
    const contact = await db.collection('contacts').findOne({
      ghlContactId: contactId,
      locationId: locationId
    });
    
    if (!contact) {
      console.warn(`[Native Webhook ${webhookId}] Contact not found: ${contactId}`);
      return;
    }
    
    // Find user who sent it (if available)
    let senderId = null;
    if (userId) {
      const user = await db.collection('users').findOne({
        ghlUserId: userId,
        locationId: locationId
      });
      if (user) {
        senderId = user._id.toString();
      }
    }
    
    // Update conversation
    const conversationData = {
      ghlConversationId: conversationId,
      locationId: locationId,
      contactId: contact._id.toString(),
      type: message.type === 1 ? 'TYPE_PHONE' : message.type === 3 ? 'TYPE_EMAIL' : 'TYPE_OTHER',
      lastMessageDate: new Date(),
      lastMessageBody: message.body?.substring(0, 200) || '', // Preview
      lastMessageType: getMessageTypeName(message.type),
      lastMessageDirection: 'outbound',
      lastOutboundMessageAction: message.source || 'manual',
      lastManualMessageDate: message.source === 'manual' ? new Date() : undefined,
      contactName: contact.fullName || `${contact.firstName} ${contact.lastName}`,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      updatedAt: new Date()
    };
    
    const conversation = await db.collection('conversations').findOneAndUpdate(
      { 
        ghlConversationId: conversationId,
        locationId: locationId 
      },
      {
        $set: conversationData,
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: new Date(),
          createdByWebhook: webhookId,
          unreadCount: 0
        }
      },
      { 
        upsert: true,
        returnDocument: 'after'
      }
    );
    
    // Store the message
    const messageData: any = {
      _id: new ObjectId(),
      ghlMessageId: message.id,
      conversationId: conversation.value._id.toString(),
      ghlConversationId: conversationId,
      locationId: locationId,
      contactId: contact._id.toString(),
      userId: senderId,
      type: message.type,
      messageType: message.messageType || getMessageTypeName(message.type),
      direction: 'outbound',
      contentType: message.contentType,
      source: message.source || 'manual',
      dateAdded: new Date(message.dateAdded || Date.now()),
      read: true, // Outbound messages are always "read"
      createdAt: new Date(),
      createdByWebhook: webhookId
    };
    
    // Handle different message types
    switch (message.type) {
      case 1: // SMS
        messageData.body = message.body || '';
        messageData.status = message.status || 'sent';
        break;
        
      case 3: // Email
        // For emails, store the reference only
        if (message.meta?.email?.messageIds?.[0]) {
          messageData.emailMessageId = message.meta.email.messageIds[0];
          messageData.needsContentFetch = true;
        }
        break;
        
      default:
        messageData.body = message.body || '';
        messageData.meta = message.meta || {};
    }
    
    // Find related project
    const project = await db.collection('projects').findOne({
      contactId: contact._id.toString(),
      locationId: locationId,
      status: { $in: ['open', 'quoted', 'won', 'in_progress'] }
    });
    
    if (project) {
      messageData.projectId = project._id.toString();
    }
    
    await db.collection('messages').insertOne(messageData);
    
    console.log(`[Native Webhook ${webhookId}] Outbound message processed: ${message.type}`);
    
  } catch (error: any) {
    console.error(`[Native Webhook ${webhookId}] Error processing outbound message:`, error);
    throw error;
  }
}

// Conversation Event Handlers
async function processConversationUnreadUpdate(db: any, payload: any, webhookId: string) {
  const { locationId, conversationId, unreadCount } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Updating conversation unread count`);
  
  try {
    await db.collection('conversations').updateOne(
      {
        ghlConversationId: conversationId,
        locationId: locationId
      },
      {
        $set: {
          unreadCount: unreadCount || 0,
          lastWebhookUpdate: new Date()
        }
      }
    );
    
    console.log(`[Native Webhook ${webhookId}] Updated unread count to ${unreadCount}`);
    
  } catch (error: any) {
    console.error(`[Native Webhook ${webhookId}] Error updating conversation:`, error);
    throw error;
  }
}

// App Install/Uninstall/Update Event Handlers with LOCKING
async function processInstallEvent(db: any, payload: any, webhookId: string) {
  const { installType, locationId, companyId, userId, companyName, whitelabelDetails, planId } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Processing ${installType} install`);
  console.log(`[Native Webhook ${webhookId}] Full payload:`, JSON.stringify(payload, null, 2));
  
  // Import our install queue utilities
  const { acquireInstallLock, releaseInstallLock, queueInstallForRetry, checkInstallState } = await import('../installQueue');
  
  // Try to acquire install lock
  const lockAcquired = await acquireInstallLock(db, companyId, locationId, webhookId);
  
  if (!lockAcquired) {
    console.log(`[Native Webhook ${webhookId}] Could not acquire lock, queueing for retry`);
    await queueInstallForRetry(db, payload, webhookId, 'Could not acquire install lock');
    return;
  }
  
  try {
    if (installType === 'Location' && locationId) {
      // Check if location is already being installed
      const { isInstalling, isComplete } = await checkInstallState(db, locationId);
      
      if (isInstalling) {
        console.log(`[Native Webhook ${webhookId}] Location ${locationId} install already in progress`);
        return;
      }
      
      if (isComplete) {
        console.log(`[Native Webhook ${webhookId}] Location ${locationId} already installed`);
        return;
      }
      
      // Location-specific install
      await db.collection('locations').updateOne(
        { locationId },
        {
          $set: {
            locationId: locationId,
            companyId: companyId,
            name: companyName || `Location ${locationId}`,
            appInstalled: true,
            installedAt: new Date(payload.timestamp),
            installedBy: userId,
            installType: 'Location',
            isWhitelabelCompany: payload.isWhitelabelCompany || false,
            whitelabelDetails: whitelabelDetails,
            planId: planId,
            installState: 'in_progress',
            installStarted: new Date(),
            lastWebhookUpdate: new Date(),
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date(),
            createdByWebhook: webhookId
          }
        },
        { upsert: true }
      );
      console.log(`[Native Webhook ${webhookId}] Location ${locationId} install processed`);
      
      // Trigger location setup after install
      try {
        console.log(`[Native Webhook ${webhookId}] Triggering location setup for ${locationId}`);
        
        // Add delay to ensure company tokens are ready if this is from agency install
        if (payload.companyId) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
        
        // Call the setup endpoint
        const setupResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app'}/api/locations/setup-location`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            locationId: locationId,
            fullSync: true
          })
        });
        
        if (setupResponse.ok) {
          const setupResult = await setupResponse.json();
          console.log(`[Native Webhook ${webhookId}] Location setup completed:`, setupResult.message);
          
          // Update location with setup results
          await db.collection('locations').updateOne(
            { locationId },
            {
              $set: {
                setupTriggeredBy: webhookId,
                setupTriggeredAt: new Date(),
                initialSetupComplete: true,
                installState: 'complete',
                installCompleted: new Date()
              }
            }
          );
        } else {
          const error = await setupResponse.text();
          console.error(`[Native Webhook ${webhookId}] Location setup failed:`, error);
          
          // Mark setup as failed but don't fail the webhook
          await db.collection('locations').updateOne(
            { locationId },
            {
              $set: {
                setupTriggeredBy: webhookId,
                setupTriggeredAt: new Date(),
                setupFailed: true,
                setupError: error,
                installState: 'setup_failed'
              }
            }
          );
        }
      } catch (setupError: any) {
        console.error(`[Native Webhook ${webhookId}] Failed to trigger location setup:`, setupError.message);
        
        // Store error but don't fail the webhook
        await db.collection('locations').updateOne(
          { locationId },
          {
            $set: {
              setupError: setupError.message,
              needsManualSetup: true,
              installState: 'setup_failed'
            }
          }
        );
      }
      
    } else if (installType === 'Company' && companyId) {
      // Check if company is already installed
      const existingCompany = await db.collection('locations').findOne({
        companyId: companyId,
        locationId: null,
        isCompanyLevel: true
      });
      
      if (existingCompany?.appInstalled) {
        console.log(`[Native Webhook ${webhookId}] Company ${companyId} already installed`);
        return;
      }
      
      // Company-level install
      await db.collection('locations').updateOne(
        { companyId: companyId, locationId: null },
        {
          $set: {
            companyId: companyId,
            name: companyName || 'Company-Level Install',
            appInstalled: true,
            installedAt: new Date(payload.timestamp),
            installType: 'Company',
            isCompanyLevel: true,
            planId: planId,
            installState: 'complete',
            lastWebhookUpdate: new Date(),
            updatedAt: new Date()
          },
          $setOnInsert: {
            locationId: null,
            createdAt: new Date(),
            createdByWebhook: webhookId
          }
        },
        { upsert: true }
      );
      console.log(`[Native Webhook ${webhookId}] Company ${companyId} install processed`);
      
      // For company installs, we should trigger the agency sync with rate limiting
      try {
        console.log(`[Native Webhook ${webhookId}] Queueing agency sync for company ${companyId}`);
        
        // Queue the sync instead of doing it immediately
        await db.collection('sync_queue').insertOne({
          _id: new ObjectId(),
          type: 'agency_sync',
          companyId: companyId,
          webhookId: webhookId,
          status: 'pending',
          attempts: 0,
          createdAt: new Date(),
          scheduledFor: new Date(Date.now() + 5000) // 5 seconds from now
        });
        
        console.log(`[Native Webhook ${webhookId}] Agency sync queued`);
      } catch (syncError: any) {
        console.error(`[Native Webhook ${webhookId}] Failed to queue agency sync:`, syncError.message);
      }
    }
  } finally {
    // Always release the lock
    await releaseInstallLock(db, companyId, locationId, webhookId);
  }
}

async function processUninstallEvent(db: any, payload: any, webhookId: string) {
  const { locationId, companyId } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Processing uninstall`);
  console.log(`[Native Webhook ${webhookId}] LocationId: ${locationId}, CompanyId: ${companyId}`);
  
  if (locationId) {
    // Location-specific uninstall
    const updateData = {
      $set: {
        // Mark as uninstalled
        appInstalled: false,
        uninstalledAt: new Date(payload.timestamp || Date.now()),
        uninstalledBy: payload.userId || 'unknown',
        lastWebhookUpdate: new Date(),
        
        // Preserve the uninstall reason if provided
        uninstallReason: payload.reason || 'User uninstalled'
      },
      $unset: {
        // OAuth tokens - force new auth on reinstall
        ghlOAuth: "",
        hasLocationOAuth: "",
        
        // Installation tracking
        installedAt: "",
        installedBy: "",
        installType: "",
        isWhitelabelCompany: "",
        whitelabelDetails: "",
        planId: "",
        
        // Setup status - clear all setup flags
        setupCompleted: "",
        setupCompletedAt: "",
        setupTriggeredAt: "",
        setupTriggeredBy: "",
        initialSetupComplete: "",
        lastSetupRun: "",
        setupResults: "",
        defaultsSetup: "",
        defaultsSetupAt: "",
        
        // Clear any error/auth states
        needsReauth: "",
        reauthReason: "",
        reauthDate: "",
        setupError: "",
        setupFailed: "",
        needsManualSetup: "",
        
        // Clear sync status (but keep last sync timestamps for reference)
        contactSyncStatus: "",
        appointmentSyncStatus: "",
        conversationSyncStatus: "",
        
        // Clear any temporary flags
        approvvedViaCompany: "",
        hasCompanyOAuth: "",
        derivedFromCompany: ""
      }
    };
    
    // Log what we're preserving
    const preserved = [
      'pipelines', 'calendars', 'customFields', 'ghlCustomFields',
      'termsAndConditions', 'emailTemplates', 'branding', 'companyInfo',
      'business', 'social', 'settings', 'customValues',
      'name', 'email', 'phone', 'address', 'city', 'state', 'country', 'timezone'
    ];
    
    console.log(`[Native Webhook ${webhookId}] Clearing OAuth and installation data`);
    console.log(`[Native Webhook ${webhookId}] Preserving: ${preserved.join(', ')}`);
    
    const result = await db.collection('locations').updateOne(
      { locationId },
      updateData
    );
    
    console.log(`[Native Webhook ${webhookId}] Location ${locationId} uninstall processed, modified: ${result.modifiedCount}`);
    
    // Also update any active sessions/users for this location
    await db.collection('users').updateMany(
      { locationId, isActive: true },
      {
        $set: {
          requiresReauth: true,
          reauthReason: 'App was uninstalled'
        }
      }
    );
    
    // Create an uninstall record for analytics
    await db.collection('app_events').insertOne({
      type: 'uninstall',
      locationId,
      companyId,
      timestamp: new Date(payload.timestamp || Date.now()),
      webhookId,
      metadata: {
        userId: payload.userId,
        reason: payload.reason,
        planId: payload.planId,
        preservedData: preserved
      }
    });
    
  } else if (companyId && !locationId) {
    // Company-level uninstall
    const result = await db.collection('locations').updateOne(
      { companyId, locationId: null, isCompanyLevel: true },
      {
        $set: {
          appInstalled: false,
          uninstalledAt: new Date(payload.timestamp || Date.now()),
          lastWebhookUpdate: new Date()
        },
        $unset: {
          ghlOAuth: "",
          installedAt: "",
          installType: "",
          planId: ""
        }
      }
    );
    
    console.log(`[Native Webhook ${webhookId}] Company ${companyId} uninstall processed, modified: ${result.modifiedCount}`);
    
    // Mark all locations under this company as needing reauth
    await db.collection('locations').updateMany(
      { companyId, locationId: { $ne: null } },
      {
        $set: {
          hasCompanyOAuth: false,
          needsReauth: true,
          reauthReason: 'Company app was uninstalled'
        }
      }
    );
  }
  
  console.log(`[Native Webhook ${webhookId}] Uninstall processing complete`);
}

async function processLocationUpdate(db: any, payload: any, webhookId: string) {
  const { id, name, email, companyId, stripeProductId } = payload;
  
  console.log(`[Native Webhook ${webhookId}] Processing location update for ${id}`);
  console.log(`[Native Webhook ${webhookId}] Name: ${name}, Email: ${email}`);
  
  // Update or create location record
  const result = await db.collection('locations').updateOne(
    { locationId: id },
    {
      $set: {
        locationId: id,
        companyId: companyId,
        name: name,
        email: email,
        stripeProductId: stripeProductId,
        lastUpdated: new Date(payload.timestamp),
        lastWebhookUpdate: new Date(),
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date(),
        createdByWebhook: webhookId,
        source: 'location_update_webhook'
      }
    },
    { upsert: true }
  );
  
  console.log(`[Native Webhook ${webhookId}] Location ${id} update processed - ${result.upsertedCount ? 'created' : 'updated'}`);
}

// Helper function to get message type name
function getMessageTypeName(type: number): string {
  const typeMap: Record<number, string> = {
    1: 'TYPE_SMS',
    3: 'TYPE_EMAIL',
    4: 'TYPE_WHATSAPP',
    5: 'TYPE_GMB',
    6: 'TYPE_FB',
    7: 'TYPE_IG',
    24: 'TYPE_ACTIVITY_APPOINTMENT',
    25: 'TYPE_ACTIVITY_CONTACT',
    26: 'TYPE_ACTIVITY_INVOICE',
    27: 'TYPE_ACTIVITY_OPPORTUNITY',
    28: 'TYPE_ACTIVITY_PAYMENT'
  };
  
  return typeMap[type] || `TYPE_UNKNOWN_${type}`;
}

// Add stub functions for other event types to prevent errors
async function processOpportunityCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] OpportunityCreate not implemented yet`);
}

async function processOpportunityUpdate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] OpportunityUpdate not implemented yet`);
}

async function processOpportunityDelete(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] OpportunityDelete not implemented yet`);
}

async function processOpportunityStageUpdate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] OpportunityStageUpdate not implemented yet`);
}

async function processOpportunityStatusUpdate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] OpportunityStatusUpdate not implemented yet`);
}

async function processOpportunityMonetaryValueUpdate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] OpportunityMonetaryValueUpdate not implemented yet`);
}

async function processOpportunityAssignedToUpdate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] OpportunityAssignedToUpdate not implemented yet`);
}

async function processTaskCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] TaskCreate not implemented yet`);
}

async function processTaskComplete(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] TaskComplete not implemented yet`);
}

async function processTaskDelete(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] TaskDelete not implemented yet`);
}

async function processNoteCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] NoteCreate not implemented yet`);
}

async function processNoteDelete(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] NoteDelete not implemented yet`);
}

async function processInvoiceCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] InvoiceCreate not implemented yet`);
}

async function processInvoiceUpdate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] InvoiceUpdate not implemented yet`);
}

async function processInvoiceDelete(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] InvoiceDelete not implemented yet`);
}

async function processInvoiceVoid(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] InvoiceVoid not implemented yet`);
}

async function processInvoicePaid(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] InvoicePaid not implemented yet`);
}

async function processInvoicePartiallyPaid(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] InvoicePartiallyPaid not implemented yet`);
}

async function processOrderCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] OrderCreate not implemented yet`);
}

async function processOrderStatusUpdate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] OrderStatusUpdate not implemented yet`);
}

async function processProductCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] ProductCreate not implemented yet`);
}

async function processProductUpdate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] ProductUpdate not implemented yet`);
}

async function processProductDelete(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] ProductDelete not implemented yet`);
}

async function processPriceCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] PriceCreate not implemented yet`);
}

async function processPriceUpdate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] PriceUpdate not implemented yet`);
}

async function processPriceDelete(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] PriceDelete not implemented yet`);
}

async function processUserCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] UserCreate not implemented yet`);
}

async function processLocationCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] LocationCreate not implemented yet`);
}

async function processCampaignStatusUpdate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] CampaignStatusUpdate not implemented yet`);
}

async function processConversationProviderOutboundMessage(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] ConversationProviderOutboundMessage not implemented yet`);
}

async function processLCEmailStats(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] LCEmailStats not implemented yet`);
}

async function processPlanChange(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] PlanChange not implemented yet`);
}

async function processExternalAuthConnected(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] ExternalAuthConnected not implemented yet`);
}

async function processObjectSchemaCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] ObjectSchemaCreate not implemented yet`);
}

async function processUpdateCustomObject(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] UpdateCustomObject not implemented yet`);
}

async function processRecordCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] RecordCreate not implemented yet`);
}

async function processRecordUpdate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] RecordUpdate not implemented yet`);
}

async function processDeleteRecord(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] DeleteRecord not implemented yet`);
}

async function processAssociationCreated(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] AssociationCreated not implemented yet`);
}

async function processAssociationUpdated(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] AssociationUpdated not implemented yet`);
}

async function processAssociationDeleted(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] AssociationDeleted not implemented yet`);
}

async function processRelationCreate(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] RelationCreate not implemented yet`);
}

async function processRelationDelete(db: any, payload: any, webhookId: string) {
  console.log(`[Native Webhook ${webhookId}] RelationDelete not implemented yet`);
}