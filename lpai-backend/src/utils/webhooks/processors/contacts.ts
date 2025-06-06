// src/utils/webhooks/processors/contacts.ts
import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId, Db } from 'mongodb';

export class ContactsProcessor extends BaseProcessor {
  constructor(db?: Db) {
    super({
      queueType: 'contacts',
      batchSize: 50,
      maxRuntime: 50000,
      processorName: 'ContactsProcessor'
    }, db);
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
    // Handle nested structure
    let contactData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      contactData = payload.webhookPayload;
      locationId = payload.locationId || contactData.locationId;
    } else {
      // Direct format
      contactData = payload;
      locationId = payload.locationId;
    }
    
    const { id, email, firstName, lastName, phone } = contactData;
    
    console.log(`[ContactsProcessor] Creating contact:`, {
      id,
      email,
      locationId,
      webhookId
    });
    
    if (!id || !locationId) {
      console.error(`[ContactsProcessor] Missing required contact data:`, {
        id: !!id,
        locationId: !!locationId,
        webhookId
      });
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
          tags: contactData.tags || [],
          source: contactData.source || contactData.contactSource || 'webhook',
          dateOfBirth: contactData.dateOfBirth ? new Date(contactData.dateOfBirth) : null,
          address1: contactData.address1 || '',
          city: contactData.city || '',
          state: contactData.state || '',
          country: contactData.country || '',
          postalCode: contactData.postalCode || '',
          companyName: contactData.companyName || '',
          website: contactData.website || '',
          timezone: contactData.timezone || '',
          dnd: contactData.dnd || false,
          dndSettings: contactData.dndSettings || {},
          customFields: contactData.customFields || [],
          type: contactData.type || contactData.contactType || 'lead',
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
    // Handle nested structure
    let contactData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      contactData = payload.webhookPayload;
      locationId = payload.locationId || contactData.locationId;
    } else {
      // Direct format
      contactData = payload;
      locationId = payload.locationId;
    }
    
    const { id } = contactData;
    
    console.log(`[ContactsProcessor] Updating contact:`, {
      id,
      locationId,
      webhookId
    });
    
    if (!id || !locationId) {
      console.error(`[ContactsProcessor] Missing required contact data:`, {
        id: !!id,
        locationId: !!locationId,
        webhookId
      });
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
      if (contactData[field] !== undefined) {
        updateData[field] = contactData[field];
      }
    });
    
    // Update fullName if name fields changed
    if (contactData.firstName !== undefined || contactData.lastName !== undefined) {
      const firstName = contactData.firstName !== undefined ? contactData.firstName : '';
      const lastName = contactData.lastName !== undefined ? contactData.lastName : '';
      updateData.fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
    }
    
    // Handle date fields
    if (contactData.dateOfBirth !== undefined) {
      updateData.dateOfBirth = contactData.dateOfBirth ? new Date(contactData.dateOfBirth) : null;
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
    // Handle nested structure
    let contactData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      contactData = payload.webhookPayload;
      locationId = payload.locationId || contactData.locationId;
    } else {
      // Direct format
      contactData = payload;
      locationId = payload.locationId;
    }
    
    const { id } = contactData;
    
    console.log(`[ContactsProcessor] Deleting contact:`, {
      id,
      locationId,
      webhookId
    });
    
    if (!id || !locationId) {
      console.error(`[ContactsProcessor] Missing required contact data:`, {
        id: !!id,
        locationId: !!locationId,
        webhookId
      });
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
    // Handle nested structure
    let contactData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      contactData = payload.webhookPayload;
      locationId = payload.locationId || contactData.locationId;
    } else {
      // Direct format
      contactData = payload;
      locationId = payload.locationId;
    }
    
    const { id, dnd, dndSettings } = contactData;
    
    console.log(`[ContactsProcessor] Starting DND Update:`, {
      locationId,
      ghlContactId: id,
      dnd,
      dndSettings,
      webhookId
    });
    
    if (!id || !locationId) {
      console.error(`[ContactsProcessor] Missing required contact data:`, {
        id: !!id,
        locationId: !!locationId,
        webhookId
      });
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
    // Handle nested structure
    let contactData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      contactData = payload.webhookPayload;
      locationId = payload.locationId || contactData.locationId;
    } else {
      // Direct format
      contactData = payload;
      locationId = payload.locationId;
    }
    
    const { id, tags } = contactData;
    
    console.log(`[ContactsProcessor] Updating tags:`, {
      locationId,
      ghlContactId: id,
      tags,
      webhookId
    });
    
    if (!id || !locationId) {
      console.error(`[ContactsProcessor] Missing required contact data:`, {
        id: !!id,
        locationId: !!locationId,
        webhookId
      });
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
    // Handle nested structure
    let noteData;
    let locationId;
    let contactId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      noteData = payload.webhookPayload;
      locationId = payload.locationId || noteData.locationId;
      contactId = noteData.contactId;
    } else {
      // Direct format
      noteData = payload;
      locationId = payload.locationId;
      contactId = payload.contactId;
    }
    
    const { note } = noteData;
    
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
    // Handle nested structure
    let taskData;
    let locationId;
    let contactId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      taskData = payload.webhookPayload;
      locationId = payload.locationId || taskData.locationId;
      contactId = taskData.contactId;
    } else {
      // Direct format
      taskData = payload;
      locationId = payload.locationId;
      contactId = payload.contactId;
    }
    
    const { task } = taskData;
    
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