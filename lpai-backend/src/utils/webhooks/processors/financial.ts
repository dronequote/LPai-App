// src/utils/webhooks/processors/financial.ts
import { BaseProcessor } from './base';
import { QueueItem } from '../queueManager';
import { ObjectId, Db } from 'mongodb';

export class FinancialProcessor extends BaseProcessor {
  constructor(db?: Db) {
    super({
      queueType: 'financial',
      batchSize: 30,
      maxRuntime: 50000,
      processorName: 'FinancialProcessor'
    }, db);
  }

  /**
   * Process financial webhooks
   */
  protected async processItem(item: QueueItem): Promise<void> {
    const { type, payload, webhookId } = item;

    // Track financial processing start
    const financialStartTime = Date.now();

    switch (type) {
      // Invoice Events
      case 'InvoiceCreate':
        await this.processInvoiceCreate(payload, webhookId);
        break;
      case 'InvoiceUpdate':
        await this.processInvoiceUpdate(payload, webhookId);
        break;
      case 'InvoiceDelete':
        await this.processInvoiceDelete(payload, webhookId);
        break;
      case 'InvoiceVoid':
        await this.processInvoiceVoid(payload, webhookId);
        break;
      case 'InvoicePaid':
        await this.processInvoicePaid(payload, webhookId);
        break;
      case 'InvoicePartiallyPaid':
        await this.processInvoicePartiallyPaid(payload, webhookId);
        break;
        
      // Order Events
      case 'OrderCreate':
        await this.processOrderCreate(payload, webhookId);
        break;
      case 'OrderStatusUpdate':
        await this.processOrderStatusUpdate(payload, webhookId);
        break;
        
      // Product/Price Events
      case 'ProductCreate':
      case 'ProductUpdate':
      case 'ProductDelete':
        await this.processProductEvent(type, payload, webhookId);
        break;
      case 'PriceCreate':
      case 'PriceUpdate':
      case 'PriceDelete':
        await this.processPriceEvent(type, payload, webhookId);
        break;
        
      default:
        console.warn(`[FinancialProcessor] Unknown financial type: ${type}`);
        throw new Error(`Unsupported financial webhook type: ${type}`);
    }

    // Track financial processing time
    const processingTime = Date.now() - financialStartTime;
    if (processingTime > 2000) {
      console.warn(`[FinancialProcessor] Slow financial processing: ${processingTime}ms for ${type}`);
    }
  }

  /**
   * Process invoice create
   */
  private async processInvoiceCreate(payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let invoiceData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      invoiceData = payload.webhookPayload;
      locationId = payload.locationId || invoiceData.locationId;
    } else {
      // Direct format
      invoiceData = payload;
      locationId = payload.locationId;
    }
    
    const { invoice } = invoiceData;
    
    if (!invoice?.id || !locationId) {
      console.error(`[FinancialProcessor] Missing required invoice data:`, {
        invoiceId: invoice?.id,
        locationId: !!locationId,
        webhookId
      });
      throw new Error('Missing required invoice data');
    }
    
    console.log(`[FinancialProcessor] Creating invoice ${invoice.id}`);
    
    // Start session for atomic operations
    const session = this.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        await this.db.collection('invoices').updateOne(
          { ghlInvoiceId: invoice.id, locationId },
          {
            $set: {
              ghlInvoiceId: invoice.id,
              locationId,
              contactId: invoice.contactId,
              invoiceNumber: invoice.invoiceNumber || invoice.number,
              status: invoice.status || 'draft',
              amount: invoice.amount || invoice.total || 0,
              amountPaid: invoice.amountPaid || 0,
              amountDue: invoice.amountDue || invoice.amount || invoice.total || 0,
              currency: invoice.currency || 'USD',
              dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
              issueDate: invoice.issueDate ? new Date(invoice.issueDate) : new Date(),
              items: invoice.items || invoice.lineItems || [],
              taxes: invoice.taxes || [],
              discounts: invoice.discounts || [],
              notes: invoice.notes || invoice.description || '',
              terms: invoice.terms || '',
              metadata: invoice.metadata || {},
              lastWebhookUpdate: new Date(),
              updatedAt: new Date(),
              processedBy: 'queue',
              webhookId
            },
            $setOnInsert: {
              _id: new ObjectId(),
              createdAt: new Date(),
              createdByWebhook: webhookId
            }
          },
          { upsert: true, session }
        );
        
