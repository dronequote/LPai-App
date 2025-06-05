// src/utils/webhooks/processors/contacts.ts
import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId, Db } from 'mongodb';

export class ContactsProcessor extends BaseProcessor {
  constructor(db: Db) {
    super({
      db: db,
      queueType: 'contacts',
      batchSize: 50,
      maxProcessingTime: 50000, // 50 seconds
      processorName: 'ContactsProcessor'
    });
  }

  /**
   * Process contact webhooks
   */
  protected async processItem(item: QueueItem): Promise<void> {
    const { type, payload, webhookId } = item;

    console.log(`[ContactsProcessor] Processing ${type} webhook ${webhookId}`);

    // Track contact processing start
    const contactStartTime = Date.now();

    switch (type) {
      case 'ContactCreate':
        await this.processContactCreate(payload, webhookId);
        break;
        
      case 'ContactUpdate':
        await this.processContactUpdate(payload, webhookId);
        break;
        
      case 'ContactDelete':
        await this.processContactDelete(payload, webhookId);
        break;
        
      case 'ContactDndUpdate':
        await this.processContactDndUpdate(payload, webhookId);
        break;
        
      case 'ContactTagUpdate':
        await this.processContactTagUpdate(payload, webhookId);
        break;
        
      // Note events
      case 'NoteCreate':
        await this.processNoteCreate(payload, webhookId);
        break;
        
      case 'NoteUpdate':
        await this.processNoteUpdate(payload, webhookId);
        break;
        
      case 'NoteDelete':
        await this.processNoteDelete(payload, webhookId);
        break;
        
      // Task events
      case 'TaskCreate':
        await this.processTaskCreate(payload, webhookId);
        break;
        
      case 'TaskComplete':
        await this.processTaskComplete(payload, webhookId);
        break;
        
      case 'TaskDelete':
        await this.processTaskDelete(payload, webhookId);
        break;
        
      default:
        console.warn(`[ContactsProcessor] Unknown contact type: ${type}`);
        throw new Error(`Unsupported contact webhook type: ${type}`);
    }

    // Track contact processing time
    const processingTime = Date.now() - contactStartTime;
    console.log(`[ContactsProcessor] Processed ${type} in ${processingTime}ms`);
    
    if (processingTime > 2000) {
      console.warn(`[ContactsProcessor] Slow contact processing: ${processingTime}ms for ${type}`);
    }
  }

