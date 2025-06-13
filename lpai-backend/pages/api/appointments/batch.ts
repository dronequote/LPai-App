// pages/api/appointments/batch.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { 
  sendSuccess, 
  sendError, 
  sendValidationError,
  sendServerError,
  sendMethodNotAllowed 
} from '../../../src/utils/response';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }
  
  const client = await clientPromise;
  const db = client.db('lpai');
  
  return await processBatchOperation(db, req.body, res);
}

async function processBatchOperation(db: any, body: any, res: NextApiResponse) {
  try {
    const { action, appointments, locationId, userId, options = {} } = body;
    
    if (!action || !appointments || !locationId) {
      return sendValidationError(res, {
        action: !action ? 'Required' : undefined,
        appointments: !appointments ? 'Required' : undefined,
        locationId: !locationId ? 'Required' : undefined
      });
    }
    
    if (!Array.isArray(appointments) || appointments.length === 0) {
      return sendValidationError(res, { appointments: 'Must be a non-empty array' });
    }
    
    const validActions = ['create', 'update', 'delete', 'cancel', 'reschedule'];
    if (!validActions.includes(action)) {
      return sendValidationError(res, { 
        action: `Invalid action. Must be one of: ${validActions.join(', ')}` 
      });
    }
    
    // Get location for GHL sync
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.ghlOAuth?.accessToken) {
      return sendError(res, 'Location not found or missing API key', 400);
    }
    
    const results = {
      success: [] as any[],
      failed: [] as any[],
      conflicts: [] as any[],
      total: appointments.length
    };
    
    switch (action) {
      case 'create':
        // Check for conflicts first if requested
        if (options.checkConflicts) {
          const conflictResults = await checkAppointmentConflicts(
            db,
            appointments,
            locationId
          );
          
          if (conflictResults.length > 0) {
            results.conflicts = conflictResults;
            
            if (!options.allowConflicts) {
              return sendSuccess(res, {
                action,
                results: {
                  successful: 0,
                  failed: 0,
                  conflicts: conflictResults.length,
                  total: appointments.length,
                  conflictDetails: conflictResults
                }
              }, 'Batch create aborted due to conflicts');
            }
          }
        }
        
        for (const appointmentData of appointments) {
          try {
            // Skip if conflict exists and not allowing conflicts
            if (results.conflicts.some(c => c.appointment === appointmentData)) {
              continue;
            }
            
            // Validate required fields
            if (!appointmentData.contactId || !appointmentData.calendarId || 
                !appointmentData.start || !appointmentData.end || !appointmentData.title) {
              results.failed.push({
                appointment: appointmentData,
                error: 'Missing required fields'
              });
              continue;
            }
            
            // Get contact and user
            const [contact, user] = await Promise.all([
              db.collection('contacts').findOne({ 
                _id: new ObjectId(appointmentData.contactId),
                locationId 
              }),
              appointmentData.userId ? db.collection('users').findOne({ 
                _id: new ObjectId(appointmentData.userId),
                locationId 
              }) : null
            ]);
            
            if (!contact || !contact.ghlContactId) {
              results.failed.push({
                appointment: appointmentData,
                error: 'Contact not found or missing GHL ID'
              });
              continue;
            }
            
            if (appointmentData.userId && (!user || !user.ghlUserId)) {
              results.failed.push({
                appointment: appointmentData,
                error: 'User not found or missing GHL ID'
              });
              continue;
            }
            
            // Create in GHL first
            const ghlPayload = {
              title: appointmentData.title,
              appointmentStatus: 'confirmed',
              assignedUserId: user?.ghlUserId || null,
              address: contact.address || 'TBD',
              ignoreDateRange: false,
              toNotify: options.sendNotifications || false,
              calendarId: appointmentData.calendarId,
              locationId,
              contactId: contact.ghlContactId,
              startTime: appointmentData.start,
              endTime: appointmentData.end,
              notes: appointmentData.notes || ''
            };
            
            const ghlResponse = await axios.post(
              `${GHL_BASE_URL}/calendars/events/appointments`,
              ghlPayload,
              {
                headers: {
                  'Authorization': `Bearer ${location.ghlOAuth.accessToken}`,
                  'Version': '2021-04-15',
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                }
              }
            );
            
            // Save to MongoDB
            const newAppointment = {
              ...appointmentData,
              locationId,
              ghlAppointmentId: ghlResponse.data.event?.id || ghlResponse.data.id,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            const result = await db.collection('appointments').insertOne(newAppointment);
            results.success.push({ ...newAppointment, _id: result.insertedId });
            
          } catch (error: any) {
            results.failed.push({
              appointment: appointmentData,
              error: error.response?.data || error.message
            });
          }
        }
        break;
        
      case 'cancel':
        for (const appointment of appointments) {
          try {
            const appointmentId = appointment.id || appointment;
            
            // Get appointment
            const existing = await db.collection('appointments').findOne({
              _id: new ObjectId(appointmentId),
              locationId
            });
            
            if (!existing) {
              results.failed.push({
                appointment,
                error: 'Appointment not found'
              });
              continue;
            }
            
            // Update in MongoDB
            await db.collection('appointments').updateOne(
              { _id: new ObjectId(appointmentId) },
              {
                $set: {
                  status: 'cancelled',
                  appointmentStatus: 'cancelled',
                  cancelledAt: new Date(),
                  cancelledBy: userId,
                  cancellationReason: options.cancellationReason || 'Batch cancellation',
                  updatedAt: new Date()
                }
              }
            );
            
            // Cancel in GHL if has ID
            if (existing.ghlAppointmentId) {
              try {
                await axios.put(
                  `${GHL_BASE_URL}/calendars/events/appointments/${existing.ghlAppointmentId}`,
                  { appointmentStatus: 'cancelled' },
                  {
                    headers: {
                      'Authorization': `Bearer ${location.ghlOAuth.accessToken}`,
                      'Version': '2021-04-15',
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                    }
                  }
                );
              } catch (ghlError) {
                console.error('[APPOINTMENTS BATCH] GHL cancel failed:', ghlError);
              }
            }
            
            results.success.push({ id: appointmentId, cancelled: true });
            
          } catch (error: any) {
            results.failed.push({
              appointment,
              error: error.message
            });
          }
        }
        break;
        
      case 'reschedule':
        const { newStart, newEnd, timeShift } = options;
        
        if (!newStart && !timeShift) {
          return sendValidationError(res, { 
            reschedule: 'Either newStart/newEnd or timeShift required' 
          });
        }
        
        for (const appointment of appointments) {
          try {
            const appointmentId = appointment.id || appointment;
            
            // Get existing appointment
            const existing = await db.collection('appointments').findOne({
              _id: new ObjectId(appointmentId),
              locationId
            });
            
            if (!existing) {
              results.failed.push({
                appointment,
                error: 'Appointment not found'
              });
              continue;
            }
            
            // Calculate new times
            let updatedStart, updatedEnd;
            
            if (timeShift) {
              // Shift by specified minutes
              updatedStart = new Date(new Date(existing.start).getTime() + timeShift * 60000);
              updatedEnd = new Date(new Date(existing.end).getTime() + timeShift * 60000);
            } else {
              updatedStart = new Date(newStart);
              updatedEnd = new Date(newEnd || new Date(updatedStart).getTime() + existing.duration * 60000);
            }
            
            // Update in MongoDB
            await db.collection('appointments').updateOne(
              { _id: new ObjectId(appointmentId) },
              {
                $set: {
                  start: updatedStart.toISOString(),
                  end: updatedEnd.toISOString(),
                  rescheduled: true,
                  rescheduledAt: new Date(),
                  rescheduledBy: userId,
                  updatedAt: new Date()
                },
                $push: {
                  history: {
                    action: 'rescheduled',
                    previousStart: existing.start,
                    previousEnd: existing.end,
                    newStart: updatedStart.toISOString(),
                    newEnd: updatedEnd.toISOString(),
                    timestamp: new Date(),
                    userId
                  }
                }
              }
            );
            
            // Update in GHL if has ID
            if (existing.ghlAppointmentId) {
              try {
                await axios.put(
                  `${GHL_BASE_URL}/calendars/events/appointments/${existing.ghlAppointmentId}`,
                  {
                    startTime: updatedStart.toISOString(),
                    endTime: updatedEnd.toISOString()
                  },
                  {
                    headers: {
                      'Authorization': `Bearer ${location.ghlOAuth.accessToken}`,
                      'Version': '2021-04-15',
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                    }
                  }
                );
              } catch (ghlError) {
                console.error('[APPOINTMENTS BATCH] GHL reschedule failed:', ghlError);
              }
            }
            
            results.success.push({ 
              id: appointmentId, 
              rescheduled: true,
              newStart: updatedStart.toISOString(),
              newEnd: updatedEnd.toISOString()
            });
            
          } catch (error: any) {
            results.failed.push({
              appointment,
              error: error.message
            });
          }
        }
        break;
    }
    
    return sendSuccess(res, {
      action,
      results: {
        successful: results.success.length,
        failed: results.failed.length,
        conflicts: results.conflicts.length,
        total: results.total,
        details: options.includeDetails ? results : undefined
      }
    }, `Batch ${action} completed`);
    
  } catch (error) {
    console.error('[APPOINTMENTS BATCH] Operation error:', error);
    return sendServerError(res, error, 'Batch operation failed');
  }
}

// Helper to check for appointment conflicts
async function checkAppointmentConflicts(
  db: any, 
  appointments: any[], 
  locationId: string
): Promise<any[]> {
  const conflicts = [];
  
  for (const appointment of appointments) {
    const start = new Date(appointment.start);
    const end = new Date(appointment.end);
    
    // Check for overlapping appointments
    const overlapping = await db.collection('appointments').findOne({
      locationId,
      calendarId: appointment.calendarId,
      status: { $ne: 'cancelled' },
      $or: [
        {
          // New appointment starts during existing
          start: { $lte: start },
          end: { $gt: start }
        },
        {
          // New appointment ends during existing
          start: { $lt: end },
          end: { $gte: end }
        },
        {
          // New appointment completely contains existing
          start: { $gte: start },
          end: { $lte: end }
        }
      ]
    });
    
    if (overlapping) {
      conflicts.push({
        appointment,
        conflict: {
          id: overlapping._id,
          title: overlapping.title,
          start: overlapping.start,
          end: overlapping.end
        }
      });
    }
  }
  
  return conflicts;
}