// src/utils/webhooks/processors/general.ts
import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId, Db } from 'mongodb';

export class GeneralProcessor extends BaseProcessor {
  constructor(db: Db) {
    super({
      db: db,
      queueType: 'general',
      batchSize: 100,
      maxProcessingTime: 50000, // 50 seconds
      processorName: 'GeneralProcessor'
    });
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
    const { locationId, opportunity } = payload;
    
    if (!opportunity?.id || !locationId) {
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
          title: opportunity.name || 'Untitled Project',
          status: this.mapGHLStatusToProjectStatus(opportunity.status),
          monetaryValue: opportunity.monetaryValue || 0,
          pipelineId: opportunity.pipelineId,
          pipelineStageId: opportunity.pipelineStageId,
          assignedTo: opportunity.assignedTo,
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
        updateData.pipelineStageId = opportunity.pipelineStageId;
        break;
      case 'OpportunityStatusUpdate':
        updateData.status = this.mapGHLStatusToProjectStatus(opportunity.status);
        break;
      case 'OpportunityMonetaryValueUpdate':
        updateData.monetaryValue = opportunity.monetaryValue || 0;
        break;
      case 'OpportunityAssignedToUpdate':
        updateData.assignedTo = opportunity.assignedTo;
        break;
      default:
        // General update - update all fields
        if (opportunity.name) updateData.title = opportunity.name;
        if (opportunity.status) updateData.status = this.mapGHLStatusToProjectStatus(opportunity.status);
        if (opportunity.monetaryValue !== undefined) updateData.monetaryValue = opportunity.monetaryValue;
        if (opportunity.pipelineStageId) updateData.pipelineStageId = opportunity.pipelineStageId;
        if (opportunity.assignedTo) updateData.assignedTo = opportunity.assignedTo;
        if (opportunity.tags) updateData.tags = opportunity.tags;
        if (opportunity.customFields) updateData.customFields = opportunity.customFields;
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
    const { locationId, task } = payload;
    
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
              title: task.title || 'Task',
              description: task.description || '',
              dueDate: task.dueDate ? new Date(task.dueDate) : null,
              assignedTo: task.assignedTo,
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
    const { locationId, note } = payload;
    
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
          body: note.body || '',
          createdBy: note.userId,
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
    
    // Store campaign events for analytics
    await this.db.collection('campaign_events').insertOne({
      _id: new ObjectId(),
      type,
      payload,
      webhookId,
      processedAt: new Date(),
      processedBy: 'queue'
    });
  }

  /**
   * Process user event
   */
  private async processUserEvent(type: string, payload: any, webhookId: string): Promise<void> {
    const { locationId, user } = payload;
    
    console.log(`[GeneralProcessor] Processing ${type}`);
    
    if (type === 'UserCreate' && user && locationId) {
      await this.db.collection('users').updateOne(
        { ghlUserId: user.id, locationId },
        {
          $set: {
            ghlUserId: user.id,
            locationId,
            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
            email: user.email,
            role: user.role || user.type,
            permissions: user.permissions || [],
            phone: user.phone,
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
    }
  }

  /**
   * Process location event
   */
  private async processLocationEvent(type: string, payload: any, webhookId: string): Promise<void> {
    console.log(`[GeneralProcessor] Processing ${type}`);
    
    if (type === 'LocationUpdate' && payload.id) {
      await this.db.collection('locations').updateOne(
        { locationId: payload.id },
        {
          $set: {
            name: payload.name,
            email: payload.email,
            phone: payload.phone,
            address: payload.address,
            website: payload.website,
            timezone: payload.timezone,
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
    
    // Store custom object events
    await this.db.collection('custom_object_events').insertOne({
      _id: new ObjectId(),
      type,
      payload,
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
    
    // Store association events
    await this.db.collection('association_events').insertOne({
      _id: new ObjectId(),
      type,
      payload,
      webhookId,
      processedAt: new Date(),
      processedBy: 'queue'
    });
  }

  /**
   * Store unhandled event
   */
  private async storeUnhandledEvent(type: string, payload: any, webhookId: string): Promise<void> {
    await this.db.collection('unhandled_webhooks').insertOne({
      _id: new ObjectId(),
      type,
      payload,
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
        return `Value updated to $${data.monetaryValue || 0}`;
      case 'OpportunityAssignedToUpdate':
        return `Assigned to user`;
      default:
        return eventType.replace(/([A-Z])/g, ' $1').trim();
    }
  }
}