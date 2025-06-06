// src/utils/webhooks/processors/appointments.ts
import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId, Db } from 'mongodb';

export class AppointmentsProcessor extends BaseProcessor {
  constructor(db?: Db) {
    super({
      queueType: 'appointments',
      batchSize: 50,
      maxRuntime: 50000,
      processorName: 'AppointmentsProcessor'
    }, db);
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
    // Handle nested structure
    let appointmentData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      appointmentData = payload.webhookPayload;
      locationId = payload.locationId || appointmentData.locationId;
    } else {
      // Direct format
      appointmentData = payload;
      locationId = payload.locationId;
    }
    
    const { appointment } = appointmentData;
    
    if (!appointment?.id || !locationId) {
      console.error(`[AppointmentsProcessor] Missing required appointment data:`, {
        appointmentId: appointment?.id,
        locationId: !!locationId,
        webhookId
      });
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
    const session = this.client.startSession();
    
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
              appointmentStatus: appointment.appointmentStatus || appointment.status,
              title: appointment.title || 'Appointment',
              assignedUserId: appointment.assignedUserId,
              users: appointment.users || [],
              notes: appointment.notes || '',
              source: appointment.source || 'webhook',
              startTime: appointment.startTime ? new Date(appointment.startTime) : null,
              endTime: appointment.endTime ? new Date(appointment.endTime) : null,
              dateAdded: appointment.dateAdded ? new Date(appointment.dateAdded) : new Date(),
              address: appointment.address || appointment.location || '',
              timezone: appointment.timezone || appointment.selectedTimezone || 'UTC',
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
    // Handle nested structure
    let appointmentData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      appointmentData = payload.webhookPayload;
      locationId = payload.locationId || appointmentData.locationId;
    } else {
      // Direct format
      appointmentData = payload;
      locationId = payload.locationId;
    }
    
    const { appointment } = appointmentData;
    
    if (!appointment?.id || !locationId) {
      console.error(`[AppointmentsProcessor] Missing required appointment data:`, {
        appointmentId: appointment?.id,
        locationId: !!locationId,
        webhookId
      });
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
      'title', 'assignedUserId', 'users',
      'notes', 'source', 'groupId', 'timezone'
    ];
    
    fieldsToUpdate.forEach(field => {
      if (appointment[field] !== undefined) {
        updateData[field] = appointment[field];
      }
    });
    
    // Handle status fields (can be in different places)
    if (appointment.appointmentStatus !== undefined) {
      updateData.appointmentStatus = appointment.appointmentStatus;
    } else if (appointment.status !== undefined) {
      updateData.appointmentStatus = appointment.status;
    }
    
    // Handle address/location field
    if (appointment.address !== undefined) {
      updateData.address = appointment.address;
    } else if (appointment.location !== undefined) {
      updateData.address = appointment.location;
    }
    
    // Handle date fields
    if (appointment.startTime) updateData.startTime = new Date(appointment.startTime);
    if (appointment.endTime) updateData.endTime = new Date(appointment.endTime);
    if (appointment.dateAdded) updateData.dateAdded = new Date(appointment.dateAdded);
    
    const result = await this.db.collection('appointments').updateOne(
      { ghlAppointmentId: appointment.id, locationId },
      { $set: updateData }
    );
    
    console.log(`[AppointmentsProcessor] Update result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      fieldsUpdated: Object.keys(updateData).length
    });
    
    if (result.matchedCount === 0) {
      // Appointment doesn't exist, create it
      console.log(`[AppointmentsProcessor] Appointment not found, creating new one`);
      await this.processAppointmentCreate(payload, webhookId);
    }
  }

  /**
   * Process appointment delete
   */
  private async processAppointmentDelete(payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let appointmentData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      appointmentData = payload.webhookPayload;
      locationId = payload.locationId || appointmentData.locationId;
    } else {
      // Direct format
      appointmentData = payload;
      locationId = payload.locationId;
    }
    
    const { appointment } = appointmentData;
    
    if (!appointment?.id || !locationId) {
      console.error(`[AppointmentsProcessor] Missing required appointment data:`, {
        appointmentId: appointment?.id,
        locationId: !!locationId,
        webhookId
      });
      throw new Error('Missing required appointment data');
    }
    
    console.log(`[AppointmentsProcessor] Deleting appointment ${appointment.id}`);
    
    const result = await this.db.collection('appointments').updateOne(
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
    
    console.log(`[AppointmentsProcessor] Delete result:`, {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
    
    // Update project timeline if appointment was linked to a contact
    const appointment = await this.db.collection('appointments').findOne({
      ghlAppointmentId: appointmentData.appointment.id,
      locationId
    });
    
    if (appointment?.contactId) {
      const project = await this.db.collection('projects').findOne({
        contactId: appointment.contactId,
        locationId: locationId,
        status: { $in: ['open', 'quoted', 'won', 'in_progress'] }
      });
      
      if (project) {
        await this.db.collection('projects').updateOne(
          { _id: project._id },
          {
            $push: {
              timeline: {
                id: new ObjectId().toString(),
                event: 'appointment_cancelled',
                description: `${appointment.title || 'Appointment'} cancelled`,
                timestamp: new Date().toISOString(),
                metadata: {
                  appointmentId: appointmentData.appointment.id,
                  webhookId
                }
              }
            }
          }
        );
      }
    }
  }
}