// src/services/appointmentService.ts
// Updated: 2025-06-18

import { BaseService } from './baseService';
import { Appointment, Contact, Project, Calendar } from '../../packages/types';
import { cacheService } from '../services/cacheService';


interface AppointmentListOptions {
 start?: Date | string;
 end?: Date | string;
 userId?: string;
 calendarId?: string;
 status?: string;
 limit?: number;
 offset?: number;
}

interface CreateAppointmentInput {
 title: string;
 contactId: string;
 userId: string;
 locationId: string;
 calendarId: string;
 start: string;
 end: string;
 duration?: number;
 notes?: string;
 locationType?: 'address' | 'custom' | 'phone' | 'googlemeet' | 'zoom';
 customLocation?: string;
 address?: string;
}

interface UpdateAppointmentInput {
 title?: string;
 start?: string;
 end?: string;
 notes?: string;
 status?: string;
 locationType?: string;
 customLocation?: string;
 address?: string;
}

interface RescheduleInput {
 start: string;
 end: string;
 reason?: string;
}

interface FreeSlotParams {
 startDate: string; // timestamp as string
 endDate: string;   // timestamp as string
 timezone: string;
 userId?: string;
 enableLookBusy?: string; // 'true' or 'false'
}

interface FreeSlotsResponse {
 [date: string]: {
   slots: string[];
 };
 traceId?: string;
}

class AppointmentService extends BaseService {
 protected serviceName = 'appointments';
 
 // Cache for free slots
 private freeSlotCache = new Map<string, { data: FreeSlotsResponse; timestamp: number }>();
 private CACHE_TTL = 5 * 60 * 1000; // 5 minutes
 
 /**
  * List appointments with filters
  */
 async list(
   locationId: string,
   options: AppointmentListOptions = {}
 ): Promise<Appointment[]> {
   const params: any = { locationId };
   
   if (options.start) params.start = options.start;
   if (options.end) params.end = options.end;
   if (options.userId) params.userId = options.userId;
   if (options.calendarId) params.calendarId = options.calendarId;
   if (options.status) params.status = options.status;
   if (options.limit) params.limit = options.limit;
   if (options.offset) params.offset = options.offset;
   
   const endpoint = '/api/appointments';
   
   return this.get<Appointment[]>(
     endpoint,
     {
       params,
       cache: { 
         priority: 'high', 
         ttl: 5 * 60 * 1000 
       },
     },
     {
       endpoint,
       method: 'GET',
       entity: 'appointment',
     }
   );
 }

 /**
  * Get today's appointments
  */
 async getTodaysAppointments(
   locationId: string,
   userId?: string
 ): Promise<Appointment[]> {
   const today = new Date();
   today.setHours(0, 0, 0, 0);
   
   const tomorrow = new Date(today);
   tomorrow.setDate(tomorrow.getDate() + 1);
   
   const options: AppointmentListOptions = {
     start: today.toISOString(),
     end: tomorrow.toISOString(),
   };
   
   if (userId) {
     options.userId = userId;
   }
   
   if (__DEV__) {
     console.log('[AppointmentService] Getting today\'s appointments:', {
       locationId,
       userId,
       start: options.start,
       end: options.end,
     });
   }
   
   return this.list(locationId, options);
 }

 /**
  * Get single appointment details
  */
 async getDetails(
   appointmentId: string,
   options?: { source?: 'local' | 'ghl' }
 ): Promise<Appointment> {
   const params = options?.source ? { source: options.source } : {};
   const endpoint = `/api/appointments/${appointmentId}`;
   
   return this.get<Appointment>(
     endpoint,
     {
       params,
       cache: { priority: 'high' },
     },
     {
       endpoint,
       method: 'GET',
       entity: 'appointment',
     }
   );
 }

 /**
  * Create new appointment
  */
 async create(data: CreateAppointmentInput): Promise<Appointment> {
   const endpoint = '/api/appointments';
   
   const newAppointment = await this.post<Appointment>(
     endpoint,
     data,
     {
       locationId: data.locationId,
     },
     {
       endpoint,
       method: 'POST',
       entity: 'appointment',
     }
   );

   // Clear list cache
   await this.clearListCache(data.locationId);
   
   return newAppointment;
 }