  /**
   * Process contact create
   */
  private async processContactCreate(payload: any, webhookId: string): Promise<void> {
    const { locationId, id, email, firstName, lastName, phone } = payload;
    
    console.log(`[ContactsProcessor] Creating contact:`, {
      id,
      email,
      locationId,
      webhookId
    });
    
    if (!id || !locationId) {
      throw new Error('Missing required contact data');
    }
    
    const result = await this.db.collection('contacts').updateOne(
      { ghlContactId: id, locationId },
      {
        $set: {
          ghlContactId: id,
          locationId,
          email: email || '',
          firstName: firstName || '',
          lastName: lastName || '',
          phone: phone || '',
          fullName: `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown',
          tags: payload.tags || [],
          source: payload.source || payload.contactSource || 'webhook',
          dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
          address1: payload.address1 || '',
          city: payload.city || '',
          state: payload.state || '',
          country: payload.country || '',
          postalCode: payload.postalCode || '',
          companyName: payload.companyName || '',
          website: payload.website || '',
          timezone: payload.timezone || '',
          dnd: payload.dnd || false,
          dndSettings: payload.dndSettings || {},
          customFields: payload.customFields || [],
          type: payload.type || payload.contactType || 'lead',
          lastWebhookUpdate: new Date(),
          updatedAt: new Date(),
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
    
    console.log(`[ContactsProcessor] Contact create result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    });
  }

  /**
   * Process contact update
   */
  private async processContactUpdate(payload: any, webhookId: string): Promise<void> {
    const { locationId, id } = payload;
    
    console.log(`[ContactsProcessor] Updating contact:`, {
      id,
      locationId,
      webhookId
    });
    
    if (!id || !locationId) {
      throw new Error('Missing required contact data');
    }
    
    const updateData: any = {
      lastWebhookUpdate: new Date(),
      updatedAt: new Date(),
      processedBy: 'queue',
      webhookId
    };
    
    // Only update fields that are present in the payload
    const fieldsToUpdate = [
      'email', 'firstName', 'lastName', 'phone', 'tags', 'source',
      'dateOfBirth', 'address1', 'city', 'state', 'country', 'postalCode',
      'companyName', 'website', 'timezone', 'dnd', 'dndSettings', 
      'customFields', 'type', 'contactType'
    ];
    
    fieldsToUpdate.forEach(field => {
      if (payload[field] !== undefined) {
        updateData[field] = payload[field];
      }
    });
    
    // Update fullName if name fields changed
    if (payload.firstName !== undefined || payload.lastName !== undefined) {
      const firstName = payload.firstName !== undefined ? payload.firstName : '';
      const lastName = payload.lastName !== undefined ? payload.lastName : '';
      updateData.fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
    }
    
    // Handle date fields
    if (payload.dateOfBirth !== undefined) {
      updateData.dateOfBirth = payload.dateOfBirth ? new Date(payload.dateOfBirth) : null;
    }
    
    const result = await this.db.collection('contacts').updateOne(
      { ghlContactId: id, locationId },
      { $set: updateData }
    );
    
    console.log(`[ContactsProcessor] Contact update result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      fieldsUpdated: Object.keys(updateData).length
    });
    
    if (result.matchedCount === 0) {
      console.log(`[ContactsProcessor] Contact not found, creating new one`);
      await this.processContactCreate(payload, webhookId);
    }
  }

  /**
   * Process contact delete
   */
  private async processContactDelete(payload: any, webhookId: string): Promise<void> {
    const { locationId, id } = payload;
    
    console.log(`[ContactsProcessor] Deleting contact:`, {
      id,
      locationId,
      webhookId
    });
    
    if (!id || !locationId) {
      throw new Error('Missing required contact data');
    }
    
    const result = await this.db.collection('contacts').updateOne(
      { ghlContactId: id, locationId },
      { 
        $set: { 
          deleted: true,
          deletedAt: new Date(),
          deletedByWebhook: webhookId,
          processedBy: 'queue'
        } 
      }
    );
    
    console.log(`[ContactsProcessor] Contact delete result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  }

  /**
   * Process contact DND update
   */
  private async processContactDndUpdate(payload: any, webhookId: string): Promise<void> {
    const { locationId, id, dnd, dndSettings } = payload;
    
    console.log(`[ContactsProcessor] Starting DND Update:`, {
      locationId,
      ghlContactId: id,
      dnd,
      dndSettings,
      webhookId
    });
    
    if (!id || !locationId) {
      throw new Error('Missing required contact data');
    }
    
    // Check if contact exists first
    const existingContact = await this.db.collection('contacts').findOne({
      ghlContactId: id,
      locationId: locationId
    });
    
    console.log(`[ContactsProcessor] Contact lookup result:`, {
      found: !!existingContact,
      contactId: existingContact?._id,
      currentDnd: existingContact?.dnd
    });
    
    if (!existingContact) {
      console.error(`[ContactsProcessor] Contact not found for DND update: ${id}`);
      throw new Error(`Contact not found: ${id}`);
    }
    
    const result = await this.db.collection('contacts').updateOne(
      { ghlContactId: id, locationId },
      { 
        $set: { 
          dnd: dnd || false,
          dndSettings: dndSettings || {},
          lastWebhookUpdate: new Date(),
          updatedAt: new Date(),
          processedBy: 'queue',
          webhookId
        } 
      }
    );
    
    console.log(`[ContactsProcessor] MongoDB update result:`, {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      acknowledged: result.acknowledged
    });
    
    if (result.modifiedCount === 0 && result.matchedCount > 0) {
      console.warn(`[ContactsProcessor] Contact matched but not modified - values may be the same`);
    }
  }

  /**
   * Process contact tag update
   */
  private async processContactTagUpdate(payload: any, webhookId: string): Promise<void> {
    const { locationId, id, tags } = payload;
    
    console.log(`[ContactsProcessor] Updating tags:`, {
      locationId,
      ghlContactId: id,
      tags,
      webhookId
    });
    
    if (!id || !locationId) {
      throw new Error('Missing required contact data');
    }
    
    const result = await this.db.collection('contacts').updateOne(
      { ghlContactId: id, locationId },
      { 
        $set: { 
          tags: tags || [],
          lastWebhookUpdate: new Date(),
          updatedAt: new Date(),
          processedBy: 'queue',
          webhookId
        } 
      }
    );
    
    console.log(`[ContactsProcessor] Tag update result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      newTags: tags?.length || 0
    });
  }

  /**
   * Process note create
   */
  private async processNoteCreate(payload: any, webhookId: string): Promise<void> {
    const { locationId, note, contactId } = payload;
    
    console.log(`[ContactsProcessor] Creating note:`, {
      noteId: note?.id,
      contactId,
      locationId,
      webhookId
    });
    
    if (!note?.id || !contactId || !locationId) {
      console.warn(`[ContactsProcessor] Missing note data, skipping`);
      return;
    }
    
    const result = await this.db.collection('notes').insertOne({
      _id: new ObjectId(),
      ghlNoteId: note.id,
      locationId,
      contactId,
      opportunityId: note.opportunityId || null,
      body: note.body || '',
      createdBy: note.userId || 'system',
      createdAt: new Date(),
      createdByWebhook: webhookId,
      processedBy: 'queue'
    });
    
    console.log(`[ContactsProcessor] Note created:`, {
      insertedId: result.insertedId
    });
    
    // Update contact's last activity
    await this.updateContactActivity(contactId, locationId, 'note_added');
  }

  /**
   * Process note update
   */
  private async processNoteUpdate(payload: any, webhookId: string): Promise<void> {
    const { locationId, note } = payload;
    
    console.log(`[ContactsProcessor] Updating note:`, {
      noteId: note?.id,
      locationId,
      webhookId
    });
    
    if (!note?.id || !locationId) {
      console.warn(`[ContactsProcessor] Missing note data, skipping`);
      return;
    }
    
    const result = await this.db.collection('notes').updateOne(
      { ghlNoteId: note.id, locationId },
      { 
        $set: { 
          body: note.body || '',
          updatedAt: new Date(),
          updatedByWebhook: webhookId,
          processedBy: 'queue'
        } 
      }
    );
    
    console.log(`[ContactsProcessor] Note update result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  }

  /**
   * Process note delete
   */
  private async processNoteDelete(payload: any, webhookId: string): Promise<void> {
    const { locationId, note } = payload;
    
    console.log(`[ContactsProcessor] Deleting note:`, {
      noteId: note?.id,
      locationId,
      webhookId
    });
    
    if (!note?.id || !locationId) {
      console.warn(`[ContactsProcessor] Missing note data, skipping`);
      return;
    }
    
    const result = await this.db.collection('notes').updateOne(
      { ghlNoteId: note.id, locationId },
      { 
        $set: { 
          deleted: true,
          deletedAt: new Date(),
          deletedByWebhook: webhookId,
          processedBy: 'queue'
        } 
      }
    );
    
    console.log(`[ContactsProcessor] Note delete result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  }

  /**
   * Process task create
   */
  private async processTaskCreate(payload: any, webhookId: string): Promise<void> {
    const { locationId, task, contactId } = payload;
    
    console.log(`[ContactsProcessor] Creating task:`, {
      taskId: task?.id,
      contactId,
      locationId,
      webhookId
    });
    
    if (!task?.id || !locationId) {
      console.warn(`[ContactsProcessor] Missing task data, skipping`);
      return;
    }
    
    const result = await this.db.collection('tasks').insertOne({
      _id: new ObjectId(),
      ghlTaskId: task.id,
      locationId,
      contactId: contactId || task.contactId,
      title: task.title || 'Task',
      description: task.description || '',
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
      assignedTo: task.assignedTo || null,
      status: task.completed ? 'completed' : 'pending',
      priority: task.priority || 'normal',
      createdAt: new Date(),
      createdByWebhook: webhookId,
      processedBy: 'queue'
    });
    
    console.log(`[ContactsProcessor] Task created:`, {
      insertedId: result.insertedId
    });
    
    // Update contact's last activity
    if (contactId || task.contactId) {
      await this.updateContactActivity(contactId || task.contactId, locationId, 'task_created');
    }
  }

  /**
   * Process task complete
   */
  private async processTaskComplete(payload: any, webhookId: string): Promise<void> {
    const { locationId, task } = payload;
    
    console.log(`[ContactsProcessor] Completing task:`, {
      taskId: task?.id,
      locationId,
      webhookId
    });
    
    if (!task?.id || !locationId) {
      console.warn(`[ContactsProcessor] Missing task data, skipping`);
      return;
    }
    
    const result = await this.db.collection('tasks').updateOne(
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
    
    console.log(`[ContactsProcessor] Task complete result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  }

  /**
   * Process task delete
   */
  private async processTaskDelete(payload: any, webhookId: string): Promise<void> {
    const { locationId, task } = payload;
    
    console.log(`[ContactsProcessor] Deleting task:`, {
      taskId: task?.id,
      locationId,
      webhookId
    });
    
    if (!task?.id || !locationId) {
      console.warn(`[ContactsProcessor] Missing task data, skipping`);
      return;
    }
    
    const result = await this.db.collection('tasks').updateOne(
      { ghlTaskId: task.id, locationId },
      { 
        $set: { 
          deleted: true,
          deletedAt: new Date(),
          deletedByWebhook: webhookId,
          processedBy: 'queue'
        } 
      }
    );
    
    console.log(`[ContactsProcessor] Task delete result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  }

  /**
   * Helper to update contact's last activity
   */
  private async updateContactActivity(contactId: string, locationId: string, activityType: string): Promise<void> {
    try {
      // Find contact by GHL contact ID
      const contact = await this.db.collection('contacts').findOne({
        ghlContactId: contactId,
        locationId: locationId
      });
      
      if (contact) {
        await this.db.collection('contacts').updateOne(
          { _id: contact._id },
          {
            $set: {
              lastActivityDate: new Date(),
              lastActivityType: activityType
            }
          }
        );
        console.log(`[ContactsProcessor] Updated contact activity: ${activityType}`);
      }
    } catch (error) {
      console.error(`[ContactsProcessor] Failed to update contact activity:`, error);
    }
  }
}