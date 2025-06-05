// src/utils/webhooks/processors/contacts.ts
import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId } from 'mongodb';

export class ContactsProcessor extends BaseProcessor {
  constructor() {
    super({
      queueType: 'contacts',
      batchSize: 50,
      maxRuntime: 50000, // 50 seconds
      processorName: 'ContactsProcessor'
    });
  }

  /**
   * Process contact webhooks
   */
  protected async processItem(item: QueueItem): Promise<void> {
    const { type, payload, webhookId } = item;

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
        
      default:
        console.warn(`[ContactsProcessor] Unknown contact type: ${type}`);
        throw new Error(`Unsupported contact webhook type: ${type}`);
    }

    // Track contact processing time
    const processingTime = Date.now() - contactStartTime;
    if (processingTime > 2000) {
      console.warn(`[ContactsProcessor] Slow contact processing: ${processingTime}ms for ${type}`);
    }
  }

  /**
   * Process contact create
   */
  private async processContactCreate(payload: any, webhookId: string): Promise<void> {
    const { locationId, id, email, firstName, lastName, phone } = payload;
    
    if (!id || !locationId) {
      throw new Error('Missing required contact data');
    }
    
    console.log(`[ContactsProcessor] Creating contact ${email || id}`);
    
    await this.db.collection('contacts').updateOne(
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
  }

  /**
   * Process contact update
   */
  private async processContactUpdate(payload: any, webhookId: string): Promise<void> {
    const { locationId, id } = payload;
    
    if (!id || !locationId) {
      throw new Error('Missing required contact data');
    }
    
    console.log(`[ContactsProcessor] Updating contact ${id}`);
    
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
    
    if (result.matchedCount === 0) {
      // Contact doesn't exist, create it
      await this.processContactCreate(payload, webhookId);
    }
  }

  /**
   * Process contact delete
   */
  private async processContactDelete(payload: any, webhookId: string): Promise<void> {
    const { locationId, id } = payload;
    
    if (!id || !locationId) {
      throw new Error('Missing required contact data');
    }
    
    console.log(`[ContactsProcessor] Deleting contact ${id}`);
    
    await this.db.collection('contacts').updateOne(
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
  }

  /**
   * Process contact DND update
   */
  private async processContactDndUpdate(payload: any, webhookId: string): Promise<void> {
    const { locationId, id, dnd, dndSettings } = payload;
    
    if (!id || !locationId) {
      throw new Error('Missing required contact data');
    }
    
    console.log(`[ContactsProcessor] Updating DND for contact ${id}`);
    
    await this.db.collection('contacts').updateOne(
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
  }

  /**
   * Process contact tag update
   */
  private async processContactTagUpdate(payload: any, webhookId: string): Promise<void> {
    const { locationId, id, tags } = payload;
    
    if (!id || !locationId) {
      throw new Error('Missing required contact data');
    }
    
    console.log(`[ContactsProcessor] Updating tags for contact ${id}`);
    
    await this.db.collection('contacts').updateOne(
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
  }
}