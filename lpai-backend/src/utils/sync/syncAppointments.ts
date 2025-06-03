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
    startDate = defaultStartDate,
    endDate = defaultEndDate,
    fullSync = false 
  } = options;
  
  console.log(`[Sync Appointments] Starting for ${location.locationId} - Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Get all calendars for this location
    const calendars = location.calendars || [];
    if (calendars.length === 0) {
      console.log(`[Sync Appointments] No calendars found for location ${location.locationId}`);
      return {
        success: true,
        created: 0,
        updated: 0,
        skipped: 0,
        processed: 0,
        message: 'No calendars configured'
      };
    }

    // Convert dates to milliseconds for API
    const startTimeMs = startDate.getTime().toString();
    const endTimeMs = endDate.getTime().toString();

    // Process each calendar
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalProcessed = 0;
    const errors: any[] = [];

    for (const calendar of calendars) {
      try {
        console.log(`[Sync Appointments] Syncing calendar: ${calendar.name} (${calendar.id})`);
        
        // Fetch appointments from GHL for this calendar
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
              calendarId: calendar.id,
              startTime: startTimeMs,
              endTime: endTimeMs
            }
          }
        );

        const ghlAppointments = response.data.events || [];
        console.log(`[Sync Appointments] Found ${ghlAppointments.length} appointments in calendar ${calendar.name}`);

        // Process each appointment
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
              } else {
                console.warn(`[Sync Appointments] Contact not found for appointment ${ghlAppt.id}, GHL contact: ${ghlAppt.contactId}`);
                totalSkipped++;
                continue;
              }
            }

            // Find assigned user if available
            let assignedUserId = null;
            if (ghlAppt.assignedUserId) {
              const assignedUser = await db.collection('users').findOne({
                ghlUserId: ghlAppt.assignedUserId,
                locationId: location.locationId
              });
              if (assignedUser) {
                assignedUserId = assignedUser._id.toString();
              }
            }

            // Check if appointment exists
            const existingAppointment = await db.collection('appointments').findOne({
              ghlAppointmentId: ghlAppt.id
            });

            // Parse dates (they come with timezone info)
            const startDate = new Date(ghlAppt.startTime);
            const endDate = new Date(ghlAppt.endTime);
            const duration = Math.round((endDate.getTime() - startDate.getTime()) / 60000); // in minutes

            // Determine location type and address
            let locationType = 'address';
            let address = ghlAppt.address || '';
            let customLocation = '';
            
            if (!address && contact) {
              address = contact.address || '';
            }

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
              calendarId: ghlAppt.calendarId,
              groupId: ghlAppt.groupId || '',
              
              // Timing
              start: startDate,
              end: endDate,
              duration: duration,
              timezone: location.timezone || 'America/Denver', // Extract from location
              
              // Location
              locationType: locationType,
              customLocation: customLocation,
              address: address,
              
              // Status
              status: mapGHLAppointmentStatus(ghlAppt.appointmentStatus),
              appointmentStatus: ghlAppt.appointmentStatus,
              
              // Contact Info (denormalized)
              contactName: contact ? (contact.fullName || `${contact.firstName} ${contact.lastName}`.trim()) : '',
              contactEmail: contact?.email || '',
              contactPhone: contact?.phone || '',
              
              // Calendar Info (denormalized)
              calendarName: calendar.name,
              
              // Additional GHL fields
              assignedUserId: ghlAppt.assignedUserId,
              assignedResources: ghlAppt.assignedResources || [],
              isRecurring: ghlAppt.isRecurring || false,
              
              // Creation info
              createdBy: ghlAppt.createdBy || {},
              
              // GHL Metadata
              ghlCreatedAt: ghlAppt.dateAdded ? new Date(ghlAppt.dateAdded) : null,
              ghlUpdatedAt: ghlAppt.dateUpdated ? new Date(ghlAppt.dateUpdated) : null,
              
              // Sync Metadata
              lastSyncedAt: new Date(),
              updatedAt: new Date()
            };

            if (existingAppointment) {
              // Update existing appointment
              await db.collection('appointments').updateOne(
                { _id: existingAppointment._id },
                { 
                  $set: appointmentData,
                  $setOnInsert: { createdAt: new Date() }
                }
              );
              totalUpdated++;
            } else {
              // Create new appointment
              await db.collection('appointments').insertOne({
                _id: new ObjectId(),
                ...appointmentData,
                createdAt: new Date(),
                createdBySync: true
              });
              totalCreated++;
            }
            
            totalProcessed++;
            
          } catch (apptError: any) {
            console.error(`[Sync Appointments] Error processing appointment ${ghlAppt.title || ghlAppt.id}:`, apptError.message);
            errors.push({
              appointmentId: ghlAppt.id,
              title: ghlAppt.title,
              calendarId: calendar.id,
              calendarName: calendar.name,
              error: apptError.message
            });
            totalSkipped++;
          }
        }
        
      } catch (calendarError: any) {
        console.error(`[Sync Appointments] Error syncing calendar ${calendar.name}:`, calendarError.message);
        errors.push({
          calendarId: calendar.id,
          calendarName: calendar.name,
          error: calendarError.message,
          isCalendarLevel: true
        });
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
            dateRange: {
              start: startDate,
              end: endDate
            },
            calendarsProcessed: calendars.length,
            appointmentsSynced: totalProcessed,
            errors: errors.length
          }
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Appointments] Completed in ${duration}ms - Created: ${totalCreated}, Updated: ${totalUpdated}, Skipped: ${totalSkipped}`);

    return {
      success: true,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      processed: totalProcessed,
      calendarsProcessed: calendars.length,
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
    'confirmed': 'scheduled',
    'scheduled': 'scheduled',
    'pending': 'scheduled',
    'showed': 'completed',
    'complete': 'completed',
    'completed': 'completed',
    'noshow': 'no-show',
    'no-show': 'no-show',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
    'declined': 'cancelled'
  };
  
  return statusMap[ghlStatus?.toLowerCase()] || 'scheduled';
}