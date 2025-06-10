// services/paymentService.ts
import { BaseService } from './baseService';
import { Payment, Quote, Project, Invoice } from '../../packages/types';

interface PaymentListOptions {
  projectId?: string;
  quoteId?: string;
  status?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

interface CreatePaymentLinkInput {
  projectId: string;
  quoteId?: string;
  contactId: string;
  locationId: string;
  amount: number;
  description: string;
  type: 'deposit' | 'progress' | 'final';
  userId: string;
}

interface RecordManualPaymentInput {
  invoiceId: string;
  locationId: string;
  amount: number;
  mode: 'cash' | 'cheque';
  checkNumber?: string;
  notes?: string;
  userId: string;
}

interface PaymentProofInput {
  paymentId: string;
  photo: string; // base64 image
  locationId: string;
}

interface PaymentUpdateInput {
  status?: string;
  completedAt?: string;
  failureReason?: string;
  ghlTransactionId?: string;
}

class PaymentService extends BaseService {
  /**
   * List payments with filters
   */
  async list(
    locationId: string,
    options: PaymentListOptions = {}
  ): Promise<Payment[]> {
    // Note: Backend doesn't have a list endpoint yet
    // This would need to be implemented in backend
    // For now, return empty array or throw
    throw new Error('Payment list endpoint not implemented in backend');
  }

  /**
   * Get payment details
   */
  async getDetails(
    paymentId: string,
    locationId: string
  ): Promise<Payment> {
    const endpoint = `/api/payments/${paymentId}?locationId=${locationId}`;
    
    return this.get<Payment>(
      endpoint,
      {
        cache: { priority: 'high' },
      },
      {
        endpoint,
        method: 'GET',
        entity: 'payment',
      }
    );
  }

  /**
   * Create payment link (creates invoice in GHL)
   */
  async createPaymentLink(
    data: CreatePaymentLinkInput
  ): Promise<{
    success: boolean;
    paymentId: string;
    paymentUrl: string;
    ghlInvoiceId: string;
    amount: number;
    invoiceNumber: string;
    message: string;
    existing?: boolean;
  }> {
    const endpoint = '/api/payments/create-link';
    
    const result = await this.post<any>(
      endpoint,
      data,
      {
        offline: false, // Payment links need to be online
      },
      {
        endpoint,
        method: 'POST',
        entity: 'payment',
        priority: 'high',
      }
    );
    
    // Clear related caches
    if (data.quoteId) {
      await this.clearCache(`@lpai_cache_GET_/api/quotes/${data.quoteId}`);
    }
    if (data.projectId) {
      await this.clearCache(`@lpai_cache_GET_/api/projects/${data.projectId}`);
    }
    
    return result;
  }

  /**
   * Record manual payment (cash/check)
   */
  async recordManualPayment(
    data: RecordManualPaymentInput
  ): Promise<{
    success: boolean;
    message: string;
    paymentId: string;
  }> {
    const endpoint = '/api/payments/record-manual';
    
    const result = await this.post<any>(
      endpoint,
      data,
      {
        offline: true, // Can queue manual payments
      },
      {
        endpoint,
        method: 'POST',
        entity: 'payment',
        priority: 'high',
      }
    );
    
    return result;
  }

  /**
   * Upload payment proof photo
   */
  async uploadProof(
    data: PaymentProofInput
  ): Promise<{
    success: boolean;
    photoId: string;
    message: string;
  }> {
    const endpoint = '/api/payments/upload-proof';
    
    const result = await this.post<any>(
      endpoint,
      data,
      {
        offline: false, // Photos need to upload
      },
      {
        endpoint,
        method: 'POST',
        entity: 'payment',
        priority: 'medium',
      }
    );
    
    // Update payment cache
    await this.clearCache(`@lpai_cache_GET_/api/payments/${data.paymentId}`);
    
    return result;
  }

  /**
   * Update payment status
   */
  async updateStatus(
    paymentId: string,
    locationId: string,
    data: PaymentUpdateInput
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const endpoint = `/api/payments/${paymentId}`;
    
    const result = await this.patch<any>(
      endpoint,
      {
        locationId,
        ...data,
      },
      {
        offline: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'payment',
        priority: 'high',
      }
    );
    
    // Clear payment cache
    await this.clearCache(`@lpai_cache_GET_/api/payments/${paymentId}`);
    
    return result;
  }

