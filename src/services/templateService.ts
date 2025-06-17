// services/templateService.ts
// Created: 2025-06-17
import { BaseService } from './baseService';
import { Template } from '../../packages/types';

interface TemplateListOptions {
  category?: 'plumbing' | 'hvac' | 'electrical' | 'roofing' | 'general';
  isGlobal?: boolean;
  includeGlobal?: boolean;
}

interface CreateTemplateInput {
  name: string;
  description: string;
  category: string;
  preview: string;
  styling: {
    primaryColor: string;
    accentColor: string;
    fontFamily: 'system' | 'serif' | 'sans-serif';
    layout: 'standard' | 'modern' | 'classic';
  };
  companyOverrides?: {
    name?: string;
    logo?: string;
    tagline?: string;
    phone?: string;
    email?: string;
    address?: string;
    establishedYear?: string;
    warrantyYears?: string;
  };
  tabs: Array<{
    title: string;
    icon: string;
    enabled: boolean;
    order: number;
    blocks: Array<any>;
  }>;
}

interface EmailTemplate {
  _id: string;
  locationId: string;
  name: string;
  subject: string;
  html: string;
  category: 'contractSigned' | 'quoteSent' | 'invoiceSent' | 'appointmentConfirmation' | 'followUp';
  isGlobal: boolean;
  isActive: boolean;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

interface UpdateEmailTemplateInput {
  subject?: string;
  html?: string;
  isActive?: boolean;
}

class TemplateService extends BaseService {
/**
   * Save user preferences (like showGlobalTemplates)
   */
  async saveUserPreferences(
    userId: string,
    preferences: {
      showGlobalTemplates?: boolean;
      defaultTemplateId?: string;
      [key: string]: any;
    }
  ): Promise<{ success: boolean; user: any }> {
    const endpoint = `/api/users/${userId}`;
    
    const result = await this.patch<any>(
      endpoint,
      { preferences },
      {
        offline: true,
        showError: false, // Don't show errors for preference saves
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'quote',
        priority: 'low',
      }
    );
    
    return result;
  }

  /**
   * Get quote templates for location
   */
  async getQuoteTemplates(
    locationId: string,
    options: TemplateListOptions = {}
  ): Promise<{
    locationTemplates: Template[];
    globalTemplates: Template[];
  }> {
    const endpoint = `/api/templates/${locationId}`;
    
    const response = await this.get<{
      locationTemplates: Template[];
      globalTemplates: Template[];
    }>(
      endpoint,
      {
        cache: { priority: 'high', ttl: 60 * 60 * 1000 }, // 1 hour
      },
      {
        endpoint,
        method: 'GET',
        entity: 'quote',
      }
    );

    // Filter by category if requested
    if (options.category) {
      return {
        locationTemplates: response.locationTemplates.filter(t => t.category === options.category),
        globalTemplates: response.globalTemplates.filter(t => t.category === options.category),
      };
    }

    return response;
  }

  /**
   * Get global templates only
   */
  async getGlobalTemplates(): Promise<Template[]> {
    const endpoint = '/api/templates/global';
    
    return this.get<Template[]>(
      endpoint,
      {
        cache: { priority: 'high', ttl: 2 * 60 * 60 * 1000 }, // 2 hours
      },
      {
        endpoint,
        method: 'GET',
        entity: 'quote',
      }
    );
  }

  /**
   * Get template details
   */
  async getTemplateDetails(
    locationId: string,
    templateId: string
  ): Promise<Template> {
    const endpoint = `/api/templates/${locationId}/${templateId}`;
    
    return this.get<Template>(
      endpoint,
      {
        cache: { priority: 'high', ttl: 30 * 60 * 1000 }, // 30 min
      },
      {
        endpoint,
        method: 'GET',
        entity: 'quote',
      }
    );
  }

  /**
   * Create custom template
   */
  async createTemplate(
    locationId: string,
    data: CreateTemplateInput
  ): Promise<Template> {
    const endpoint = `/api/templates/${locationId}`;
    
    const response = await this.post<Template>(
      endpoint,
      data,
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'quote',
        priority: 'medium',
      }
    );

    // Clear template cache
    await this.clearCache(`@lpai_cache_GET_/api/templates/${locationId}`);
    
    return response;
  }

  /**
   * Update template
   */
  async updateTemplate(
    locationId: string,
    templateId: string,
    updates: Partial<CreateTemplateInput>
  ): Promise<Template> {
    const endpoint = `/api/templates/${locationId}/${templateId}`;
    
    const response = await this.patch<Template>(
      endpoint,
      updates,
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'quote',
        priority: 'medium',
      }
    );

    // Clear caches
    await this.clearCache(`@lpai_cache_GET_/api/templates/${locationId}/${templateId}`);
    await this.clearCache(`@lpai_cache_GET_/api/templates/${locationId}`);
    
