// services/appointmentService.ts
import { BaseService } from './baseService';
import { Appointment, Contact, Project, Calendar } from '../../packages/types';

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

class AppointmentService extends BaseService {
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
        cache: { 
          priority: 'high', 
          ttl: 5 * 60 * 1000 // 5 min - appointments change frequently
        },
        locationId,
      },
      {
        endpoint,
        method: 'GET',
        entity: 'appointment',
      }
    );
  }

  /**
   * Get single appointment details
   */
  async getDetails(
    appointmentId: string,
    options?: { source?: 'local' | 'ghl' }
  ): Promise<Appointment> {
    const params = options?.source ? `?source=${options.source}` : '';
    const endpoint = `/api/appointments/${appointmentId}${params}`;
    
    return this.get<Appointment>(
      endpoint,
      {
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
   * Create appointment - Creates in MongoDB & GHL
   */
  async create(
    data: CreateAppointmentInput
  ): Promise<Appointment> {
    const endpoint = '/api/appointments';
    
    // Prepare appointment data
    const appointmentData = {
      ...data,
      time: data.start, // Legacy field some endpoints expect
      duration: data.duration || 60, // Default 60 minutes
    };
    
    const newAppointment = await this.post<any>(
      endpoint,
      appointmentData,
      {
        offline: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'appointment',
        priority: 'high',
      }
    );
    
    // Clear cache for the day
    const date = new Date(data.start).toISOString().split('T')[0];
    await this.clearCache(`@lpai_cache_GET_/api/appointments_.*${date}`);
    
    return newAppointment.appointment || newAppointment;
  }

  /**
   * Update appointment - Updates MongoDB & GHL
   */
  async update(
    appointmentId: string,
    data: UpdateAppointmentInput
  ): Promise<Appointment> {
    const endpoint = `/api/appointments/${appointmentId}`;
    
    const updated = await this.patch<Appointment>(
      endpoint,
      data,
      {
        offline: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'appointment',
        priority: 'high',
      }
    );
    
    // Update cache
    const cacheKey = `@lpai_cache_GET_/api/appointments/${appointmentId}`;
    await this.cacheService.set(cacheKey, updated, { priority: 'high' });
    
    return updated;
  }

  /**
   * Cancel appointment
   */
  async cancel(
    appointmentId: string,
    reason?: string
  ): Promise<void> {
    await this.update(appointmentId, {
      status: 'cancelled',
      notes: reason ? `Cancelled: ${reason}` : undefined,
    });
    
    // Clear related caches
    await this.clearCache(`@lpai_cache_GET_/api/appointments/${appointmentId}`);
  }

  /**
   * Reschedule appointment
   */
  async reschedule(
    appointmentId: string,
    data: RescheduleInput
  ): Promise<Appointment> {
    return this.update(appointmentId, {
      start: data.start,
      end: data.end,
      status: 'rescheduled',
      notes: data.reason ? `Rescheduled: ${data.reason}` : undefined,
    });
  }

  /**
   * Mark appointment as completed
   */
  async complete(
    appointmentId: string,
    notes?: string
  ): Promise<Appointment> {
    return this.update(appointmentId, {
      status: 'completed',
      notes: notes || 'Appointment completed',
    });
  }

  /**
   * Mark as no-show
   */
  async markNoShow(
    appointmentId: string
  ): Promise<Appointment> {
    return this.update(appointmentId, {
      status: 'no_show',
      notes: 'Customer did not show up',
    });
  }

  /**
   * Get appointments by date range
   */
  async getByDateRange(
    locationId: string,
    start: Date | string,
    end: Date | string,
    options?: { userId?: string; calendarId?: string }
  ): Promise<Appointment[]> {
    return this.list(locationId, {
      start,
      end,
      userId: options?.userId,
      calendarId: options?.calendarId,
    });
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
    
    return this.getByDateRange(
      locationId,
      today.toISOString(),
      tomorrow.toISOString(),
      { userId }
    );
  }

  /**
   * Get appointments for a contact
   */
  async getByContact(
    contactId: string,
    locationId: string,
    options?: { upcoming?: boolean }
  ): Promise<Appointment[]> {
    const allAppointments = await this.list(locationId, {
      limit: 100, // Get more appointments
    });
    
    // Filter by contact
    let filtered = allAppointments.filter(apt => apt.contactId === contactId);
    
    // If upcoming only, filter future appointments
    if (options?.upcoming) {
      const now = new Date();
      filtered = filtered.filter(apt => new Date(apt.start) > now);
    }
    
    // Sort by date
    filtered.sort((a, b) => 
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    
    return filtered;
  }

  /**
   * Get appointments for a project
   */
  async getByProject(
    projectId: string,
    locationId: string
  ): Promise<Appointment[]> {
    const allAppointments = await this.list(locationId, {
      limit: 100,
    });
    
    return allAppointments.filter(apt => apt.projectId === projectId);
  }

  /**
   * Sync appointments from GHL
   */
  async syncFromGHL(
    locationId: string,
    options?: { 
      startDate?: string; 
      endDate?: string; 
      fullSync?: boolean 
    }
  ): Promise<{ synced: number; errors: number }> {
    const endpoint = '/api/sync/appointments';
    
    const result = await this.post<any>(
      endpoint,
      { 
        locationId,
        ...options,
      },
      {
        showError: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'appointment',
        priority: 'low',
      }
    );
    
    // Clear appointment caches after sync
    await this.clearCache('@lpai_cache_GET_/api/appointments');
    
    return {
      synced: (result.created || 0) + (result.updated || 0),
      errors: result.errors || 0,
    };
  }

  /**
   * Get appointment statistics
   */
  async getStats(
    locationId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    upcoming: number;
  }> {
    const appointments = await this.list(locationId, dateRange);
    const now = new Date();
    
    return {
      total: appointments.length,
      completed: appointments.filter(a => a.status === 'completed').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length,
      noShow: appointments.filter(a => a.status === 'no_show').length,
      upcoming: appointments.filter(a => new Date(a.start) > now).length,
    };
  }

  /**
   * Check for appointment conflicts
   */
  async checkConflicts(
    locationId: string,
    userId: string,
    start: string,
    end: string,
    excludeAppointmentId?: string
  ): Promise<Appointment[]> {
    const appointments = await this.list(locationId, {
      userId,
      start: new Date(new Date(start).getTime() - 24 * 60 * 60 * 1000).toISOString(), // Day before
      end: new Date(new Date(end).getTime() + 24 * 60 * 60 * 1000).toISOString(), // Day after
    });
    
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    
    return appointments.filter(apt => {
      if (excludeAppointmentId && apt._id === excludeAppointmentId) return false;
      if (apt.status === 'cancelled') return false;
      
      const aptStart = new Date(apt.start).getTime();
      const aptEnd = new Date(apt.end).getTime();
      
      // Check for overlap
      return (startTime < aptEnd && endTime > aptStart);
    });
  }
}

export const appointmentService = new AppointmentService();