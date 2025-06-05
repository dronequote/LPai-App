// src/utils/webhooks/processors/appointments.ts
import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId } from 'mongodb';

export class AppointmentsProcessor extends BaseProcessor {
  constructor() {
    super({
      queueType: 'appointments',
      batchSize: 50,
      maxRuntime: 50000, // 50 seconds
      processorName: 'AppointmentsProcessor'
    });
  }

  /**
   * Process appointment webhooks
   */
  protected async processItem(item: QueueItem): Promise<void> {
    const { type, payload, webhookId } = item;

    // Track appointment processing start
    const appointmentStartTime = Date.now();

    switch (type) {
      case 'AppointmentCreate':
        await this.processAppointmentCreate(payload, webhookId);
        break;
        
      case 'AppointmentUpdate':
        await this.processAppointmentUpdate(payload, webhookId);
        break;
        
      case 'AppointmentDelete':
        await this.processAppointmentDelete(payload, webhookId);
        break;
        
      default:
        console.warn(`[AppointmentsProcessor] Unknown appointment type: ${type}`);
        throw new Error(`Unsupported appointment webhook type: ${type}`);
    }

    // Track appointment processing time
    const processingTime = Date.now() - appointmentStartTime;
    if (processingTime > 2000) {
      console.warn(`[AppointmentsProcessor] Slow appointment processing: ${processingTime}ms for ${type}`);
    }
  }

  /**
   * Process appointment create
   */
  private async processAppointmentCreate(payload: any, webhookId: string): Promise<void> {
    const { locationId, appointment } = payload;
    
    if (!appointment?.id || !locationId) {
      throw new Error('Missing required appointment data');
    }
    
    console.log(`[AppointmentsProcessor] Creating appointment ${appointment.id}`);
    
    // Find contact if exists
    let contactId = null;
    if (appointment.contactId) {
      const contact = await this.db.collection('contacts').findOne(
        {
          ghlContactId: appointment.contactId,
          locationId: locationId
        },
        {
          projection: { _id: 1 }
        }
      );
      if (contact) {
        contactId = contact._id.toString();
      }
    }
    
    // Start session for atomic operations
    const session = this.db.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        await this.db.collection('appointments').updateOne(
          { ghlAppointmentId: appointment.id, locationId },
          {
            $set: {
              ghlAppointmentId: appointment.id,
              locationId,
              contactId,
              ghlContactId: appointment.contactId,
              calendarId: appointment.calendarId,
              groupId: appointment.groupId,
              appointmentStatus: appointment.appointmentStatus,
              title: appointment.title || 'Appointment',
              assignedUserId: appointment.assignedUserId,
              users: appointment.users || [],
              notes: appointment.notes || '',
              source: appointment.source || 'webhook',
              startTime: appointment.startTime ? new Date(appointment.startTime) : null,
              endTime: appointment.endTime ? new Date(appointment.endTime) : null,
              dateAdded: appointment.dateAdded ? new Date(appointment.dateAdded) : new Date(),
              address: appointment.address || '',
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
          { upsert: true, session }
        );
        
        // Update project timeline if exists
        if (contactId) {
          const project = await this.db.collection('projects').findOne(
            {
              contactId: contactId,
              locationId: locationId,
              status: { $in: ['open', 'quoted', 'won', 'in_progress'] }
            },
            {
              projection: { _id: 1 },
              session
            }
          );
          
          if (project) {
            await this.db.collection('projects').updateOne(
              { _id: project._id },
              {
                $push: {
                  timeline: {
                    id: new ObjectId().toString(),
                    event: 'appointment_scheduled',
                    description: `${appointment.title || 'Appointment'} scheduled`,
                    timestamp: new Date().toISOString(),
                    metadata: {
                      appointmentId: appointment.id,
                      startTime: appointment.startTime,
                      webhookId
                    }
                  }
                }
              },
              { session }
            );
          }
        }
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Process appointment update
   */
  private async processAppointmentUpdate(payload: any, webhookId: string): Promise<void> {
    const { locationId, appointment } = payload;
    
    if (!appointment?.id || !locationId) {
      throw new Error('Missing required appointment data');
    }
    
    console.log(`[AppointmentsProcessor] Updating appointment ${appointment.id}`);
    
    const updateData: any = {
      lastWebhookUpdate: new Date(),
      updatedAt: new Date(),
      processedBy: 'queue',
      webhookId
    };
    
    // Update fields that might change
    const fieldsToUpdate = [
      'title', 'appointmentStatus', 'assignedUserId', 'users',
      'notes', 'source', 'address', 'groupId'
    ];
    
    fieldsToUpdate.forEach(field => {
      if (appointment[field] !== undefined) {
        updateData[field] = appointment[field];
      }
    });
    
    // Handle date fields
    if (appointment.startTime) updateData.startTime = new Date(appointment.startTime);
    if (appointment.endTime) updateData.endTime = new Date(appointment.endTime);
    
    const result = await this.db.collection('appointments').updateOne(
      { ghlAppointmentId: appointment.id, locationId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      // Appointment doesn't exist, create it
      await this.processAppointmentCreate(payload, webhookId);
    }
  }

  /**
   * Process appointment delete
   */
  private async processAppointmentDelete(payload: any, webhookId: string): Promise<void> {
    const { locationId, appointment } = payload;
    
    if (!appointment?.id || !locationId) {
      throw new Error('Missing required appointment data');
    }
    
    console.log(`[AppointmentsProcessor] Deleting appointment ${appointment.id}`);
    
    await this.db.collection('appointments').updateOne(
      { ghlAppointmentId: appointment.id, locationId },
      { 
        $set: { 
          deleted: true,
          deletedAt: new Date(),
          deletedByWebhook: webhookId,
          appointmentStatus: 'cancelled',
          processedBy: 'queue'
        } 
      }
    );
  }
}