 /**
  * Update appointment
  */
 async update(
   appointmentId: string,
   data: UpdateAppointmentInput,
   locationId: string
 ): Promise<Appointment> {
   const endpoint = `/api/appointments/${appointmentId}`;
   
   const updated = await this.patch<Appointment>(
     endpoint,
     { ...data, locationId },
     {},
     {
       endpoint,
       method: 'PATCH',
       entity: 'appointment',
     }
   );

   // Clear caches
   await this.clearListCache(locationId);
   await this.clearDetailsCache(appointmentId);
   
   return updated;
 }

 /**
  * Reschedule appointment
  */
 async reschedule(
   appointmentId: string,
   data: RescheduleInput,
   locationId: string
 ): Promise<Appointment> {
   const endpoint = `/api/appointments/${appointmentId}/reschedule`;
   
   const updated = await this.post<Appointment>(
     endpoint,
     { ...data, locationId },
     {},
     {
       endpoint,
       method: 'POST',
       entity: 'appointment',
     }
   );

   // Clear caches
   await this.clearListCache(locationId);
   await this.clearDetailsCache(appointmentId);
   
   return updated;
 }

 /**
  * Cancel appointment
  */
 async cancel(
   appointmentId: string,
   reason: string,
   locationId: string
 ): Promise<Appointment> {
   const endpoint = `/api/appointments/${appointmentId}/cancel`;
   
   const updated = await this.post<Appointment>(
     endpoint,
     { reason, locationId },
     {},
     {
       endpoint,
       method: 'POST',
       entity: 'appointment',
     }
   );

   // Clear caches
   await this.clearListCache(locationId);
   await this.clearDetailsCache(appointmentId);
   
   return updated;
 }

 /**
  * Complete appointment
  */
 async complete(
   appointmentId: string,
   notes: string,
   locationId: string
 ): Promise<Appointment> {
   const endpoint = `/api/appointments/${appointmentId}/complete`;
   
   const updated = await this.post<Appointment>(
     endpoint,
     { notes, locationId },
     {},
     {
       endpoint,
       method: 'POST',
       entity: 'appointment',
     }
   );

   // Clear caches
   await this.clearListCache(locationId);
   await this.clearDetailsCache(appointmentId);
   
   return updated;
 }

 /**
  * Delete appointment
  */
 async deleteAppointment(
   appointmentId: string,
   locationId: string
 ): Promise<void> {
   const endpoint = `/api/appointments/${appointmentId}`;
   
   await this.delete<void>(
     endpoint,
     {
       params: { locationId },
     },
     {
       endpoint,
       method: 'DELETE',
       entity: 'appointment',
     }
   );

   // Clear caches
   await this.clearListCache(locationId);
   await this.clearDetailsCache(appointmentId);
 }

 /**
  * Get appointments for a contact
  */
 async getByContact(
   contactId: string,
   locationId: string
 ): Promise<Appointment[]> {
   return this.list(locationId, { 
     contactId,
     limit: 50,
   });
 }

 /**
  * Get appointments for a project
  */
 async getByProject(
   projectId: string,
   locationId: string
 ): Promise<Appointment[]> {
   const endpoint = `/api/projects/${projectId}/appointments`;
   
   return this.get<Appointment[]>(
     endpoint,
     {
       params: { locationId },
       cache: { priority: 'medium', ttl: 5 * 60 * 1000 },
     },
     {
       endpoint,
       method: 'GET',
       entity: 'appointment',
     }
   );
 }

 /**
  * Get upcoming appointments for a user
  */
 async getUpcoming(
   userId: string,
   locationId: string,
   days: number = 7
 ): Promise<Appointment[]> {
   const start = new Date();
   const end = new Date();
   end.setDate(end.getDate() + days);
   
   return this.list(locationId, {
     userId,
     start: start.toISOString(),
     end: end.toISOString(),
     status: 'scheduled',
   });
 }

 /**
  * Get appointment availability
  */
 async getAvailability(
   userId: string,
   calendarId: string,
   date: Date,
   locationId: string
 ): Promise<{
   slots: Array<{ start: string; end: string; available: boolean }>;
 }> {
   const endpoint = `/api/appointments/availability`;
   
   return this.get<any>(
     endpoint,
     {
       params: {
         userId,
         calendarId,
         date: date.toISOString().split('T')[0],
         locationId,
       },
     }
   );
 }

