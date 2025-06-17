// services/quoteService.ts
// Updated: 2025-06-16
import { BaseService } from './baseService';
import { Quote, QuoteSection, QuoteLineItem, Payment, Project, Contact } from '../../packages/types';

interface QuoteListOptions {
  status?: string;
  projectId?: string;
  contactId?: string;
  limit?: number;
  offset?: number;
}

interface CreateQuoteInput {
  projectId: string;
  contactId: string;
  locationId: string;
  userId: string;
  title: string;
  description?: string;
  sections: QuoteSection[];
  taxRate?: number;
  discountAmount?: number;
  discountPercentage?: number;
  depositType?: 'percentage' | 'fixed';
  depositValue?: number;
  termsAndConditions?: string;
  paymentTerms?: string;
  notes?: string;
  validUntil?: string;
}

interface UpdateQuoteInput {
  title?: string;
  description?: string;
  sections?: QuoteSection[];
  taxRate?: number;
  discountAmount?: number;
  discountPercentage?: number;
  depositType?: string;
  depositValue?: number;
  depositAmount?: number;
  termsAndConditions?: string;
  paymentTerms?: string;
  notes?: string;
  status?: string;
}

interface SignatureInput {
  signatureType: 'consultant' | 'customer';
  signature: string; // base64 image
  signedBy: string;
  deviceInfo?: string;
}

interface PublishOptions {
  notifyCustomer?: boolean;
}

interface RevisionInput {
  revisionData: Partial<CreateQuoteInput>;
  notifyCustomer?: boolean;
}

class QuoteService extends BaseService {
  protected serviceName = 'quotes';
  /**
   * List quotes with filters
   */
async list(
  locationId: string,
  options: QuoteListOptions = {}
): Promise<Quote[]> {
  const params: any = { locationId };
  
  if (options.status) params.status = options.status;
  if (options.projectId) params.projectId = options.projectId;
  if (options.contactId) params.contactId = options.contactId;
  if (options.limit) params.limit = options.limit;
  if (options.offset) params.offset = options.offset;
  
  const endpoint = '/api/quotes';
  
  if (__DEV__) {
    console.log('[QuoteService] Fetching quotes with params:', params);
  }
  
  try {
    const response = await this.get<Quote[]>(
      endpoint,
      {
        params, // Pass params correctly
        cache: { priority: 'high', ttl: 10 * 60 * 1000 },
      },
      {
        endpoint,
        method: 'GET',
        entity: 'quote',
      }
    );
    
    if (__DEV__) {
      console.log('[QuoteService] Response:', response);
    }
    
    // Handle different response formats
    return Array.isArray(response) ? response : response?.data || [];
  } catch (error) {
    console.error('[QuoteService] Failed to fetch quotes:', error);
    throw error;
  }
}

  /**
   * Get quote details
   */
  async getDetails(
    quoteId: string,
    locationId: string
  ): Promise<Quote> {
    const endpoint = `/api/quotes/${quoteId}?locationId=${locationId}`;
    
    return this.get<Quote>(
      endpoint,
      {
        cache: { priority: 'high' },
      },
      {
        endpoint,
        method: 'GET',
        entity: 'quote',
      }
    );
  }

  /**
   * Create new quote
   */
  async create(
    data: CreateQuoteInput
  ): Promise<Quote> {
    const endpoint = '/api/quotes';
    
    // Calculate totals before sending
    const processedData = this.calculateQuoteTotals(data);
    
    const newQuote = await this.post<Quote>(
      endpoint,
      processedData,
      {
        offline: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'quote',
        priority: 'high',
      }
    );
    
    // Clear list cache
    await this.clearCache(`@lpai_cache_GET_/api/quotes`);
    
    return newQuote;
  }

