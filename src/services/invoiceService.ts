// services/invoiceService.ts
import { BaseService } from './baseService';
import { Invoice } from '../../packages/types';

interface CreateInvoiceInput {
  projectId: string;
  locationId: string;
  contactId: string;
  title: string;
  amount: number;
  type: 'deposit' | 'progress' | 'final';
  amountType?: 'percentage' | 'fixed';
  amountValue?: number;
  description?: string;
  dueDate?: string;
  items?: InvoiceItem[];
}

interface InvoiceItem {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
}

interface InvoiceListOptions {
  status?: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  contactId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface SendInvoiceOptions {
  email?: string[];
  sms?: string[];
  autoPayment?: boolean;
}

interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  mode: 'cash' | 'cheque' | 'card' | 'bank_transfer';
  checkNumber?: string;
  notes?: string;
  paymentDate?: string;
}

interface InvoiceStats {
  total: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  byStatus: {
    draft: number;
    sent: number;
    viewed: number;
    partial: number;
    paid: number;
    overdue: number;
    cancelled: number;
  };
}

class InvoiceService extends BaseService {
  /**
   * Get invoices list
   */
  async list(
    locationId: string,
    options: InvoiceListOptions = {}
  ): Promise<Invoice[]> {
    const params = new URLSearchParams({ locationId });
    
    if (options.status) params.append('status', options.status);
    if (options.contactId) params.append('contactId', options.contactId);
    if (options.projectId) params.append('projectId', options.projectId);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    
    const endpoint = `/api/invoices?${params}`;
    
    return this.get<Invoice[]>(
      endpoint,
      {
        cache: { priority: 'medium', ttl: 10 * 60 * 1000 }, // 10 min
      },
      {
        endpoint,
        method: 'GET',
        entity: 'payment',
      }
    );
  }

  /**
   * Get invoice details
   */
  async getDetails(
    invoiceId: string,
    locationId: string
  ): Promise<Invoice> {
    const endpoint = `/api/invoices/${invoiceId}?locationId=${locationId}`;
    
    return this.get<Invoice>(
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
   * Create invoice
   */
  async create(data: CreateInvoiceInput): Promise<Invoice> {
    const endpoint = '/api/invoices/create';
    
    const response = await this.post<Invoice>(
      endpoint,
      data,
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'payment',
        priority: 'high',
      }
    );

    // Clear list cache
    await this.clearCache('@lpai_cache_GET_/api/invoices');
    
    return response;
  }

  /**
   * Send invoice to customer
   */
  async send(
    invoiceId: string,
    locationId: string,
    options: SendInvoiceOptions = {}
  ): Promise<{ success: boolean; sentAt: string }> {
    const endpoint = `/api/invoices/${invoiceId}/send`;
    
    const response = await this.post<any>(
      endpoint,
      {
        locationId,
        ...options,
      },
      {
        offline: false, // Must be online to send
        showError: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'payment',
        priority: 'high',
      }
    );

    // Update cache
    await this.clearCache(`@lpai_cache_GET_/api/invoices/${invoiceId}`);
    
    return response;
  }

  /**
   * Record manual payment
   */
  async recordPayment(
    data: RecordPaymentInput & { locationId: string }
  ): Promise<{ success: boolean; paymentId: string }> {
    const endpoint = '/api/payments/record-manual';
    
    const response = await this.post<any>(
      endpoint,
      data,
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'payment',
        priority: 'high',
      }
    );

    // Clear invoice cache
    await this.clearCache(`@lpai_cache_GET_/api/invoices/${data.invoiceId}`);
    await this.clearCache('@lpai_cache_GET_/api/invoices');
    
    return response;
  }

  /**
   * Cancel invoice
   */
  async cancel(
    invoiceId: string,
    locationId: string,
    reason?: string
  ): Promise<{ success: boolean }> {
    const endpoint = `/api/invoices/${invoiceId}/cancel`;
    
    const response = await this.patch<any>(
      endpoint,
      {
        locationId,
        reason,
      },
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'payment',
        priority: 'medium',
      }
    );

    // Clear caches
    await this.clearCache(`@lpai_cache_GET_/api/invoices/${invoiceId}`);
    await this.clearCache('@lpai_cache_GET_/api/invoices');
    
