// src/utils/webhooks/processors/projects.ts
import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId, Db } from 'mongodb';

export class ProjectsProcessor extends BaseProcessor {
  constructor(db?: Db) {
    super({
      queueType: 'projects',
      batchSize: 50,
      maxRuntime: 50000,
      processorName: 'ProjectsProcessor'
    }, db);
  }

  /**
   * Process project/opportunity webhooks
   */
  protected async processItem(item: QueueItem): Promise<void> {
    const { type, payload, webhookId } = item;

    console.log(`[ProjectsProcessor] Processing ${type} webhook ${webhookId}`);

    // Track project processing start
    const projectStartTime = Date.now();

    switch (type) {
      case 'OpportunityCreate':
        await this.processOpportunityCreate(payload, webhookId);
        break;
        
      case 'OpportunityUpdate':
        await this.processOpportunityUpdate(payload, webhookId);
        break;
        
      case 'OpportunityDelete':
        await this.processOpportunityDelete(payload, webhookId);
        break;
        
      case 'OpportunityStatusUpdate':
        await this.processOpportunityStatusUpdate(payload, webhookId);
        break;
        
      case 'OpportunityStageUpdate':
        await this.processOpportunityStageUpdate(payload, webhookId);
        break;
        
      case 'OpportunityMonetaryValueUpdate':
        await this.processOpportunityMonetaryValueUpdate(payload, webhookId);
        break;
        
      case 'OpportunityAssignedToUpdate':
        await this.processOpportunityAssignedToUpdate(payload, webhookId);
        break;
        
      default:
        console.warn(`[ProjectsProcessor] Unknown opportunity type: ${type}`);
        throw new Error(`Unsupported opportunity webhook type: ${type}`);
    }

    // Track project processing time
    const processingTime = Date.now() - projectStartTime;
    console.log(`[ProjectsProcessor] Processed ${type} in ${processingTime}ms`);
    
    if (processingTime > 2000) {
      console.warn(`[ProjectsProcessor] Slow project processing: ${processingTime}ms for ${type}`);
    }
  }