  /**
   * Update quote
   */
  async update(
    quoteId: string,
    locationId: string,
    data: UpdateQuoteInput
  ): Promise<Quote> {
    const endpoint = `/api/quotes/${quoteId}`;
    
    // If sections are being updated, recalculate totals
    let updateData = data;
    if (data.sections) {
      updateData = this.calculateQuoteTotals(data as any);
    }
    
    const updated = await this.patch<Quote>(
      endpoint,
      {
        ...updateData,
        locationId,
        action: 'update_content',
      },
      {
        offline: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'quote',
        priority: 'high',
      }
    );
    
    // Update cache
    const cacheKey = `@lpai_cache_GET_/api/quotes/${quoteId}`;
    await this.cacheService.set(cacheKey, updated, { priority: 'high' });
    
    return updated;
  }

  /**
   * Publish quote (make it available to customer)
   */
  async publish(
    quoteId: string,
    locationId: string,
    userId: string,
    options: PublishOptions = {}
  ): Promise<{
    success: boolean;
    quote: Quote;
    webLink: {
      token: string;
      url: string;
      expiresAt: string;
    };
  }> {
    const endpoint = `/api/quotes/${quoteId}/publish`;
    
    const result = await this.patch<any>(
      endpoint,
      {
        locationId,
        userId,
        ...options,
      },
      {
        offline: false, // Must be online to publish
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'quote',
        priority: 'high',
      }
    );
    
    // Clear caches
    await this.clearCache(`@lpai_cache_GET_/api/quotes/${quoteId}`);
    await this.clearCache(`@lpai_cache_GET_/api/quotes`);
    
    return result;
  }

  /**
   * Add signature to quote
   */
  async addSignature(
    quoteId: string,
    locationId: string,
    signature: SignatureInput
  ): Promise<{
    success: boolean;
    signatureType: string;
    fullySignedCompleted: boolean;
    quote: Partial<Quote>;
  }> {
    const endpoint = `/api/quotes/${quoteId}/sign`;
    
    const result = await this.post<any>(
      endpoint,
      {
        locationId,
        ...signature,
      },
      {
        offline: false, // Signatures need to be online
      },
      {
        endpoint,
        method: 'POST',
        entity: 'quote',
        priority: 'high',
      }
    );
    
    // Clear quote cache
    await this.clearCache(`@lpai_cache_GET_/api/quotes/${quoteId}`);
    
    return result;
  }

  /**
   * Generate PDF for signed quote
   */
  async generatePDF(
    quoteId: string,
    locationId: string
  ): Promise<{
    success: boolean;
    pdf: {
      fileId: string;
      filename: string;
      url: string;
      size: number;
    };
  }> {
    const endpoint = `/api/quotes/${quoteId}/pdf`;
    
    const result = await this.post<any>(
      endpoint,
      { locationId },
      {
        offline: false, // PDF generation needs server
      },
      {
        endpoint,
        method: 'POST',
        entity: 'quote',
        priority: 'medium',
      }
    );
    
    return result;
  }

  /**
   * Get PDF URL
   */
  getPDFUrl(
    quoteId: string,
    locationId: string,
    fileId: string
  ): string {
    return `${this.apiBaseUrl}/api/quotes/${quoteId}/pdf?locationId=${locationId}&fileId=${fileId}`;
  }

  /**
   * Create revision of existing quote
   */
  async createRevision(
    quoteId: string,
    locationId: string,
    userId: string,
    revision: RevisionInput
  ): Promise<{
    success: boolean;
    originalQuote: Partial<Quote>;
    revisionQuote: Quote;
    revisionInfo: {
      version: number;
      isRevision: boolean;
      parentQuoteId: string;
    };
  }> {
    const endpoint = `/api/quotes/${quoteId}/create-revision`;
    
    const result = await this.post<any>(
      endpoint,
      {
        locationId,
        userId,
        ...revision,
      },
      {
        offline: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'quote',
        priority: 'high',
      }
    );
    
    // Clear caches
    await this.clearCache(`@lpai_cache_GET_/api/quotes`);
    
    return result;
  }

