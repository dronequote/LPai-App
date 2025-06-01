// src/utils/sync/syncAppointments.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

interface SyncOptions {
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  fullSync?: boolean;
}

export async function syncAppointments(db: Db, location: any, options: SyncOptions = {}) {
  const startTime = Date.now();
  
  // Default to syncing appointments from last 30 days to next 90 days
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);
  const defaultEndDate = new Date();
  defaultEndDate.setDate(defaultEndDate.getDate() + 90);
  
  const { 
    limit = 100, 
    startDate = defaultStartDate,
    endDate = defaultEndDate,
    fullSync = false 
  } = options;
  
  console.log(`[Sync Appointments] Starting for ${location.locationId} - Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Fetch appointments from GHL
    const response = await axios.get(
      'https://services.leadconnectorhq.com/calendars/events',
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-04-15',  // Calendar events use older version
          'Accept': 'application/json'
        },
        params: {
          locationId: location.locationId,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          limit
        }
      }
    );

    const ghlAppointments = response.data.events || [];
    console.log(`[Sync Appointments] Found ${ghlAppointments.length} appointments`);

    // Process each appointment
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const ghlAppt of ghlAppointments) {
      try {
        // Find the contact for this appointment
        let contact = null;
        let contactId = null;
        
        if (ghlAppt.contactId) {
          contact = await db.collection('contacts').findOne({
            ghlContactId: ghlAppt.contactId,
            locationId: location.locationId
          });
          if (contact) {
            contactId = contact._id.toString();
          }
        }

        // If no contact found, try to find by email or phone
        if (!contact && (ghlAppt.contact?.email || ghlAppt.contact?.phone)) {
          contact = await db.collection('contacts').findOne({
            locationId: location.locationId,
            $or: [
              { email: ghlAppt.contact?.email },
              { phone: ghlAppt.contact?.phone }
            ]
          });
          if (contact) {
            contactId = contact._id.toString();
          }
        }

        if (!contact) {
          console.warn(`[Sync Appointments] Contact not found for appointment ${ghlAppt.id}, skipping`);
          skipped++;
          continue;
        }

        // Find assigned user if available
        let assignedUserId = null;
        if (ghlAppt.assignedUserId || ghlAppt.userId) {
          const assignedUser = await db.collection('users').findOne({
            ghlUserId: ghlAppt.assignedUserId || ghlAppt.userId,
            locationId: location.locationId
          });
          if (assignedUser) {
            assignedUserId = assignedUser._id.toString();
          }
        }

        // Check if appointment exists
        const existingAppointment = await db.collection('appointments').findOne({
          $or: [
            { ghlAppointmentId: ghlAppt.id },
            { ghlEventId: ghlAppt.id }
          ]
        });

        // Determine location type and address
        let locationType = 'address';
        let address = contact.address || '';
        let customLocation = '';
        
        if (ghlAppt.address) {
          address = ghlAppt.address;
          locationType = 'address';
        } else if (ghlAppt.meetingLocation) {
          if (ghlAppt.meetingLocation.includes('zoom') || ghlAppt.meetingLocation.includes('meet.google')) {
            locationType = ghlAppt.meetingLocation.includes('zoom') ? 'zoom' : 'googlemeet';
            customLocation = ghlAppt.meetingLocation;
          } else if (ghlAppt.meetingLocation.toLowerCase().includes('phone')) {
            locationType = 'phone';
            customLocation = ghlAppt.meetingLocation;
          } else {
            locationType = 'custom';
            customLocation = ghlAppt.meetingLocation;
          }
        }

        // Parse dates
        const startDate = new Date(ghlAppt.startTime);
        const endDate = new Date(ghlAppt.endTime);
        const duration = Math.round((endDate.getTime() - startDate.getTime()) / 60000); // in minutes

        // Map appointment status
        const status = mapGHLAppointmentStatus(ghlAppt.appointmentStatus || ghlAppt.status);

        // Prepare appointment data
        const appointmentData = {
          // GHL Integration
          ghlAppointmentId: ghlAppt.id,
          ghlEventId: ghlAppt.id,
          locationId: location.locationId,
          
          // Basic Information
          title: ghlAppt.title || 'Appointment',
          notes: ghlAppt.notes || '',
          
          // Relationships
          contactId: contactId,
          userId: assignedUserId,
          calendarId: ghlAppt.calendarId || '',
          
          // Timing
          start: startDate,
          end: endDate,
          duration: duration,
          timezone: ghlAppt.selectedTimezone || location.timezone || 'UTC',
          
          // Location
          locationType: locationType,
          customLocation: customLocation,
          address: address,
          
          // Status
          status: status,
          appointmentStatus: ghlAppt.appointmentStatus || status,
          
          // Contact Info (denormalized)
          contactName: contact.fullName || `${contact.firstName} ${contact.lastName}`.trim(),
          contactEmail: contact.email,
          contactPhone: contact.phone,
          
          // Additional GHL fields
          assignedUserId: ghlAppt.assignedUserId || ghlAppt.userId,
          meetingLocationType: ghlAppt.meetingLocationType,
          meetingLocationId: ghlAppt.meetingLocationId,
          
          // GHL Metadata
          ghlCreatedAt: ghlAppt.dateAdded ? new Date(ghlAppt.dateAdded) : null,
          ghlUpdatedAt: ghlAppt.dateUpdated ? new Date(ghlAppt.dateUpdated) : null,
          ghlPayload: ghlAppt,  // Store full payload for reference
          
          // Sync Metadata
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        };

        // Find related project if exists
        const project = await db.collection('projects').findOne({
          contactId: contactId,
          locationId: location.locationId,
          status: { $in: ['open', 'quoted'] }
        });
        
        if (project) {
          appointmentData.projectId = project._id.toString();
        }

        if (existingAppointment) {
          // Update existing appointment
          await db.collection('appointments').updateOne(
            { _id: existingAppointment._id },
            { 
              $set: appointmentData,
              $setOnInsert: { createdAt: new Date() }
            }
          );
          updated++;
        } else {
          // Create new appointment
          await db.collection('appointments').insertOne({
            _id: new ObjectId(),
            ...appointmentData,
            createdAt: new Date(),
            createdBySync: true
          });
          created++;
        }
        
      } catch (apptError: any) {
        console.error(`[Sync Appointments] Error processing appointment ${ghlAppt.title || ghlAppt.id}:`, apptError.message);
        errors.push({
          appointmentId: ghlAppt.id,
          title: ghlAppt.title,
          error: apptError.message
        });
        skipped++;
      }
    }

    // Update sync status
    await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          lastAppointmentSync: new Date(),
          appointmentSyncStatus: {
            lastSync: new Date(),
            syncedCount: created + updated,
            dateRange: {
              start: startDate,
              end: endDate
            },
            errors: errors.length
          }
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Appointments] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    return {
      success: true,
      created,
      updated,
      skipped,
      processed: ghlAppointments.length,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Appointments] Error:`, error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.status === 404) {
      console.log(`[Sync Appointments] Calendar events endpoint not found`);
      return {
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        processed: 0,
        error: 'Calendar events endpoint not found'
      };
    }
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied - check permissions for calendar events');
    }
    
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded - too many requests');
    }
    
    throw error;
  }
}

// Helper function to map GHL appointment status to our status
function mapGHLAppointmentStatus(ghlStatus: string): string {
  const statusMap: Record<string, string> = {
    'scheduled': 'scheduled',
    'confirmed': 'scheduled',
    'showed': 'completed',
    'completed': 'completed',
    'noshow': 'no-show',
    'no-show': 'no-show',
    'cancelled': 'cancelled',
    'canceled': 'cancelled'
  };
  
  return statusMap[ghlStatus?.toLowerCase()] || 'scheduled';
}