  /**
   * Process opportunity create
   */
  private async processOpportunityCreate(payload: any, webhookId: string): Promise<void> {
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
    
    // The opportunity data is at root level, not nested
    const opportunity = opportunityData;
    
    console.log(`[ProjectsProcessor] Creating project from opportunity:`, {
      id: opportunity.id,
      name: opportunity.name,
      locationId,
      webhookId
    });
    
    if (!opportunity.id || !locationId) {
      console.error(`[ProjectsProcessor] Missing required opportunity data:`, {
        id: !!opportunity.id,
        locationId: !!locationId,
        webhookId
      });
      throw new Error('Missing required opportunity data');
    }
    
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
    
    const result = await this.db.collection('projects').updateOne(
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
          pipelineName: opportunity.pipelineName,
          pipelineStageName: opportunity.pipelineStageName,
          assignedTo: opportunity.assignedTo || opportunity.userId || opportunity.assignedUserId,
          source: opportunity.source || opportunity.contactSource || 'webhook',
          tags: opportunity.tags || [],
          customFields: opportunity.customFields || {},
          notes: opportunity.notes || '',
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
    
    console.log(`[ProjectsProcessor] Project create result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    });
  }

 /**
 * Process opportunity update
 */
private async processOpportunityUpdate(payload: any, webhookId: string): Promise<void> {
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
  
  const opportunity = opportunityData;
  
  console.log(`[ProjectsProcessor] Updating project:`, {
    id: opportunity.id,
    locationId,
    webhookId
  });
  
  if (!opportunity.id || !locationId) {
    console.error(`[ProjectsProcessor] Missing required opportunity data:`, {
      id: !!opportunity.id,
      locationId: !!locationId,
      webhookId
    });
    throw new Error('Missing required opportunity data');
  }
  
  const updateData: any = {
    lastWebhookUpdate: new Date(),
    updatedAt: new Date(),
    processedBy: 'queue',
    webhookId
  };
  
  // Update fields that might change
  const fieldsToUpdate = [
    'name', 'title', 'status', 'monetaryValue', 'value',
    'pipelineId', 'pipelineStageId', 'stageId',
    'pipelineName', 'pipelineStageName',
    'assignedTo', 'userId', 'assignedUserId',
    'source', 'contactSource', 'tags', 'customFields', 'notes'
  ];
  
  fieldsToUpdate.forEach(field => {
    if (opportunity[field] !== undefined) {
      switch (field) {
        case 'name':
        case 'title':
          updateData.title = opportunity[field];
          break;
        case 'monetaryValue':
        case 'value':
          updateData.monetaryValue = opportunity[field];
          break;
        case 'pipelineStageId':
        case 'stageId':
          updateData.pipelineStageId = opportunity[field];
          break;
        case 'assignedTo':
        case 'userId':
        case 'assignedUserId':
          updateData.assignedTo = opportunity[field];
          break;
        case 'source':
        case 'contactSource':
          updateData.source = opportunity[field];
          break;
        case 'status':
          updateData.status = this.mapGHLStatusToProjectStatus(opportunity[field]);
          break;
        default:
          updateData[field] = opportunity[field];
      }
    }
  });
  
  const result = await this.db.collection('projects').findOneAndUpdate(
    { ghlOpportunityId: opportunity.id, locationId },
    { 
      $set: updateData,
      $push: {
        timeline: {
          id: new ObjectId().toString(),
          event: 'project_updated',
          description: 'Project details updated',
          timestamp: new Date().toISOString(),
          metadata: { 
            webhookId,
            changes: Object.keys(updateData).filter(k => !['lastWebhookUpdate', 'updatedAt', 'processedBy', 'webhookId'].includes(k))
          }
        }
      }
    },
    { returnDocument: 'after' }
  );
  
  console.log(`[ProjectsProcessor] Project update result:`, {
    found: !!result,
    fieldsUpdated: Object.keys(updateData).length
  });
  
  if (!result) {
    console.log(`[ProjectsProcessor] Project not found, creating new one`);
    await this.processOpportunityCreate(payload, webhookId);
  }
}
  /**
   * Process opportunity status update
   */
  private async processOpportunityStatusUpdate(payload: any, webhookId: string): Promise<void> {
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
    
    const opportunity = opportunityData;
    
    console.log(`[ProjectsProcessor] Updating project status:`, {
      id: opportunity.id,
      status: opportunity.status,
      locationId,
      webhookId
    });
    
    if (!opportunity.id || !locationId) {
      console.error(`[ProjectsProcessor] Missing required opportunity data:`, {
        id: !!opportunity.id,
        locationId: !!locationId,
        webhookId
      });
      throw new Error('Missing required opportunity data');
    }
    
    const newStatus = this.mapGHLStatusToProjectStatus(opportunity.status);
    
    const result = await this.db.collection('projects').updateOne(
      { ghlOpportunityId: opportunity.id, locationId },
      { 
        $set: { 
          status: newStatus,
          lastWebhookUpdate: new Date(),
          updatedAt: new Date(),
          processedBy: 'queue',
          webhookId
        },
        $push: {
          timeline: {
            id: new ObjectId().toString(),
            event: 'status_changed',
            description: `Status changed to ${newStatus}`,
            timestamp: new Date().toISOString(),
            metadata: { 
              webhookId,
              previousStatus: opportunity.previousStatus,
              newStatus: newStatus
            }
          }
        }
      }
    );
    
    console.log(`[ProjectsProcessor] Status update result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  }

  /**
   * Process opportunity stage update
   */
  private async processOpportunityStageUpdate(payload: any, webhookId: string): Promise<void> {
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
    
    const opportunity = opportunityData;
    
    console.log(`[ProjectsProcessor] Updating project stage:`, {
      id: opportunity.id,
      stageId: opportunity.pipelineStageId || opportunity.stageId,
      locationId,
      webhookId
    });
    
    if (!opportunity.id || !locationId) {
      console.error(`[ProjectsProcessor] Missing required opportunity data:`, {
        id: !!opportunity.id,
        locationId: !!locationId,
        webhookId
      });
      throw new Error('Missing required opportunity data');
    }
    
    const result = await this.db.collection('projects').updateOne(
      { ghlOpportunityId: opportunity.id, locationId },
      { 
        $set: { 
          pipelineStageId: opportunity.pipelineStageId || opportunity.stageId,
          pipelineStageName: opportunity.pipelineStageName || opportunity.stageName,
          lastWebhookUpdate: new Date(),
          updatedAt: new Date(),
          processedBy: 'queue',
          webhookId
        },
        $push: {
          timeline: {
            id: new ObjectId().toString(),
            event: 'stage_changed',
            description: `Moved to stage: ${opportunity.pipelineStageName || opportunity.stageName || 'Unknown'}`,
            timestamp: new Date().toISOString(),
            metadata: { 
              webhookId,
              previousStageId: opportunity.previousStageId,
              newStageId: opportunity.pipelineStageId || opportunity.stageId
            }
          }
        }
      }
    );
    
    console.log(`[ProjectsProcessor] Stage update result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  }

  /**
   * Process opportunity monetary value update
   */
  private async processOpportunityMonetaryValueUpdate(payload: any, webhookId: string): Promise<void> {
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
    
    const opportunity = opportunityData;
    
    console.log(`[ProjectsProcessor] Updating project value:`, {
      id: opportunity.id,
      value: opportunity.monetaryValue || opportunity.value,
      locationId,
      webhookId
    });
    
    if (!opportunity.id || !locationId) {
      console.error(`[ProjectsProcessor] Missing required opportunity data:`, {
        id: !!opportunity.id,
        locationId: !!locationId,
        webhookId
      });
      throw new Error('Missing required opportunity data');
    }
    
    const newValue = opportunity.monetaryValue || opportunity.value || 0;
    
    const result = await this.db.collection('projects').updateOne(
      { ghlOpportunityId: opportunity.id, locationId },
      { 
        $set: { 
          monetaryValue: newValue,
          lastWebhookUpdate: new Date(),
          updatedAt: new Date(),
          processedBy: 'queue',
          webhookId
        },
        $push: {
          timeline: {
            id: new ObjectId().toString(),
            event: 'value_changed',
            description: `Value updated to $${newValue}`,
            timestamp: new Date().toISOString(),
            metadata: { 
              webhookId,
              previousValue: opportunity.previousValue,
              newValue: newValue
            }
          }
        }
      }
    );
    
    console.log(`[ProjectsProcessor] Value update result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  }

  /**
   * Process opportunity assigned to update
   */
  private async processOpportunityAssignedToUpdate(payload: any, webhookId: string): Promise<void> {
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
    
    const opportunity = opportunityData;
    
    console.log(`[ProjectsProcessor] Updating project assignment:`, {
      id: opportunity.id,
      assignedTo: opportunity.assignedTo || opportunity.userId,
      locationId,
      webhookId
    });
    
    if (!opportunity.id || !locationId) {
      console.error(`[ProjectsProcessor] Missing required opportunity data:`, {
        id: !!opportunity.id,
        locationId: !!locationId,
        webhookId
      });
      throw new Error('Missing required opportunity data');
    }
    
    const assignedTo = opportunity.assignedTo || opportunity.userId || opportunity.assignedUserId;
    
    const result = await this.db.collection('projects').updateOne(
      { ghlOpportunityId: opportunity.id, locationId },
      { 
        $set: { 
          assignedTo: assignedTo,
          lastWebhookUpdate: new Date(),
          updatedAt: new Date(),
          processedBy: 'queue',
          webhookId
        },
        $push: {
          timeline: {
            id: new ObjectId().toString(),
            event: 'assignment_changed',
            description: `Assigned to user`,
            timestamp: new Date().toISOString(),
            metadata: { 
              webhookId,
              previousAssignee: opportunity.previousAssignee,
              newAssignee: assignedTo
            }
          }
        }
      }
    );
    
    console.log(`[ProjectsProcessor] Assignment update result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount
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
}