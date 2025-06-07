// src/utils/sync/syncInvoices.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

interface SyncOptions {
  limit?: number;
  offset?: number;
  daysBack?: number;
  fullSync?: boolean;
}

export async function syncInvoices(db: Db, location: any, options: SyncOptions = {}) {
  const startTime = Date.now();
  const { limit = 100, offset = 0, daysBack = 90, fullSync = false } = options;
  
  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startAtStr = startDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  console.log(`[Sync Invoices] Starting for ${location.locationId} - From: ${startAtStr}, Limit: ${limit}, Offset: ${offset}`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Fetch invoices from GHL
    const response = await axios.get(
      'https://services.leadconnectorhq.com/invoices/',
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        },
        params: {
          altId: location.locationId,
          altType: 'location',
          startAt: startAtStr,
          limit: limit.toString(),
          offset: offset.toString()
        }
      }
    );

    const invoiceData = response.data;
    const ghlInvoices = invoiceData.invoices || [];
    const totalCount = invoiceData.total || ghlInvoices.length;
    
    console.log(`[Sync Invoices] Found ${ghlInvoices.length} invoices (Total: ${totalCount})`);

    // Process each invoice
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const ghlInvoice of ghlInvoices) {
      try {
        // Check if invoice exists
        const existingInvoice = await db.collection('invoices').findOne({
          ghlInvoiceId: ghlInvoice._id,
          locationId: location.locationId
        });

        // Calculate totals (GHL stores amounts in cents)
        const subtotal = ghlInvoice.totalSummary?.subTotal || ghlInvoice.total || 0;
        const discount = ghlInvoice.totalSummary?.discount || 0;
        const discountAmount = ghlInvoice.discount?.type === 'percentage' 
          ? (subtotal * (ghlInvoice.discount.value || 0)) / 100
          : (ghlInvoice.discount?.value || 0);
        
        // Prepare invoice data
        const invoiceData = {
          ghlInvoiceId: ghlInvoice._id,
          locationId: location.locationId,
          companyId: ghlInvoice.companyId,
          
          // Basic Info
          invoiceNumber: ghlInvoice.invoiceNumber,
          name: ghlInvoice.name || `Invoice ${ghlInvoice.invoiceNumber}`,
          title: ghlInvoice.title || 'INVOICE',
          status: ghlInvoice.status, // draft, sent, paid, overdue, cancelled
          liveMode: ghlInvoice.liveMode || false,
          
          // Contact Info
          contactId: ghlInvoice.contactDetails?.id || null,
          contactDetails: ghlInvoice.contactDetails || {},
          
          // Business Info
          businessDetails: ghlInvoice.businessDetails || {},
          
          // Dates
          issueDate: ghlInvoice.issueDate ? new Date(ghlInvoice.issueDate) : null,
          dueDate: ghlInvoice.dueDate ? new Date(ghlInvoice.dueDate) : null,
          sentAt: ghlInvoice.sentAt ? new Date(ghlInvoice.sentAt) : null,
          
          // Line Items
          invoiceItems: (ghlInvoice.invoiceItems || []).map((item: any) => ({
            ghlItemId: item._id,
            productId: item.productId,
            priceId: item.priceId,
            name: item.name,
            description: item.description || '',
            quantity: item.qty || 1,
            unitPrice: item.amount || 0, // in cents
            currency: item.currency || 'USD',
            taxes: item.taxes || [],
            taxInclusive: item.taxInclusive || false,
            itemTotalTax: item.itemTotalTax || 0,
            itemTotalDiscount: item.itemTotalDiscount || 0,
            itemUnitDiscount: item.itemUnitDiscount || 0
          })),
          
          // Financial Details (all amounts in cents)
          currency: ghlInvoice.currency || 'USD',
          currencyOptions: ghlInvoice.currencyOptions || {},
          subtotal: subtotal,
          discount: {
            type: ghlInvoice.discount?.type || 'fixed',
            value: ghlInvoice.discount?.value || 0,
            amount: discountAmount
          },
          totalTax: 0, // Calculate from line items if needed
          total: ghlInvoice.total || 0,
          invoiceTotal: ghlInvoice.invoiceTotal || ghlInvoice.total || 0,
          amountPaid: ghlInvoice.amountPaid || 0,
          amountDue: ghlInvoice.amountDue || ghlInvoice.total || 0,
          
          // Payment Info
          paymentMethods: ghlInvoice.paymentMethods || {},
          tipsConfiguration: ghlInvoice.tipsConfiguration || {},
          tipsReceived: ghlInvoice.tipsReceived || [],
          externalTransactions: ghlInvoice.externalTransactions || [],
          
          // Terms & Notes
          termsNotes: ghlInvoice.termsNotes || '',
          
          // Late Fees
          lateFeesConfiguration: ghlInvoice.lateFeesConfiguration || {},
          
          // Reminders
          remindersConfiguration: ghlInvoice.remindersConfiguration || {},
          
          // Opportunity Link
          opportunityId: ghlInvoice.opportunityDetails?.id || null,
          opportunityDetails: ghlInvoice.opportunityDetails || null,
          
          // Attachments
          attachments: ghlInvoice.attachments || [],
          
          // Metadata
          sentBy: ghlInvoice.sentBy,
          sentFrom: ghlInvoice.sentFrom || {},
          sentTo: ghlInvoice.sentTo || {},
          updatedBy: ghlInvoice.updatedBy,
          automaticTaxesCalculated: ghlInvoice.automaticTaxesCalculated || false,
          
          // Status tracking
          manualStatusTransitions: ghlInvoice.manualStatusTransitions || {},
          lastVisitedAt: ghlInvoice.lastVisitedAt ? new Date(ghlInvoice.lastVisitedAt) : null,
          
          // Sync Details
          syncDetails: ghlInvoice.syncDetails || [],
          
          // Timestamps
          ghlCreatedAt: ghlInvoice.createdAt ? new Date(ghlInvoice.createdAt) : null,
          ghlUpdatedAt: ghlInvoice.updatedAt ? new Date(ghlInvoice.updatedAt) : null,
          
          // Our Metadata
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        };

        if (existingInvoice) {
          // Update existing invoice
          await db.collection('invoices').updateOne(
            { _id: existingInvoice._id },
            { 
              $set: invoiceData,
              $setOnInsert: { createdAt: new Date() }
            }
          );
          updated++;
        } else {
          // Create new invoice
          await db.collection('invoices').insertOne({
            _id: new ObjectId(),
            ...invoiceData,
            createdAt: new Date(),
            createdBySync: true
          });
          created++;
        }
        
      } catch (invoiceError: any) {
        console.error(`[Sync Invoices] Error processing invoice ${ghlInvoice.invoiceNumber}:`, invoiceError.message);
        errors.push({
          invoiceId: ghlInvoice._id,
          invoiceNumber: ghlInvoice.invoiceNumber,
          error: invoiceError.message
        });
        skipped++;
      }
    }

    // Get invoice stats
    const invoiceStats = await db.collection('invoices').aggregate([
      { $match: { locationId: location.locationId } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$total' }
      }}
    ]).toArray();

    // Update location with sync info
    await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          invoiceCount: totalCount,
          lastInvoiceSync: new Date()
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Invoices] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    return {
      success: true,
      created,
      updated,
      skipped,
      processed: ghlInvoices.length,
      totalInGHL: totalCount,
      invoiceStats: invoiceStats,
      hasMore: totalCount > (offset + ghlInvoices.length),
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Invoices] Error:`, error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log(`[Sync Invoices] Invoices endpoint not found`);
      return {
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        processed: 0,
        error: 'Invoices endpoint not found'
      };
    }
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    throw error;
  }
}