    return response;
  }

  /**
   * Delete template
   */
  async deleteTemplate(
    locationId: string,
    templateId: string
  ): Promise<{ success: boolean }> {
    const endpoint = `/api/templates/${locationId}/${templateId}`;
    
    const response = await this.delete<any>(
      endpoint,
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'DELETE',
        entity: 'quote',
        priority: 'medium',
      }
    );

    // Clear caches
    await this.clearCache(`@lpai_cache_GET_/api/templates/${locationId}`);
    
    return response;
  }

  /**
   * Copy global template to location
   */
  async copyGlobalTemplate(
    locationId: string,
    globalTemplateId: string,
    customizations?: Partial<CreateTemplateInput>
  ): Promise<Template> {
    const endpoint = `/api/templates/${locationId}/copy/${globalTemplateId}`;
    
    const response = await this.post<Template>(
      endpoint,
      { customizations },
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'quote',
        priority: 'medium',
      }
    );

    // Clear template cache
    await this.clearCache(`@lpai_cache_GET_/api/templates/${locationId}`);
    
    return response;
  }

  /**
   * Get email templates
   */
  async getEmailTemplates(
    locationId: string
  ): Promise<EmailTemplate[]> {
    // This endpoint doesn't exist yet in your backend
    // Would need to be implemented
    const endpoint = `/api/email-templates/${locationId}`;
    
    try {
      return await this.get<EmailTemplate[]>(
        endpoint,
        {
          cache: { priority: 'high', ttl: 60 * 60 * 1000 },
        },
        {
          endpoint,
          method: 'GET',
          entity: 'quote',
        }
      );
    } catch (error) {
      // Return empty array if not implemented
      return [];
    }
  }

  /**
   * Update email template
   */
  async updateEmailTemplate(
    locationId: string,
    templateId: string,
    updates: UpdateEmailTemplateInput
  ): Promise<EmailTemplate> {
    const endpoint = `/api/email-templates/${locationId}/${templateId}`;
    
    const response = await this.patch<EmailTemplate>(
      endpoint,
      updates,
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'quote',
        priority: 'medium',
      }
    );

    // Clear cache
    await this.clearCache(`@lpai_cache_GET_/api/email-templates/${locationId}`);
    
    return response;
  }

  /**
   * Preview template with data
   */
  async previewTemplate(
    template: Template,
    data: {
      quote?: any;
      project?: any;
      contact?: any;
      company?: any;
    }
  ): Promise<string> {
    // This would render the template with the provided data
    // For now, return a placeholder
    return `Preview of ${template.name} with provided data`;
  }

  /**
   * Get template variables
   */
  getTemplateVariables(category: string): string[] {
    const variables: Record<string, string[]> = {
      contractSigned: [
        'companyName',
        'companyPhone',
        'companyEmail',
        'companyAddress',
        'customerName',
        'firstName',
        'lastName',
        'quoteNumber',
        'projectTitle',
        'totalAmount',
        'signedDate',
      ],
      quoteSent: [
        'companyName',
        'customerName',
        'firstName',
        'quoteNumber',
        'projectTitle',
        'totalAmount',
        'validUntil',
        'quoteLink',
      ],
      invoiceSent: [
        'companyName',
        'customerName',
        'invoiceNumber',
        'amount',
        'dueDate',
        'paymentLink',
      ],
      appointmentConfirmation: [
        'companyName',
        'customerName',
        'appointmentDate',
        'appointmentTime',
        'technicianName',
        'serviceType',
        'address',
      ],
      followUp: [
        'companyName',
        'customerName',
        'firstName',
        'projectTitle',
        'lastContactDate',
      ],
    };

    return variables[category] || [];
  }

  /**
   * Validate template HTML
   */
  validateTemplateHTML(html: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for unclosed tags
    const openTags = html.match(/<[^/][^>]*>/g) || [];
    const closeTags = html.match(/<\/[^>]+>/g) || [];
    
    if (openTags.length !== closeTags.length) {
      errors.push('Unclosed HTML tags detected');
    }

    // Check for required variables
    const variables = html.match(/\{[^}]+\}/g) || [];
    const invalidVars = variables.filter(v => !v.match(/^\{[a-zA-Z_][a-zA-Z0-9_]*\}$/));
    
    if (invalidVars.length > 0) {
      errors.push(`Invalid variables: ${invalidVars.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get frequently used templates
   */
  async getFrequentTemplates(
    locationId: string,
    limit: number = 5
  ): Promise<Template[]> {
    // This would track usage and return most used
    // For now, return first few templates
    const { locationTemplates } = await this.getQuoteTemplates(locationId);
    return locationTemplates.slice(0, limit);
  }

  /**
   * Search templates
   */
  async searchTemplates(
    locationId: string,
    query: string
  ): Promise<Template[]> {
    const { locationTemplates, globalTemplates } = await this.getQuoteTemplates(locationId);
    const allTemplates = [...locationTemplates, ...globalTemplates];
    
    const searchLower = query.toLowerCase();
    
    return allTemplates.filter(template =>
      template.name.toLowerCase().includes(searchLower) ||
      template.description.toLowerCase().includes(searchLower) ||
      template.category.toLowerCase().includes(searchLower)
    );
  }

  /**
   * Clone template
   */
  async cloneTemplate(
    locationId: string,
    templateId: string,
    newName: string
  ): Promise<Template> {
    const original = await this.getTemplateDetails(locationId, templateId);
    
    const cloneData: CreateTemplateInput = {
      ...original,
      name: newName,
      description: `${original.description} (Copy)`,
    };

    return this.createTemplate(locationId, cloneData);
  }
}

export const templateService = new TemplateService();