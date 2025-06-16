// pages/api/invoices/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { 
  paginate, 
  buildDateRangeFilter, 
  buildSearchFilter 
} from '../../../src/utils/pagination';
import { 
  parseQueryParams, 
  buildInvoiceFilter 
} from '../../../src/utils/filters';
import { 
  sendPaginatedSuccess, 
  sendSuccess, 
  sendError, 
  sendValidationError,
  sendServerError,
  sendMethodNotAllowed 
} from '../../../src/utils/response';
import cors from '@/lib/cors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await cors(req, res);
  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return await getInvoices(db, req.query, res);
    case 'POST':
      // Redirect to create endpoint for now
      return sendError(res, 'Use /api/invoices/create for creating invoices', 400);
    default:
      return sendMethodNotAllowed(res, ['GET']);
  }
}

// 📋 GET: Fetch invoices with filters
async function getInvoices(db: any, query: any, res: NextApiResponse) {
  try {
    // Parse and validate query parameters
    const params = parseQueryParams(query);
    
    if (!params.locationId) {
      return sendValidationError(res, { locationId: 'Missing locationId' });
    }
    
    // Build base filter using the filter builder
    const filter = buildInvoiceFilter(params);
    
    // Add date range filter
    if (params.startDate || params.endDate) {
      // Use issueDate for invoices
      const dateFilter = buildDateRangeFilter('issueDate', params.startDate, params.endDate);
      Object.assign(filter, dateFilter);
    }
    
    // Add due date filter if specified
    if (params.dueStartDate || params.dueEndDate) {
      filter.dueDate = {};
      if (params.dueStartDate) filter.dueDate.$gte = params.dueStartDate;
      if (params.dueEndDate) filter.dueDate.$lte = params.dueEndDate;
    }
    
    // Add overdue filter
    if (params.overdue === 'true') {
      const today = new Date().toISOString().split('T')[0];
      filter.dueDate = { $lt: today };
      filter.status = { $ne: 'paid' };
    }
    
    // Add search filter - search through invoice number, name, and contact name
    if (params.search) {
      const searchFilter = buildSearchFilter(params.search, [
        'invoiceNumber',
        'name',
        'title',
        'contactDetails.name',
        'contactDetails.email'
      ]);
      if (searchFilter.$or) {
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, searchFilter];
          delete filter.$or;
        } else {
          Object.assign(filter, searchFilter);
        }
      }
    }
    
    // Add amount range filter
    if (params.minAmount || params.maxAmount) {
      filter.total = {};
      if (params.minAmount) filter.total.$gte = parseFloat(params.minAmount);
      if (params.maxAmount) filter.total.$lte = parseFloat(params.maxAmount);
    }
    
    // Get paginated results
    const result = await paginate(
      db.collection('invoices'),
      filter,
      {
        limit: params.limit,
        offset: params.offset,
        sortBy: params.sortBy === 'createdAt' ? 'issueDate' : params.sortBy, // Default to issueDate
        sortOrder: params.sortOrder
      }
    );
    
    // Optionally enrich invoices with additional data
    if (params.includeDetails === 'true') {
      const enrichedInvoices = await Promise.all(
        result.data.map(async (invoice) => {
          const enriched: any = { ...invoice };
          
          try {
            // Get contact details if not already included
            if (invoice.contactId && !invoice.contactDetails?.name) {
              const contact = await db.collection('contacts').findOne({ 
                _id: new ObjectId(invoice.contactId) 
              });
              
              if (contact) {
                enriched.contactDetails = {
                  id: contact._id.toString(),
                  name: `${contact.firstName} ${contact.lastName}`,
                  email: contact.email,
                  phoneNo: contact.phone
                };
              }
            }
            
            // Get opportunity/project details if exists
            if (invoice.opportunityId) {
              const project = await db.collection('projects').findOne({ 
                ghlOpportunityId: invoice.opportunityId 
              });
              
              if (project) {
                enriched.project = {
                  _id: project._id,
                  title: project.title,
                  status: project.status
                };
              }
            }
            
            // Get payment history
            if (params.includePayments === 'true') {
              const payments = await db.collection('payments').find({
                ghlInvoiceId: invoice.ghlInvoiceId
              }).toArray();
              
              enriched.payments = payments;
              enriched.paymentCount = payments.length;
            }
            
            // Calculate days overdue if applicable
            if (invoice.status !== 'paid' && invoice.dueDate) {
              const dueDate = new Date(invoice.dueDate);
              const today = new Date();
              const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysOverdue > 0) {
                enriched.daysOverdue = daysOverdue;
              }
            }
            
          } catch (err) {
            console.error(`[INVOICES API] Failed to enrich invoice ${invoice._id}:`, err);
          }
          
          return enriched;
        })
      );
      
      result.data = enrichedInvoices;
    }
    
    // Get summary statistics if requested
    if (params.includeSummary === 'true') {
      const summary = await db.collection('invoices').aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalAmount: { $sum: '$total' },
            totalPaid: { $sum: '$amountPaid' },
            totalDue: { $sum: '$amountDue' },
            averageAmount: { $avg: '$total' },
            statusCounts: {
              $push: {
                status: '$status',
                amount: '$total',
                amountDue: '$amountDue'
              }
            }
          }
        },
        {
          $project: {
            totalCount: 1,
            totalAmount: 1,
            totalPaid: 1,
            totalDue: 1,
            averageAmount: 1,
            statusBreakdown: {
              $reduce: {
                input: '$statusCounts',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $cond: [
                        { $eq: ['$$this.status', 'paid'] },
                        { 
                          paid: { 
                            count: { $add: [{ $ifNull: ['$$value.paid.count', 0] }, 1] },
                            amount: { $add: [{ $ifNull: ['$$value.paid.amount', 0] }, '$$this.amount'] }
                          } 
                        },
                        {
                          $cond: [
                            { $eq: ['$$this.status', 'pending'] },
                            { 
                              pending: { 
                                count: { $add: [{ $ifNull: ['$$value.pending.count', 0] }, 1] },
                                amount: { $add: [{ $ifNull: ['$$value.pending.amount', 0] }, '$$this.amount'] },
                                amountDue: { $add: [{ $ifNull: ['$$value.pending.amountDue', 0] }, '$$this.amountDue'] }
                              } 
                            },
                            { 
                              overdue: { 
                                count: { $add: [{ $ifNull: ['$$value.overdue.count', 0] }, 1] },
                                amount: { $add: [{ $ifNull: ['$$value.overdue.amount', 0] }, '$$this.amount'] },
                                amountDue: { $add: [{ $ifNull: ['$$value.overdue.amountDue', 0] }, '$$this.amountDue'] }
                              } 
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            }
          }
        }
      ]).toArray();
      
      // Add overdue count calculation
      if (summary[0]) {
        const todayStr = new Date().toISOString().split('T')[0];
        const overdueCount = await db.collection('invoices').countDocuments({
          ...filter,
          dueDate: { $lt: todayStr },
          status: { $ne: 'paid' }
        });
        
        summary[0].overdueCount = overdueCount;
      }
      
      (result as any).summary = summary[0] || {
        totalCount: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalDue: 0,
        averageAmount: 0,
        overdueCount: 0,
        statusBreakdown: {}
      };
    }
    
    return sendPaginatedSuccess(
      res,
      result.data,
      result.pagination,
      'Invoices retrieved successfully',
      (result as any).summary ? { summary: (result as any).summary } : undefined
    );
    
  } catch (error) {
    console.error('[INVOICES API] Error fetching invoices:', error);
    return sendServerError(res, error, 'Failed to fetch invoices');
  }
}