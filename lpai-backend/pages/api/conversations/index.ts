// pages/api/conversations/index.ts
// Updated Date 06/24/2025

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
  buildConversationFilter 
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
      return await getConversations(db, req.query, res);
    default:
      return sendMethodNotAllowed(res, ['GET']);
  }
}

async function getConversations(db: any, query: any, res: NextApiResponse) {
  try {
    // Parse and validate query parameters
    const params = parseQueryParams(query);
    
    if (!params.locationId) {
      return sendValidationError(res, { locationId: 'Missing locationId' });
    }
    
    // Build base filter using the filter builder
    const filter = buildConversationFilter(params);
    
    // Add date range filter (using lastMessageDate for conversations)
    if (params.startDate || params.endDate) {
      const dateFilter = buildDateRangeFilter('lastMessageDate', params.startDate, params.endDate);
      Object.assign(filter, dateFilter);
    }
    
    // Add search filter - search through message preview and contact info
    if (params.search) {
      const searchFilter = buildSearchFilter(params.search, [
        'lastMessageBody',
        'contactName',
        'contactEmail',
        'contactPhone'
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
    
    // Get paginated results with custom sort (most recent messages first by default)
    const result = await paginate(
      db.collection('conversations'),
      filter,
      {
        limit: params.limit,
        offset: params.offset,
        sortBy: params.sortBy === 'createdAt' ? 'lastMessageDate' : params.sortBy, // Default to lastMessageDate
        sortOrder: params.sortOrder
      }
    );
    
    // Enrich conversations with additional data
    const enrichedConversations = await Promise.all(
      result.data.map(async (conversation) => {
        const enriched: any = { ...conversation };
        
        try {
          // Always include contact info since it's essential for conversations
          // FIXED: Use contactObjectId instead of contactId
          if (conversation.contactObjectId) {
            const contact = await db.collection('contacts').findOne({ 
              _id: conversation.contactObjectId // Already ObjectId from DB
            });
            
            if (contact) {
              enriched.contact = {
                _id: contact._id,
                firstName: contact.firstName,
                lastName: contact.lastName,
                email: contact.email,
                phone: contact.phone,
                ghlContactId: contact.ghlContactId
              };
              
              // Update contact fields if they're missing or outdated
              const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
              if (!conversation.contactName || conversation.contactName !== fullName) {
                enriched.contactName = fullName;
              }
              if (!conversation.contactEmail || conversation.contactEmail !== contact.email) {
                enriched.contactEmail = contact.email;
              }
              if (!conversation.contactPhone || conversation.contactPhone !== contact.phone) {
                enriched.contactPhone = contact.phone;
              }
            }
          }
          
          // Optionally include project info if requested
          if (params.includeProject === 'true' && conversation.projectId) {
            const project = await db.collection('projects').findOne({ 
              _id: new ObjectId(conversation.projectId) 
            });
            
            if (project) {
              enriched.project = {
                _id: project._id,
                title: project.title,
                status: project.status
              };
            }
          }
          
          // Get message count if requested
          if (params.includeMessageCount === 'true') {
            const messageCount = await db.collection('messages').countDocuments({
              conversationId: conversation._id // FIXED: Use ObjectId directly, not string
            });
            enriched.totalMessages = messageCount;
          }
          
          // Get last few messages preview if requested
          if (params.includeRecentMessages === 'true') {
            const recentMessages = await db.collection('messages')
              .find({ conversationId: conversation._id }) // FIXED: Use ObjectId directly
              .sort({ dateAdded: -1 })
              .limit(3)
              .project({ 
                body: 1, 
                direction: 1, 
                dateAdded: 1, 
                type: 1,
                read: 1 
              })
              .toArray();
            
            enriched.recentMessages = recentMessages;
          }
          
        } catch (err) {
          console.error(`[CONVERSATIONS API] Failed to enrich conversation ${conversation._id}:`, err);
        }
        
        return enriched;
      })
    );
    
    result.data = enrichedConversations;
    
    // Get summary statistics if requested
    if (params.includeSummary === 'true') {
      const summary = await db.collection('conversations').aggregate([
        { $match: { locationId: params.locationId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalUnread: { 
              $sum: { 
                $cond: [{ $gt: ['$unreadCount', 0] }, 1, 0] 
              } 
            },
            totalStarred: { 
              $sum: { 
                $cond: ['$starred', 1, 0] 
              } 
            },
            byType: {
              $push: {
                type: '$type',
                unread: '$unreadCount'
              }
            }
          }
        },
        {
          $project: {
            total: 1,
            totalUnread: 1,
            totalStarred: 1,
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
                          v: {
                            count: { 
                              $add: [
                                { $ifNull: [{ $getField: { field: '$$this.type', input: '$$value.count' } }, 0] }, 
                                1
                              ] 
                            },
                            unread: { 
                              $add: [
                                { $ifNull: [{ $getField: { field: '$$this.type', input: '$$value.unread' } }, 0] }, 
                                { $cond: [{ $gt: ['$$this.unread', 0] }, 1, 0] }
                              ] 
                            }
                          }
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
      
      (result as any).summary = summary[0] || {
        total: 0,
        totalUnread: 0,
        totalStarred: 0,
        typeBreakdown: {}
      };
    }
    
    return sendPaginatedSuccess(
      res,
      result.data,
      result.pagination,
      'Conversations retrieved successfully',
      (result as any).summary ? { summary: (result as any).summary } : undefined
    );
    
  } catch (error) {
    console.error('[CONVERSATIONS API] Error fetching conversations:', error);
    return sendServerError(res, error, 'Failed to fetch conversations');
  }
}