    return response;
  }

  /**
   * Update invoice
   */
  async update(
    invoiceId: string,
    locationId: string,
    updates: Partial<CreateInvoiceInput>
  ): Promise<Invoice> {
    const endpoint = `/api/invoices/${invoiceId}`;
    
    const response = await this.patch<Invoice>(
      endpoint,
      {
        ...updates,
        locationId,
      },
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'payment',
        priority: 'medium',
      }
    );

    // Clear caches
    await this.clearCache(`@lpai_cache_GET_/api/invoices/${invoiceId}`);
    await this.clearCache('@lpai_cache_GET_/api/invoices');
    
    return response;
  }

  /**
   * Get invoice statistics
   */
  async getStats(
    locationId: string,
    dateRange?: { start: string; end: string }
  ): Promise<InvoiceStats> {
    const invoices = await this.list(locationId, {
      startDate: dateRange?.start,
      endDate: dateRange?.end,
    });

    const stats: InvoiceStats = {
      total: invoices.length,
      totalAmount: 0,
      paidAmount: 0,
      outstandingAmount: 0,
      overdueAmount: 0,
      byStatus: {
        draft: 0,
        sent: 0,
        viewed: 0,
        partial: 0,
        paid: 0,
        overdue: 0,
        cancelled: 0,
      },
    };

    const now = new Date();

    invoices.forEach(invoice => {
      stats.totalAmount += invoice.total || 0;
      stats.paidAmount += invoice.amountPaid || 0;
      
      const outstanding = (invoice.total || 0) - (invoice.amountPaid || 0);
      stats.outstandingAmount += outstanding;

      // Check if overdue
      if (invoice.dueDate && new Date(invoice.dueDate) < now && outstanding > 0) {
        stats.overdueAmount += outstanding;
        stats.byStatus.overdue++;
      } else if (invoice.status) {
        stats.byStatus[invoice.status as keyof typeof stats.byStatus]++;
      }
    });

    return stats;
  }

  /**
   * Get invoices by project
   */
  async getByProject(
    projectId: string,
    locationId: string
  ): Promise<Invoice[]> {
    return this.list(locationId, { projectId });
  }

  /**
   * Get invoices by contact
   */
  async getByContact(
    contactId: string,
    locationId: string
  ): Promise<Invoice[]> {
    return this.list(locationId, { contactId });
  }

  /**
   * Get overdue invoices
   */
  async getOverdue(
    locationId: string
  ): Promise<Invoice[]> {
    const invoices = await this.list(locationId);
    const now = new Date();
    
    return invoices.filter(invoice => {
      if (!invoice.dueDate || invoice.status === 'paid' || invoice.status === 'cancelled') {
        return false;
      }
      
      const dueDate = new Date(invoice.dueDate);
      const outstanding = (invoice.total || 0) - (invoice.amountPaid || 0);
      
      return dueDate < now && outstanding > 0;
    });
  }

  /**
   * Calculate invoice totals
   */
  calculateTotals(items: InvoiceItem[]): {
    subtotal: number;
    tax: number;
    total: number;
  } {
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);

    // Tax would be calculated based on location settings
    const taxRate = 0; // Would come from location settings
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    return { subtotal, tax, total };
  }

  /**
   * Generate invoice number
   */
  async generateInvoiceNumber(
    locationId: string,
    type: 'deposit' | 'progress' | 'final' = 'final'
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = type === 'deposit' ? 'DEP' : 'INV';
    
    // Get count of invoices this year
    const invoices = await this.list(locationId, {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });
    
    const count = invoices.filter(inv => 
      inv.invoiceNumber?.startsWith(prefix)
    ).length + 1;
    
    return `${prefix}-${year}-${count.toString().padStart(3, '0')}`;
  }

  /**
   * Export invoices to CSV
   */
  async exportToCSV(
    invoices: Invoice[]
  ): Promise<string> {
    const headers = [
      'Invoice Number',
      'Date',
      'Due Date',
      'Customer',
      'Total',
      'Paid',
      'Balance',
      'Status',
    ];

    const rows = invoices.map(invoice => [
      invoice.invoiceNumber || '',
      invoice.issueDate || '',
      invoice.dueDate || '',
      invoice.contactDetails?.name || '',
      invoice.total?.toFixed(2) || '0.00',
      invoice.amountPaid?.toFixed(2) || '0.00',
      ((invoice.total || 0) - (invoice.amountPaid || 0)).toFixed(2),
      invoice.status || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }

  /**
   * Check if invoice can be edited
   */
  canEdit(invoice: Invoice): boolean {
    return invoice.status === 'draft' || !invoice.status;
  }

  /**
   * Check if invoice can be cancelled
   */
  canCancel(invoice: Invoice): boolean {
    return invoice.status !== 'paid' && invoice.status !== 'cancelled';
  }

  /**
   * Sync invoices from GHL
   */
  async syncFromGHL(
    locationId: string,
    options?: { limit?: number }
  ): Promise<{ synced: number; errors: number }> {
    const endpoint = '/api/sync/invoices';
    
    const result = await this.post<any>(
      endpoint,
      {
        locationId,
        limit: options?.limit || 100,
      },
      {
        offline: false,
        showError: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'payment',
        priority: 'low',
      }
    );

    // Clear all invoice caches
    await this.clearCache('@lpai_cache_GET_/api/invoices');
    
    return {
      synced: (result.result?.created || 0) + (result.result?.updated || 0),
      errors: 0,
    };
  }
}

export const invoiceService = new InvoiceService();