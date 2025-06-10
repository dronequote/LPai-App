// services/smsService.ts
import { BaseService } from './baseService';
import { Contact, Appointment, Project } from '../../packages/types';

interface SMSTemplate {
  key: string;
  name: string;
  message: string;
  description: string;
  variables: string[];
  category: string;
  isCustomized?: boolean;
  customizedAt?: string;
  customizedBy?: string;
}

interface SMSTemplateResponse {
  templates: Record<string, SMSTemplate>;
  canEditTemplates: boolean;
  hasLocationCustomTemplates: boolean;
  hasUserCustomTemplates: boolean;
  availableVariables: Record<string, Array<{
    key: string;
    description: string;
    example: string;
  }>>;
  categories: string[];
}

interface SendSMSInput {
  contactId: string;
  locationId: string;
  templateKey?: string;
  customMessage?: string;
  fromNumber?: string;
  toNumber?: string;
  appointmentId?: string;
  projectId?: string;
  userId: string;
  dynamicData?: Record<string, any>;
}

interface SMSResponse {
  success: boolean;
  messageId: string;
  smsRecordId: string;
  conversationId: string;
  message: string;
}

interface UpdateTemplateInput {
  templateKey: string;
  message: string;
  userId: string;
  scope: 'location' | 'user';
}

class SMSService extends BaseService {
  /**
   * Get SMS templates with customizations
   */
  async getTemplates(
    locationId: string,
    userId?: string
  ): Promise<SMSTemplateResponse> {
    const params = new URLSearchParams({ locationId });
    if (userId) params.append('userId', userId);
    
    const endpoint = `/api/sms/templates?${params}`;
    
    return this.get<SMSTemplateResponse>(
      endpoint,
      {
        cache: { priority: 'high', ttl: 30 * 60 * 1000 }, // 30 min cache
      },
      {
        endpoint,
        method: 'GET',
        entity: 'sms',
      }
    );
  }