 /**
  * Get free slots from GHL calendar
  * Matches GHL API: GET /calendars/{calendarId}/free-slots
  */
 async getFreeSlots(
   calendarId: string,
   params: FreeSlotParams
 ): Promise<FreeSlotsResponse> {
   // Check cache first
   const cacheKey = `${calendarId}-${params.startDate}-${params.endDate}-${params.userId || 'all'}`;
   const cached = this.freeSlotCache.get(cacheKey);
   
   if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
     if (__DEV__) {
       console.log('[AppointmentService] Returning cached free slots');
     }
     return cached.data;
   }
   
    const endpoint = `/api/appointments/calendars/${calendarId}/free-slots`;
   
   if (__DEV__) {
     console.log('[AppointmentService] Fetching free slots:', {
       calendarId,
       params,
     });
   }
   
   const response = await this.get<FreeSlotsResponse>(
     endpoint,
     {
       params: {
         ...params,
         enableLookBusy: params.enableLookBusy || 'false',
       },
     },
     {
       endpoint,
       method: 'GET',
       entity: 'calendar',
     }
   );
   
   // Cache the response
   this.freeSlotCache.set(cacheKey, {
     data: response,
     timestamp: Date.now(),
   });
   
   return response;
 }

 /**
  * Get free slots for a specific date
  */
 async getFreeSlotsForDate(
   calendarId: string,
   date: Date,
   timezone: string,
   userId?: string
 ): Promise<string[]> {
   // Get start and end of day in milliseconds
   const startOfDay = new Date(date);
   startOfDay.setHours(0, 0, 0, 0);
   
   const endOfDay = new Date(date);
   endOfDay.setHours(23, 59, 59, 999);
   
   const params: FreeSlotParams = {
     startDate: startOfDay.getTime().toString(),
     endDate: endOfDay.getTime().toString(),
     timezone,
     userId,
   };
   
   const response = await this.getFreeSlots(calendarId, params);
   
   // Get the date key in YYYY-MM-DD format
   const dateKey = date.toISOString().split('T')[0];
   
   return response[dateKey]?.slots || [];
 }

 /**
  * Get free slots for a date range (useful for calendar month view)
  */
 async getFreeSlotsForRange(
   calendarId: string,
   startDate: Date,
   endDate: Date,
   timezone: string,
   userId?: string
 ): Promise<FreeSlotsResponse> {
   const params: FreeSlotParams = {
     startDate: startDate.getTime().toString(),
     endDate: endDate.getTime().toString(),
     timezone,
     userId,
   };
   
   return this.getFreeSlots(calendarId, params);
 }

 /**
  * Clear free slots cache
  */
 clearFreeSlotsCache(): void {
   this.freeSlotCache.clear();
   
   if (__DEV__) {
     console.log('[AppointmentService] Free slots cache cleared');
   }
 }

 /**
  * Check if a specific time slot is available
  */
 async isSlotAvailable(
   calendarId: string,
   startTime: Date,
   duration: number, // in minutes
   timezone: string,
   userId?: string
 ): Promise<boolean> {
   const slots = await this.getFreeSlotsForDate(
     calendarId,
     startTime,
     timezone,
     userId
   );
   
   const startISO = startTime.toISOString();
   const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
   
   // Check if we have enough consecutive slots
   // This is a simplified check - you might need more complex logic
   // based on your calendar's slotInterval settings
   return slots.some(slot => {
     const slotTime = new Date(slot);
     return slotTime.getTime() === startTime.getTime();
   });
 }
 
 /**
  * Clear list cache
  */
 private async clearListCache(locationId: string): Promise<void> {
   const prefix = `@lpai_cache_GET_/api/appointments_`;
   await cacheService.clear(prefix);
 }

 /**
  * Clear details cache
  */
 private async clearDetailsCache(appointmentId: string): Promise<void> {
   const prefix = `@lpai_cache_GET_/api/appointments/${appointmentId}`;
   await cacheService.clear(prefix);
 }

 /**
  * Get calendars for location
  */
 //async getCalendars(locationId: string): Promise<Calendar[]> {
 //  const endpoint = `/api/locations/${locationId}/calendars`;
   
  // return this.get<Calendar[]>(
 //    endpoint,
 //    {
       //cache: { priority: 'high', ttl: 60 * 60 * 1000 }, // 1 hour
     //}
   //);
 //}
}

// Export singleton instance
export const appointmentService = new AppointmentService();

// Export types
export type {
 AppointmentListOptions,
 CreateAppointmentInput,
 UpdateAppointmentInput,
 RescheduleInput,
 FreeSlotParams,
 FreeSlotsResponse,
};