  /**
   * Get payment proof photo URL
   */
  getProofPhotoUrl(
    paymentId: string,
    photoId: string
  ): string {
    return `${this.apiBaseUrl}/api/payments/${paymentId}/proof/${photoId}`;
  }

  /**
   * Check payment status from GHL
   */
  async checkStatus(
    paymentId: string,
    locationId: string
  ): Promise<{
    status: string;
    amount: number;
    paidAt?: string;
  }> {
    // This would check GHL invoice status
    // Implementation depends on your backend
    const payment = await this.getDetails(paymentId, locationId);
    
    return {
      status: payment.status,
      amount: payment.amount,
      paidAt: payment.completedAt,
    };
  }

  /**
   * Get payments for a quote
   */
  async getByQuote(
    quoteId: string,
    locationId: string
  ): Promise<Payment[]> {
    // Since there's no list endpoint, we'd need to implement this
    // For now, throw error
    throw new Error('Payment list by quote not implemented');
  }

  /**
   * Get payments for a project
   */
  async getByProject(
    projectId: string,
    locationId: string
  ): Promise<Payment[]> {
    // Since there's no list endpoint, we'd need to implement this
    // For now, throw error
    throw new Error('Payment list by project not implemented');
  }

  /**
   * Calculate payment summary for a quote
   */
  calculateQuotePaymentSummary(
    quote: Quote,
    payments: Payment[]
  ): {
    totalRequired: number;
    depositRequired: number;
    depositPaid: number;
    totalPaid: number;
    balance: number;
    isDepositPaid: boolean;
    isFullyPaid: boolean;
  } {
    const totalRequired = quote.total || 0;
    const depositRequired = quote.depositAmount || 0;
    
    // Calculate paid amounts
    let depositPaid = 0;
    let totalPaid = 0;
    
    payments.forEach(payment => {
      if (payment.status === 'completed') {
        totalPaid += payment.amount;
        
        if (payment.type === 'deposit') {
          depositPaid += payment.amount;
        }
      }
    });
    
    const balance = totalRequired - totalPaid;
    
    return {
      totalRequired,
      depositRequired,
      depositPaid,
      totalPaid,
      balance,
      isDepositPaid: depositPaid >= depositRequired,
      isFullyPaid: balance <= 0,
    };
  }

  /**
   * Process payment webhook (from GHL)
   */
  async processWebhook(
    webhookData: any
  ): Promise<void> {
    // This would be called by your webhook handler
    // Update payment status based on webhook data
    const { invoiceId, status, amount } = webhookData;
    
    // Find payment by GHL invoice ID
    // Update status in your database
    // This is typically handled server-side
  }

  /**
   * Refund payment (if supported)
   */
  async refund(
    paymentId: string,
    locationId: string,
    amount?: number,
    reason?: string
  ): Promise<{
    success: boolean;
    refundId?: string;
    message: string;
  }> {
    // This would create a refund in GHL
    // Not all payment methods support refunds
    throw new Error('Refund functionality not implemented');
  }

  /**
   * Get payment statistics
   */
  async getStats(
    locationId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    totalCollected: number;
    pendingAmount: number;
    byType: Record<string, number>;
    byMethod: Record<string, number>;
    averagePayment: number;
  }> {
    // This would need backend implementation
    // For now, return mock data
    return {
      totalCollected: 0,
      pendingAmount: 0,
      byType: {},
      byMethod: {},
      averagePayment: 0,
    };
  }

  /**
   * Send payment reminder
   */
  async sendReminder(
    paymentId: string,
    locationId: string,
    contactId: string,
    message?: string
  ): Promise<{
    success: boolean;
    messageSent: boolean;
  }> {
    // This could use SMS or email service
    // Implement based on your communication preferences
    const endpoint = '/api/sms/send';
    
    return this.post(
      endpoint,
      {
        contactId,
        locationId,
        templateKey: 'payment-reminder',
        dynamicData: {
          paymentId,
          customMessage: message,
        },
      },
      {
        offline: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'payment',
      }
    );
  }
}

export const paymentService = new PaymentService();