  /**
   * Send SMS message
   */
  async send(
    data: SendSMSInput
  ): Promise<SMSResponse> {
    const endpoint = '/api/sms/send';
    
    const result = await this.post<SMSResponse>(
      endpoint,
      data,
      {
        offline: true, // Queue SMS when offline
      },
      {
        endpoint,
        method: 'POST',
        entity: 'sms',
        priority: 'high',
      }
    );
    
    return result;
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(
    appointment: Appointment,
    contact: Contact,
    locationId: string,
    userId: string,
    customMessage?: string
  ): Promise<SMSResponse> {
    return this.send({
      contactId: contact._id,
      locationId,
      templateKey: 'appointment-reminder',
      customMessage,
      appointmentId: appointment._id,
      userId,
      dynamicData: {
        appointmentTitle: appointment.title,
        appointmentTime: new Date(appointment.start).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        appointmentDate: new Date(appointment.start).toLocaleDateString(),
      },
    });
  }

  /**
   * Send "On My Way" message
   */
  async sendOnMyWay(
    contactId: string,
    locationId: string,
    userId: string,
    eta: number,
    appointmentId?: string
  ): Promise<SMSResponse> {
    return this.send({
      contactId,
      locationId,
      templateKey: 'on-way',
      appointmentId,
      userId,
      dynamicData: {
        eta: eta.toString(),
      },
    });
  }

  /**
   * Send "Running Late" message
   */
  async sendRunningLate(
    contactId: string,
    locationId: string,
    userId: string,
    lateMinutes: number,
    newArrivalTime: string,
    appointmentId?: string
  ): Promise<SMSResponse> {
    return this.send({
      contactId,
      locationId,
      templateKey: 'running-late',
      appointmentId,
      userId,
      dynamicData: {
        lateMinutes: lateMinutes.toString(),
        newTime: newArrivalTime,
      },
    });
  }

  /**
   * Send "Arrived" message
   */
  async sendArrived(
    contactId: string,
    locationId: string,
    userId: string,
    appointmentId?: string,
    appointmentTitle?: string
  ): Promise<SMSResponse> {
    return this.send({
      contactId,
      locationId,
      templateKey: 'arrived',
      appointmentId,
      userId,
      dynamicData: {
        appointmentTitle: appointmentTitle || 'your appointment',
      },
    });
  }

  /**
   * Send quote notification
   */
  async sendQuoteReady(
    contact: Contact,
    project: Project,
    quoteLink: string,
    locationId: string,
    userId: string
  ): Promise<SMSResponse> {
    return this.send({
      contactId: contact._id,
      locationId,
      templateKey: 'quote-sent',
      projectId: project._id,
      userId,
      dynamicData: {
        projectTitle: project.title,
        quoteLink,
      },
    });
  }

  /**
   * Send payment confirmation
   */
  async sendPaymentConfirmation(
    contactId: string,
    amount: number,
    locationId: string,
    userId: string,
    projectId?: string
  ): Promise<SMSResponse> {
    return this.send({
      contactId,
      locationId,
      templateKey: 'payment-received',
      projectId,
      userId,
      dynamicData: {
        amount: `$${amount.toFixed(2)}`,
      },
    });
  }

  /**
   * Send job completion message
   */
  async sendJobComplete(
    contact: Contact,
    project: Project,
    locationId: string,
    userId: string
  ): Promise<SMSResponse> {
    return this.send({
      contactId: contact._id,
      locationId,
      templateKey: 'job-complete',
      projectId: project._id,
      userId,
      dynamicData: {
        projectTitle: project.title,
      },
    });
  }

  /**
   * Send custom message (no template)
   */
  async sendCustom(
    contactId: string,
    message: string,
    locationId: string,
    userId: string,
    options?: {
      appointmentId?: string;
      projectId?: string;
      fromNumber?: string;
    }
  ): Promise<SMSResponse> {
    return this.send({
      contactId,
      locationId,
      customMessage: message,
      userId,
      ...options,
    });
  }

  /**
   * Update SMS template
   */
  async updateTemplate(
    locationId: string,
    data: UpdateTemplateInput
  ): Promise<{
    success: boolean;
    template: SMSTemplate;
  }> {
    const endpoint = '/api/sms/templates';
    
    const result = await this.put<any>(
      endpoint,
      {
        locationId,
        ...data,
      },
      {
        offline: false, // Template updates need to be online
      },
      {
        endpoint,
        method: 'PUT',
        entity: 'sms',
        priority: 'low',
      }
    );
    
    // Clear template cache
    await this.clearCache(`@lpai_cache_GET_/api/sms/templates`);
    
    return result;
  }

  /**
   * Reset template to default
   */
  async resetTemplate(
    locationId: string,
    templateKey: string,
    scope: 'location' | 'user',
    userId?: string
  ): Promise<{
    success: boolean;
    template: SMSTemplate;
  }> {
    const endpoint = '/api/sms/templates';
    
    const result = await this.post<any>(
      endpoint,
      {
        locationId,
        templateKey,
        scope,
        userId,
      },
      {
        offline: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'sms',
        priority: 'low',
      }
    );
    
    // Clear template cache
    await this.clearCache(`@lpai_cache_GET_/api/sms/templates`);
    
    return result;
  }

  /**
   * Calculate ETA and send "On My Way" message
   */
  async sendETAMessage(
    contactId: string,
    locationId: string,
    userId: string,
    origin: { lat: number; lng: number },
    destination: string | { lat: number; lng: number },
    appointmentId?: string
  ): Promise<{
    smsResponse: SMSResponse;
    eta: {
      duration: number;
      distance: number;
      trafficCondition: string;
    };
  }> {
    // First, calculate ETA
    const etaEndpoint = '/api/maps/calculate-eta';
    
    const etaResult = await this.post<any>(
      etaEndpoint,
      {
        origin,
        destination,
      },
      {
        offline: false, // Need online for maps
      },
      {
        endpoint: etaEndpoint,
        method: 'POST',
        entity: 'sms',
      }
    );
    
    if (!etaResult.success || !etaResult.duration) {
      throw new Error('Unable to calculate ETA');
    }
    
    // Send SMS with ETA
    const smsResponse = await this.sendOnMyWay(
      contactId,
      locationId,
      userId,
      etaResult.duration,
      appointmentId
    );
    
    return {
      smsResponse,
      eta: {
        duration: etaResult.duration,
        distance: etaResult.distance,
        trafficCondition: etaResult.trafficCondition,
      },
    };
  }

  /**
   * Get SMS conversation history
   */
  async getConversationHistory(
    contactId: string,
    locationId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    messages: Array<{
      id: string;
      message: string;
      direction: 'inbound' | 'outbound';
      timestamp: string;
      status: string;
    }>;
    hasMore: boolean;
  }> {
    // This would need a backend endpoint to fetch SMS history
    // For now, using conversation endpoint
    const endpoint = `/api/conversations?locationId=${locationId}&contactId=${contactId}&type=sms`;
    
    const conversations = await this.get<any[]>(
      endpoint,
      {
        cache: { priority: 'medium', ttl: 5 * 60 * 1000 },
      },
      {
        endpoint,
        method: 'GET',
        entity: 'sms',
      }
    );
    
    // Transform to messages format
    return {
      messages: conversations.map(conv => ({
        id: conv._id,
        message: conv.lastMessageBody,
        direction: conv.lastMessageDirection as 'inbound' | 'outbound',
        timestamp: conv.lastMessageDate,
        status: 'sent',
      })),
      hasMore: false,
    };
  }

  /**
   * Get SMS statistics
   */
  async getStats(
    locationId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    totalSent: number;
    totalFailed: number;
    byTemplate: Record<string, number>;
    averageResponseTime?: number;
  }> {
    // This would need backend implementation
    // For now, return mock data
    return {
      totalSent: 0,
      totalFailed: 0,
      byTemplate: {},
      averageResponseTime: undefined,
    };
  }
}

export const smsService = new SMSService();