  /**
   * Send quote via email
   */
  async sendEmail(
    quoteId: string,
    locationId: string,
    contactId: string,
    options?: {
      templateType?: 'quote_link' | 'quote_pdf' | 'signed_pdf';
      customMessage?: string;
    }
  ): Promise<{
    success: boolean;
    emailId: string;
    sentAt: string;
  }> {
    // Implement based on your email service
    // This might use /api/emails/send or similar
    const endpoint = '/api/emails/send-quote';
    
    return this.post(
      endpoint,
      {
        quoteId,
        locationId,
        contactId,
        ...options,
      },
      {
        offline: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'quote',
      }
    );
  }

  /**
   * Get quotes by project
   */
  async getByProject(
    projectId: string,
    locationId: string
  ): Promise<Quote[]> {
    return this.list(locationId, { projectId });
  }

  /**
   * Get quotes by status
   */
  async getByStatus(
    status: string,
    locationId: string
  ): Promise<Quote[]> {
    return this.list(locationId, { status });
  }

  /**
   * Delete quote (soft delete)
   */
  async delete(
    quoteId: string,
    locationId: string,
    userId: string
  ): Promise<{ success: boolean }> {
    const endpoint = `/api/quotes/${quoteId}?locationId=${locationId}&userId=${userId}`;
    
    const result = await this.delete<any>(
      endpoint,
      {
        offline: true,
      },
      {
        endpoint,
        method: 'DELETE',
        entity: 'quote',
        priority: 'medium',
      }
    );
    
    // Clear caches
    await this.clearCache(`@lpai_cache_GET_/api/quotes/${quoteId}`);
    await this.clearCache(`@lpai_cache_GET_/api/quotes`);
    
    return result;
  }

  /**
   * Calculate quote totals
   */
  private calculateQuoteTotals(data: any): any {
    const sections = data.sections || [];
    
    // Calculate section subtotals
    const processedSections = sections.map((section: QuoteSection) => {
      const lineItems = section.lineItems || [];
      const sectionSubtotal = lineItems.reduce((sum: number, item: QuoteLineItem) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);
      
      return {
        ...section,
        subtotal: sectionSubtotal,
      };
    });
    
    // Calculate quote totals
    const subtotal = processedSections.reduce((sum: number, section: any) => 
      sum + section.subtotal, 0
    );
    
    const discountAmount = data.discountPercentage > 0
      ? subtotal * (data.discountPercentage / 100)
      : data.discountAmount || 0;
    
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * (data.taxRate || 0);
    const total = taxableAmount + taxAmount;
    
    // Calculate deposit
    let depositAmount = 0;
    if (data.depositType === 'percentage' && data.depositValue > 0) {
      depositAmount = (total * data.depositValue) / 100;
    } else if (data.depositType === 'fixed' && data.depositValue > 0) {
      depositAmount = data.depositValue;
    }
    
    return {
      ...data,
      sections: processedSections,
      subtotal,
      taxAmount,
      discountAmount,
      total,
      depositAmount,
    };
  }

  /**
   * Get quote statistics
   */
  async getStats(
    locationId: string
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalValue: number;
    averageValue: number;
    conversionRate: number;
  }> {
    const quotes = await this.list(locationId, { limit: 1000 });
    
    const stats = {
      total: quotes.length,
      byStatus: {} as Record<string, number>,
      totalValue: 0,
      averageValue: 0,
      conversionRate: 0,
    };
    
    let signedCount = 0;
    
    quotes.forEach(quote => {
      // Count by status
      stats.byStatus[quote.status] = (stats.byStatus[quote.status] || 0) + 1;
      
      // Sum values
      stats.totalValue += quote.total || 0;
      
      // Count signed
      if (quote.status === 'signed') {
        signedCount++;
      }
    });
    
    // Calculate averages
    if (quotes.length > 0) {
      stats.averageValue = stats.totalValue / quotes.length;
      stats.conversionRate = (signedCount / quotes.length) * 100;
    }
    
    return stats;
  }
}

export const quoteService = new QuoteService();