        // Update related project if exists
        if (invoice.opportunityId) {
          await this.updateProjectFinancials(invoice.opportunityId, locationId, 'invoice_created', invoice, session);
        }
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Process invoice update
   */
  private async processInvoiceUpdate(payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let invoiceData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      invoiceData = payload.webhookPayload;
      locationId = payload.locationId || invoiceData.locationId;
    } else {
      // Direct format
      invoiceData = payload;
      locationId = payload.locationId;
    }
    
    const { invoice } = invoiceData;
    
    if (!invoice?.id || !locationId) {
      console.error(`[FinancialProcessor] Missing required invoice data:`, {
        invoiceId: invoice?.id,
        locationId: !!locationId,
        webhookId
      });
      throw new Error('Missing required invoice data');
    }
    
    console.log(`[FinancialProcessor] Updating invoice ${invoice.id}`);
    
    const updateData: any = {
      lastWebhookUpdate: new Date(),
      updatedAt: new Date(),
      processedBy: 'queue',
      webhookId
    };
    
    // Update fields that might change
    const fieldsToUpdate = [
      'status', 'currency', 'notes', 'terms', 'metadata'
    ];
    
    fieldsToUpdate.forEach(field => {
      if (invoice[field] !== undefined) {
        updateData[field] = invoice[field];
      }
    });
    
    // Handle amount fields
    if (invoice.amount !== undefined) updateData.amount = invoice.amount;
    if (invoice.total !== undefined && invoice.amount === undefined) updateData.amount = invoice.total;
    if (invoice.amountPaid !== undefined) updateData.amountPaid = invoice.amountPaid;
    if (invoice.amountDue !== undefined) updateData.amountDue = invoice.amountDue;
    
    // Handle array fields
    if (invoice.items !== undefined) updateData.items = invoice.items;
    if (invoice.lineItems !== undefined && invoice.items === undefined) updateData.items = invoice.lineItems;
    if (invoice.taxes !== undefined) updateData.taxes = invoice.taxes;
    if (invoice.discounts !== undefined) updateData.discounts = invoice.discounts;
    
    // Handle date fields
    if (invoice.dueDate) updateData.dueDate = new Date(invoice.dueDate);
    if (invoice.issueDate) updateData.issueDate = new Date(invoice.issueDate);
    
    const result = await this.db.collection('invoices').updateOne(
      { ghlInvoiceId: invoice.id, locationId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      console.log(`[FinancialProcessor] Invoice not found, creating new one`);
      await this.processInvoiceCreate(payload, webhookId);
    }
  }

  /**
   * Process invoice delete
   */
  private async processInvoiceDelete(payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let invoiceData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      invoiceData = payload.webhookPayload;
      locationId = payload.locationId || invoiceData.locationId;
    } else {
      // Direct format
      invoiceData = payload;
      locationId = payload.locationId;
    }
    
    const { invoice } = invoiceData;
    
    console.log(`[FinancialProcessor] Deleting invoice ${invoice?.id}`);
    
    if (!invoice?.id || !locationId) {
      console.warn(`[FinancialProcessor] Missing invoice data for delete`);
      return;
    }
    
