// pages/api/payments/index.ts
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
  buildPaymentFilter 
} from '../../../src/utils/filters';
import { 
  sendPaginatedSuccess, 
  sendSuccess, 
  sendError, 
  sendValidationError,
  sendServerError,
  sendMethodNotAllowed 
} from '../../../src/utils/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return await getPayments(db, req.query, res);
    case 'POST':
      // Redirect to create-link endpoint for now
      return sendError(res, 'Use /api/payments/create-link for creating payment links', 400);
    default:
      return sendMethodNotAllowed(res, ['GET']);
  }
}

// 📋 GET: Fetch payments with filters
async function getPayments(db: any, query: any, res: NextApiResponse) {
  try {
    // Parse and validate query parameters
    const params = parseQueryParams(query);
    
    if (!params.locationId) {
      return sendValidationError(res, { locationId: 'Missing locationId' });
    }
    
    // Build base filter using the filter builder
    const filter = buildPaymentFilter(params);
    
    // Add date range filter
    if (params.startDate || params.endDate) {
      const dateFilter = buildDateRangeFilter('createdAt', params.startDate, params.endDate);
      Object.assign(filter, dateFilter);
    }
    
    // Add search filter - search through description and check numbers
    if (params.search) {
      const searchFilter = buildSearchFilter(params.search, [
        'description',
        'checkNumber',
        'ghlInvoiceNumber'
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
      filter.amount = {};
      if (params.minAmount) filter.amount.$gte = parseFloat(params.minAmount);
      if (params.maxAmount) filter.amount.$lte = parseFloat(params.maxAmount);
    }
    
    // Get paginated results
    const result = await paginate(
      db.collection('payments'),
      filter,
      {
        limit: params.limit,
        offset: params.offset,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder
      }
    );
    
    // Optionally enrich payments with related data
    if (params.includeDetails === 'true') {
      const enrichedPayments = await Promise.all(
        result.data.map(async (payment) => {
          const enriched: any = { ...payment };
          
          try {
            // Fetch project info if exists
            if (payment.projectId) {
              const project = await db.collection('projects').findOne({ 
                _id: new ObjectId(payment.projectId) 
              });
              enriched.project = project;
              enriched.projectTitle = project?.title || 'Unknown Project';
            }
            
            // Fetch quote info if exists
            if (payment.quoteId) {
              const quote = await db.collection('quotes').findOne({ 
                _id: new ObjectId(payment.quoteId) 
              });
              enriched.quote = quote;
              enriched.quoteNumber = quote?.quoteNumber || 'Unknown Quote';
            }
            
            // Fetch contact info
            if (payment.contactId) {
              const contact = await db.collection('contacts').findOne({ 
                _id: new ObjectId(payment.contactId) 
              });
              enriched.contact = contact;
              enriched.contactName = contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown Contact';
            }
            
            // Fetch user info (who created the payment)
            if (payment.createdBy) {
              const user = await db.collection('users').findOne({ 
                _id: new ObjectId(payment.createdBy) 
              });
              enriched.createdByUser = user;
              enriched.createdByName = user?.name || 'Unknown User';
            }
            
          } catch (err) {
            console.error(`[PAYMENTS API] Failed to enrich payment ${payment._id}:`, err);
          }
          
          return enriched;
        })
      );
      
      result.data = enrichedPayments;
    }
    
    // Calculate summary statistics if requested
    if (params.includeSummary === 'true') {
      const summary = await db.collection('payments').aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            averageAmount: { $avg: '$amount' },
            count: { $sum: 1 },
            byStatus: {
              $push: {
                status: '$status',
                amount: '$amount'
              }
            },
            byType: {
              $push: {
                type: '$type',
                amount: '$amount'
              }
            },
            byMethod: {
              $push: {
                method: '$method',
                amount: '$amount'
              }
            }
          }
        },
        {
          $project: {
            totalAmount: 1,
            averageAmount: 1,
            count: 1,
            statusBreakdown: {
              $reduce: {
                input: '$byStatus',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $cond: [
                        { $eq: ['$$this.status', 'completed'] },
                        { completed: { $add: [{ $ifNull: ['$$value.completed', 0] }, '$$this.amount'] } },
                        {
                          $cond: [
                            { $eq: ['$$this.status', 'pending'] },
                            { pending: { $add: [{ $ifNull: ['$$value.pending', 0] }, '$$this.amount'] } },
                            { failed: { $add: [{ $ifNull: ['$$value.failed', 0] }, '$$this.amount'] } }
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            },
            typeBreakdown: {
              $reduce: {
                input: '$byType',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [[
                        {
                          k: '$$this.type',
                          v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.type', input: '$$value' } }, 0] }, '$$this.amount'] }
                        }
                      ]]
                    }
                  ]
                }
              }
            },
            methodBreakdown: {
              $reduce: {
                input: '$byMethod',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [[
                        {
                          k: '$$this.method',
                          v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.method', input: '$$value' } }, 0] }, '$$this.amount'] }
                        }
                      ]]
                    }
                  ]
                }
              }
            }
          }
        }
      ]).toArray();
      
      // Attach summary to response
      (result as any).summary = summary[0] || {
        totalAmount: 0,
        averageAmount: 0,
        count: 0,
        statusBreakdown: {},
        typeBreakdown: {},
        methodBreakdown: {}
      };
    }
    
    return sendPaginatedSuccess(
      res,
      result.data,
      result.pagination,
      'Payments retrieved successfully',
      (result as any).summary ? { summary: (result as any).summary } : undefined
    );
    
  } catch (error) {
    console.error('[PAYMENTS API] Error fetching payments:', error);
    return sendServerError(res, error, 'Failed to fetch payments');
  }
}