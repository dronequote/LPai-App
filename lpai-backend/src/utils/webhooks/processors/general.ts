// src/utils/webhooks/processors/general.ts
import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId, Db } from 'mongodb';

export class GeneralProcessor extends BaseProcessor {
  constructor(db?: Db) {
    super({
      queueType: 'general',
      batchSize: 100,
      maxRuntime: 50000,
      processorName: 'GeneralProcessor'
    }, db);
  }

  /**
   * Process general webhooks
   */
  protected async processItem(item: QueueItem): Promise<void> {
    const { type, payload, webhookId } = item;

    // Track general processing start
    const generalStartTime = Date.now();

    // Route based on webhook type prefix
    if (type.startsWith('Opportunity')) {
      await this.processOpportunityEvent(type, payload, webhookId);
    } else if (type.startsWith('Task')) {
      await this.processTaskEvent(type, payload, webhookId);
    } else if (type.startsWith('Note')) {
      await this.processNoteEvent(type, payload, webhookId);
    } else if (type.startsWith('Campaign')) {
      await this.processCampaignEvent(type, payload, webhookId);
    } else if (type.startsWith('User')) {
      await this.processUserEvent(type, payload, webhookId);
    } else if (type.startsWith('Location')) {
      await this.processLocationEvent(type, payload, webhookId);
    } else if (type.includes('Object') || type.includes('Record')) {
      await this.processCustomObjectEvent(type, payload, webhookId);
    } else if (type.includes('Association') || type.includes('Relation')) {
      await this.processAssociationEvent(type, payload, webhookId);
    } else {
      console.warn(`[GeneralProcessor] Unhandled event type: ${type}`);
      await this.storeUnhandledEvent(type, payload, webhookId);
    }

    // Track general processing time
    const processingTime = Date.now() - generalStartTime;
    if (processingTime > 2000) {
      console.warn(`[GeneralProcessor] Slow general processing: ${processingTime}ms for ${type}`);
    }
  }

  /**
   * Process opportunity events
   */
  private async processOpportunityEvent(type: string, payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let opportunityData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      opportunityData = payload.webhookPayload;
      locationId = payload.locationId || opportunityData.locationId;
    } else {
      // Direct format
      opportunityData = payload;
      locationId = payload.locationId;
    }
    
    const { opportunity } = opportunityData;
    
    if (!opportunity?.id || !locationId) {
      console.error(`[GeneralProcessor] Missing required opportunity data:`, {
        opportunityId: opportunity?.id,
        locationId: !!locationId,
        type,
        webhookId
      });
      throw new Error('Missing required opportunity data');
    }
    
    console.log(`[GeneralProcessor] Processing ${type} for opportunity ${opportunity.id}`);
    