    await this.db.collection('invoices').updateOne(
      { ghlInvoiceId: invoice.id, locationId },
      { 
        $set: { 
          deleted: true,
          deletedAt: new Date(),
          deletedByWebhook: webhookId,
          status: 'deleted',
          processedBy: 'queue'
        } 
      }
    );
  }

  /**
   * Process invoice void
   */
  private async processInvoiceVoid(payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let invoiceData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      invoiceData = payload.webhookPayload;
      locationId = payload.locationId || invoiceData.locationId;
    } else {
      // Direct format
      invoiceData = payload;
      locationId = payload.locationId;
    }
    
    const { invoice } = invoiceData;
    
    console.log(`[FinancialProcessor] Voiding invoice ${invoice?.id}`);
    
    if (!invoice?.id || !locationId) {
      console.warn(`[FinancialProcessor] Missing invoice data for void`);
      return;
    }
    
    await this.db.collection('invoices').updateOne(
      { ghlInvoiceId: invoice.id, locationId },
      { 
        $set: { 
          status: 'void',
          voidedAt: new Date(),
          voidedByWebhook: webhookId,
          lastWebhookUpdate: new Date(),
          processedBy: 'queue'
        } 
      }
    );
  }

  /**
   * Process invoice paid
   */
  private async processInvoicePaid(payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let invoiceData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      invoiceData = payload.webhookPayload;
      locationId = payload.locationId || invoiceData.locationId;
    } else {
      // Direct format
      invoiceData = payload;
      locationId = payload.locationId;
    }
    
    const { invoice } = invoiceData;
    
    console.log(`[FinancialProcessor] Marking invoice ${invoice?.id} as paid`);
    
    if (!invoice?.id || !locationId) {
      console.warn(`[FinancialProcessor] Missing invoice data for paid status`);
      return;
    }
    
    const session = this.db.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        await this.db.collection('invoices').updateOne(
          { ghlInvoiceId: invoice.id, locationId },
          { 
            $set: { 
              status: 'paid',
              paidAt: new Date(),
              amountPaid: invoice.amount || invoice.total || invoice.amountPaid,
              amountDue: 0,
              paymentDetails: invoice.paymentDetails || {},
              lastWebhookUpdate: new Date(),
              processedBy: 'queue',
              webhookId
            } 
          },
          { session }
        );
        
        // Update project financials
        if (invoice.opportunityId) {
          await this.updateProjectFinancials(invoice.opportunityId, locationId, 'invoice_paid', invoice, session);
        }
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Process invoice partially paid
   */
  private async processInvoicePartiallyPaid(payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let invoiceData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      invoiceData = payload.webhookPayload;
      locationId = payload.locationId || invoiceData.locationId;
    } else {
      // Direct format
      invoiceData = payload;
      locationId = payload.locationId;
    }
    
    const { invoice } = invoiceData;
    
    console.log(`[FinancialProcessor] Recording partial payment for invoice ${invoice?.id}`);
    
    if (!invoice?.id || !locationId) {
      console.warn(`[FinancialProcessor] Missing invoice data for partial payment`);
      return;
    }
    
    await this.db.collection('invoices').updateOne(
      { ghlInvoiceId: invoice.id, locationId },
      { 
        $set: { 
          status: 'partially_paid',
          amountPaid: invoice.amountPaid || 0,
          amountDue: invoice.amountDue || (invoice.amount - (invoice.amountPaid || 0)),
          lastPaymentDate: new Date(),
          lastWebhookUpdate: new Date(),
          processedBy: 'queue',
          webhookId
        },
        $push: {
          payments: {
            amount: invoice.lastPaymentAmount || 0,
            date: new Date(),
            method: invoice.paymentMethod || 'unknown',
            reference: invoice.paymentReference || '',
            webhookId: webhookId
          }
        }
      }
    );
  }

  /**
   * Process order create
   */
  private async processOrderCreate(payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let orderData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      orderData = payload.webhookPayload;
      locationId = payload.locationId || orderData.locationId;
    } else {
      // Direct format
      orderData = payload;
      locationId = payload.locationId;
    }
    
    const { order } = orderData;
    
    if (!order?.id || !locationId) {
      console.error(`[FinancialProcessor] Missing required order data:`, {
        orderId: order?.id,
        locationId: !!locationId,
        webhookId
      });
      throw new Error('Missing required order data');
    }
    
    console.log(`[FinancialProcessor] Creating order ${order.id}`);
    
    await this.db.collection('orders').updateOne(
      { ghlOrderId: order.id, locationId },
      {
        $set: {
          ghlOrderId: order.id,
          locationId,
          contactId: order.contactId,
          orderNumber: order.orderNumber || order.number,
          status: order.status || 'pending',
          amount: order.amount || order.total || 0,
          currency: order.currency || 'USD',
          items: order.items || order.lineItems || [],
          shippingAddress: order.shippingAddress || {},
          billingAddress: order.billingAddress || {},
          paymentStatus: order.paymentStatus || 'pending',
          fulfillmentStatus: order.fulfillmentStatus || 'unfulfilled',
          notes: order.notes || '',
          metadata: order.metadata || {},
          lastWebhookUpdate: new Date(),
          updatedAt: new Date(),
          processedBy: 'queue',
          webhookId
        },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: new Date(),
          createdByWebhook: webhookId
        }
      },
      { upsert: true }
    );
  }

  /**
   * Process order status update
   */
  private async processOrderStatusUpdate(payload: any, webhookId: string): Promise<void> {
    // Handle nested structure
    let orderData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      orderData = payload.webhookPayload;
      locationId = payload.locationId || orderData.locationId;
    } else {
      // Direct format
      orderData = payload;
      locationId = payload.locationId;
    }
    
    const { order } = orderData;
    
    console.log(`[FinancialProcessor] Updating order ${order?.id} status to ${order?.status}`);
    
    if (!order?.id || !locationId) {
      console.warn(`[FinancialProcessor] Missing order data for status update`);
      return;
    }
    
    await this.db.collection('orders').updateOne(
      { ghlOrderId: order.id, locationId },
      { 
        $set: { 
          status: order.status,
          paymentStatus: order.paymentStatus || undefined,
          fulfillmentStatus: order.fulfillmentStatus || undefined,
          statusUpdatedAt: new Date(),
          lastWebhookUpdate: new Date(),
          processedBy: 'queue',
          webhookId
        } 
      }
    );
  }

  /**
   * Process product event
   */
  private async processProductEvent(type: string, payload: any, webhookId: string): Promise<void> {
    console.log(`[FinancialProcessor] Processing ${type}`);
    
    // Handle nested structure
    let productData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      productData = payload.webhookPayload;
      locationId = payload.locationId || productData.locationId;
    } else {
      // Direct format
      productData = payload;
      locationId = payload.locationId;
    }
    
    // Store product events for future use
    await this.db.collection('product_events').insertOne({
      _id: new ObjectId(),
      type,
      payload: productData,
      locationId,
      webhookId,
      processedAt: new Date(),
      processedBy: 'queue'
    });
  }

  /**
   * Process price event
   */
  private async processPriceEvent(type: string, payload: any, webhookId: string): Promise<void> {
    console.log(`[FinancialProcessor] Processing ${type}`);
    
    // Handle nested structure
    let priceData;
    let locationId;
    
    if (payload.webhookPayload) {
      // Native webhook format
      priceData = payload.webhookPayload;
      locationId = payload.locationId || priceData.locationId;
    } else {
      // Direct format
      priceData = payload;
      locationId = payload.locationId;
    }
    
    // Store price events for future use
    await this.db.collection('price_events').insertOne({
      _id: new ObjectId(),
      type,
      payload: priceData,
      locationId,
      webhookId,
      processedAt: new Date(),
      processedBy: 'queue'
    });
  }

  /**
   * Update project financials
   */
  private async updateProjectFinancials(
    opportunityId: string, 
    locationId: string, 
    event: string, 
    data: any,
    session?: any
  ): Promise<void> {
    const project = await this.db.collection('projects').findOne(
      {
        ghlOpportunityId: opportunityId,
        locationId
      },
      { projection: { _id: 1 }, session }
    );
    
    if (project) {
      await this.db.collection('projects').updateOne(
        { _id: project._id },
        {
          $push: {
            timeline: {
              id: new ObjectId().toString(),
              event: event,
              description: `Invoice ${data.invoiceNumber || data.number || data.id} - ${event.replace('_', ' ')}`,
              timestamp: new Date().toISOString(),
              metadata: {
                invoiceId: data.id,
                amount: data.amount || data.total,
                status: data.status
              }
            }
          },
          $set: {
            lastFinancialUpdate: new Date()
          }
        },
        { session }
      );
    }
  }
}