    switch (type) {
      case 'OpportunityCreate':
        await this.createOpportunity(opportunity, locationId, webhookId);
        break;
        
      case 'OpportunityUpdate':
      case 'OpportunityStageUpdate':
      case 'OpportunityStatusUpdate':
      case 'OpportunityMonetaryValueUpdate':
      case 'OpportunityAssignedToUpdate':
        await this.updateOpportunity(opportunity, locationId, webhookId, type);
        break;
        
      case 'OpportunityDelete':
        await this.deleteOpportunity(opportunity.id, locationId, webhookId);
        break;
        
      default:
        console.log(`[GeneralProcessor] Unhandled opportunity event: ${type}`);
    }
  }

  /**
   * Create opportunity
   */
  private async createOpportunity(opportunity: any, locationId: string, webhookId: string): Promise<void> {
    // Find contact if exists
    let contactId = null;
    if (opportunity.contactId) {
      const contact = await this.db.collection('contacts').findOne(
        {
          ghlContactId: opportunity.contactId,
          locationId
        },
        {
          projection: { _id: 1 }
        }
      );
      if (contact) {
        contactId = contact._id.toString();
      }
    }
    
    await this.db.collection('projects').updateOne(
      { ghlOpportunityId: opportunity.id, locationId },
      {
        $set: {
          ghlOpportunityId: opportunity.id,
          locationId,
          contactId,
          ghlContactId: opportunity.contactId,
          title: opportunity.name || opportunity.title || 'Untitled Project',
          status: this.mapGHLStatusToProjectStatus(opportunity.status),
          monetaryValue: opportunity.monetaryValue || opportunity.value || 0,
          pipelineId: opportunity.pipelineId,
          pipelineStageId: opportunity.pipelineStageId || opportunity.stageId,
          assignedTo: opportunity.assignedTo || opportunity.userId,
          source: opportunity.source || 'webhook',
          tags: opportunity.tags || [],
          customFields: opportunity.customFields || {},
          lastWebhookUpdate: new Date(),
          updatedAt: new Date(),
          processedBy: 'queue',
          webhookId
        },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: new Date(),
          createdByWebhook: webhookId,
          timeline: [{
            id: new ObjectId().toString(),
            event: 'project_created',
            description: 'Project created from opportunity',
            timestamp: new Date().toISOString(),
            metadata: { webhookId }
          }]
        }
      },
      { upsert: true }
    );
  }

  /**
   * Update opportunity
   */
  private async updateOpportunity(
    opportunity: any, 
    locationId: string, 
    webhookId: string, 
    eventType: string
  ): Promise<void> {
    const updateData: any = {
      lastWebhookUpdate: new Date(),
      updatedAt: new Date(),
      processedBy: 'queue',
      webhookId
    };
    
    // Map specific updates based on event type
    switch (eventType) {
      case 'OpportunityStageUpdate':
        updateData.pipelineStageId = opportunity.pipelineStageId || opportunity.stageId;
        break;
      case 'OpportunityStatusUpdate':
        updateData.status = this.mapGHLStatusToProjectStatus(opportunity.status);
        break;
      case 'OpportunityMonetaryValueUpdate':
        updateData.monetaryValue = opportunity.monetaryValue || opportunity.value || 0;
        break;
      case 'OpportunityAssignedToUpdate':
        updateData.assignedTo = opportunity.assignedTo || opportunity.userId;
        break;
      default:
        // General update - update all fields
        if (opportunity.name !== undefined) updateData.title = opportunity.name;
        if (opportunity.title !== undefined && opportunity.name === undefined) updateData.title = opportunity.title;
        if (opportunity.status !== undefined) updateData.status = this.mapGHLStatusToProjectStatus(opportunity.status);
        if (opportunity.monetaryValue !== undefined) updateData.monetaryValue = opportunity.monetaryValue;
        if (opportunity.value !== undefined && opportunity.monetaryValue === undefined) updateData.monetaryValue = opportunity.value;
        if (opportunity.pipelineStageId !== undefined) updateData.pipelineStageId = opportunity.pipelineStageId;
        if (opportunity.stageId !== undefined && opportunity.pipelineStageId === undefined) updateData.pipelineStageId = opportunity.stageId;
        if (opportunity.assignedTo !== undefined) updateData.assignedTo = opportunity.assignedTo;
        if (opportunity.userId !== undefined && opportunity.assignedTo === undefined) updateData.assignedTo = opportunity.userId;
        if (opportunity.tags !== undefined) updateData.tags = opportunity.tags;
        if (opportunity.customFields !== undefined) updateData.customFields = opportunity.customFields;
    }
    
    const session = this.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        const result = await this.db.collection('projects').findOneAndUpdate(
          { ghlOpportunityId: opportunity.id, locationId },
          { 
            $set: updateData,
            $push: {
              timeline: {
                id: new ObjectId().toString(),
                event: eventType.toLowerCase(),
                description: this.getEventDescription(eventType, opportunity),
                timestamp: new Date().toISOString(),
                metadata: { 
                  webhookId,
                  changes: Object.keys(updateData)
                }
              }
            }
          },
          { returnDocument: 'after', session }
        );
        
        if (!result.value) {
          // Opportunity doesn't exist, create it
          await this.createOpportunity(opportunity, locationId, webhookId);
        }
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Delete opportunity
   */
  private async deleteOpportunity(opportunityId: string, locationId: string, webhookId: string): Promise<void> {
    await this.db.collection('projects').updateOne(
      { ghlOpportunityId: opportunityId, locationId },
      { 
        $set: { 
          deleted: true,
          deletedAt: new Date(),
          deletedByWebhook: webhookId,
          status: 'deleted',
          processedBy: 'queue'
        } 
      }
    );
  }

  /**
   * Process task event
   */
  private async processTaskEvent(type: string, payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let taskData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      taskData = payload.webhookPayload;
      locationId = payload.locationId || taskData.locationId;
    } else {
      // Direct format
      taskData = payload;
      locationId = payload.locationId;
    }
    
    const { task } = taskData;
    
    console.log(`[GeneralProcessor] Processing ${type}`);
    
    if (!task?.id || !locationId) {
      console.warn(`[GeneralProcessor] Missing task data for ${type}`);
      return;
    }
    
    switch (type) {
      case 'TaskCreate':
        await this.db.collection('tasks').updateOne(
          { ghlTaskId: task.id, locationId },
          {
            $set: {
              ghlTaskId: task.id,
              locationId,
              contactId: task.contactId,
              title: task.title || task.name || 'Task',
              description: task.description || task.body || '',
              dueDate: task.dueDate ? new Date(task.dueDate) : null,
              assignedTo: task.assignedTo || task.userId,
              status: task.completed ? 'completed' : 'pending',
              priority: task.priority || 'normal',
              lastWebhookUpdate: new Date(),
              processedBy: 'queue',
              webhookId
            },
            $setOnInsert: {
              _id: new ObjectId(),
              createdAt: new Date(),
              createdByWebhook: webhookId
            }
          },
          { upsert: true }
        );
        break;
        
      case 'TaskComplete':
        await this.db.collection('tasks').updateOne(
          { ghlTaskId: task.id, locationId },
          { 
            $set: { 
              status: 'completed',
              completedAt: new Date(),
              completedByWebhook: webhookId,
              processedBy: 'queue'
            } 
          }
        );
        break;
        
      case 'TaskDelete':
        await this.db.collection('tasks').updateOne(
          { ghlTaskId: task.id, locationId },
          { 
            $set: { 
              deleted: true,
              deletedAt: new Date(),
              processedBy: 'queue',
              webhookId
            } 
          }
        );
        break;
    }
  }

  /**
   * Process note event
   */
  private async processNoteEvent(type: string, payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let noteData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      noteData = payload.webhookPayload;
      locationId = payload.locationId || noteData.locationId;
    } else {
      // Direct format
      noteData = payload;
      locationId = payload.locationId;
    }
    
    const { note } = noteData;
    
    console.log(`[GeneralProcessor] Processing ${type}`);
    
    if (!note || !locationId) {
      console.warn(`[GeneralProcessor] Missing note data for ${type}`);
      return;
    }
    
    switch (type) {
      case 'NoteCreate':
        await this.db.collection('notes').insertOne({
          _id: new ObjectId(),
          ghlNoteId: note.id,
          locationId,
          contactId: note.contactId,
          opportunityId: note.opportunityId,
          body: note.body || note.content || '',
          createdBy: note.userId || note.createdBy,
          createdAt: new Date(),
          createdByWebhook: webhookId,
          processedBy: 'queue'
        });
        break;
        
      case 'NoteDelete':
        await this.db.collection('notes').updateOne(
          { ghlNoteId: note.id, locationId },
          { 
            $set: { 
              deleted: true,
              deletedAt: new Date(),
              processedBy: 'queue',
              webhookId
            } 
          }
        );
        break;
    }
  }

  /**
   * Process campaign event
   */
  private async processCampaignEvent(type: string, payload: any, webhookId: string): Promise<void> {
    console.log(`[GeneralProcessor] Processing ${type}`);
    
    // Handle nested structure
    let campaignData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      campaignData = payload.webhookPayload;
      locationId = payload.locationId || campaignData.locationId;
    } else {
      // Direct format
      campaignData = payload;
      locationId = payload.locationId;
    }
    
    // Store campaign events for analytics
    await this.db.collection('campaign_events').insertOne({
      _id: new ObjectId(),
      type,
      payload: campaignData,
      locationId,
      webhookId,
      processedAt: new Date(),
      processedBy: 'queue'
    });
  }

  /**
   * Process user event
   */
  private async processUserEvent(type: string, payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let userData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      userData = payload.webhookPayload;
      locationId = payload.locationId || userData.locationId;
    } else {
      // Direct format
      userData = payload;
      locationId = payload.locationId;
    }
    
    // Check if user is nested or at root level (GHL sends at root)
    const user = userData.user || userData;
    
    console.log(`[GeneralProcessor] Processing ${type}`);
    
    if (type === 'UserCreate' && user && locationId) {
      console.log(`[GeneralProcessor] Creating user:`, {
        id: user.id,
        email: user.email,
        locationId,
        webhookId
      });
      
      await this.db.collection('users').updateOne(
        { ghlUserId: user.id, locationId },
        {
          $set: {
            ghlUserId: user.id,
            locationId,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
            email: user.email,
            role: user.role || user.type || (user.permissions?.[0] ? user.permissions[0] : 'user'),
            permissions: user.permissions || [],
            phone: user.phone || '',
            extension: user.extension || null,
            lastWebhookUpdate: new Date(),
            processedBy: 'queue',
            webhookId
          },
          $setOnInsert: {
            _id: new ObjectId(),
            createdAt: new Date(),
            createdByWebhook: webhookId
          }
        },
        { upsert: true }
      );
      
      console.log(`[GeneralProcessor] User created/updated successfully`);
    }
  }

  /**
   * Process location event
   */
  private async processLocationEvent(type: string, payload: any, webhookId: string): Promise<void> {
    console.log(`[GeneralProcessor] Processing ${type}`);
    
    // Handle nested structure
    let locationData;
    
    if (payload.webhookPayload) {
      // Native webhook format
      locationData = payload.webhookPayload;
    } else {
      // Direct format
      locationData = payload;
    }
    
    if (type === 'LocationUpdate' && locationData.id) {
      await this.db.collection('locations').updateOne(
        { locationId: locationData.id },
        {
          $set: {
            name: locationData.name,
            email: locationData.email,
            phone: locationData.phone,
            address: locationData.address || locationData.address1,
            city: locationData.city,
            state: locationData.state,
            country: locationData.country,
            postalCode: locationData.postalCode || locationData.zip,
            website: locationData.website,
            timezone: locationData.timezone,
            businessHours: locationData.businessHours,
            lastWebhookUpdate: new Date(),
            processedBy: 'queue',
            webhookId
          }
        }
      );
    }
  }

  /**
   * Process custom object event
   */
  private async processCustomObjectEvent(type: string, payload: any, webhookId: string): Promise<void> {
    console.log(`[GeneralProcessor] Processing ${type}`);
    
    // Handle nested structure
    let customObjectData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      customObjectData = payload.webhookPayload;
      locationId = payload.locationId || customObjectData.locationId;
    } else {
      // Direct format
      customObjectData = payload;
      locationId = payload.locationId;
    }
    
    // Store custom object events
    await this.db.collection('custom_object_events').insertOne({
      _id: new ObjectId(),
      type,
      payload: customObjectData,
      locationId,
      webhookId,
      processedAt: new Date(),
      processedBy: 'queue'
    });
  }

  /**
   * Process association event
   */
  private async processAssociationEvent(type: string, payload: any, webhookId: string): Promise<void> {
    console.log(`[GeneralProcessor] Processing ${type}`);
    
    // Handle nested structure
    let associationData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      associationData = payload.webhookPayload;
      locationId = payload.locationId || associationData.locationId;
    } else {
      // Direct format
      associationData = payload;
      locationId = payload.locationId;
    }
    
    // Store association events
    await this.db.collection('association_events').insertOne({
      _id: new ObjectId(),
      type,
      payload: associationData,
      locationId,
      webhookId,
      processedAt: new Date(),
      processedBy: 'queue'
    });
  }

  /**
   * Store unhandled event
   */
  private async storeUnhandledEvent(type: string, payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let eventData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      eventData = payload.webhookPayload;
      locationId = payload.locationId || eventData.locationId;
    } else {
      // Direct format
      eventData = payload;
      locationId = payload.locationId;
    }
    
    await this.db.collection('unhandled_webhooks').insertOne({
      _id: new ObjectId(),
      type,
      payload: eventData,
      locationId,
      webhookId,
      processedAt: new Date(),
      processedBy: 'queue'
    });
  }

  /**
   * Map GHL status to project status
   */
  private mapGHLStatusToProjectStatus(ghlStatus: string): string {
    const statusMap: Record<string, string> = {
      'open': 'open',
      'won': 'won',
      'lost': 'lost',
      'abandoned': 'abandoned',
      'deleted': 'deleted'
    };
    
    return statusMap[ghlStatus?.toLowerCase()] || 'open';
  }

  /**
   * Get event description
   */
  private getEventDescription(eventType: string, data: any): string {
    switch (eventType) {
      case 'OpportunityStageUpdate':
        return `Pipeline stage updated`;
      case 'OpportunityStatusUpdate':
        return `Status changed to ${data.status}`;
      case 'OpportunityMonetaryValueUpdate':
        return `Value updated to $${data.monetaryValue || data.value || 0}`;
      case 'OpportunityAssignedToUpdate':
        return `Assigned to user`;
      default:
        return eventType.replace(/([A-Z])/g, ' $1').trim();
    }
  }
}