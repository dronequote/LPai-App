// pages/api/tasks/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { 
  paginate, 
  buildDateRangeFilter, 
  buildSearchFilter 
} from '../../../src/utils/pagination';
import { 
  parseQueryParams, 
  buildTaskFilter 
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
      return await getTasks(db, req.query, res);
    case 'POST':
      return await createTask(db, req.body, res);
    default:
      return sendMethodNotAllowed(res, ['GET', 'POST']);
  }
}

// 📋 GET: Fetch tasks with filters
async function getTasks(db: any, query: any, res: NextApiResponse) {
  try {
    // Parse and validate query parameters
    const params = parseQueryParams(query);
    
    if (!params.locationId) {
      return sendValidationError(res, { locationId: 'Missing locationId' });
    }
    
    // Build base filter using the filter builder
    const filter = buildTaskFilter(params);
    
    // Add date range filter for due dates
    if (params.dueDateStart || params.dueDateEnd) {
      const dateFilter = buildDateRangeFilter('dueDate', params.dueDateStart, params.dueDateEnd);
      Object.assign(filter, dateFilter);
    }
    
    // Add completed date range filter
    if (params.completedDateStart || params.completedDateEnd) {
      const completedDateFilter = buildDateRangeFilter('completedAt', params.completedDateStart, params.completedDateEnd);
      Object.assign(filter, completedDateFilter);
    }
    
    // Add overdue filter
    if (params.overdue === 'true') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter.dueDate = { $lt: today };
      filter.completed = false;
    }
    
    // Add search filter
    if (params.search) {
      const searchFilter = buildSearchFilter(params.search, [
        'title',
        'description'
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
    
    // Get paginated results
    const result = await paginate(
      db.collection('tasks'),
      filter,
      {
        limit: params.limit,
        offset: params.offset,
        sortBy: params.sortBy === 'createdAt' ? 'dueDate' : params.sortBy,
        sortOrder: params.sortOrder
      }
    );
    
    // Enrich tasks with additional data
    if (params.includeDetails === 'true') {
      const enrichedTasks = await Promise.all(
        result.data.map(async (task) => {
          const enriched: any = { ...task };
          
          try {
            // Get contact details
            if (task.contactId) {
              const contact = await db.collection('contacts').findOne({ 
                _id: new ObjectId(task.contactId) 
              });
              
              if (contact) {
                enriched.contact = {
                  _id: contact._id,
                  firstName: contact.firstName,
                  lastName: contact.lastName,
                  email: contact.email,
                  phone: contact.phone
                };
              }
            }
            
            // Get assigned user details
            if (task.assignedTo) {
              const user = await db.collection('users').findOne({ 
                userId: task.assignedTo 
              });
              
              if (user) {
                enriched.assignedUser = {
                  userId: user.userId,
                  name: user.name,
                  email: user.email
                };
              }
            }
            
            // Calculate days overdue if applicable
            if (!task.completed && task.dueDate) {
              const dueDate = new Date(task.dueDate);
              const today = new Date();
              const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysOverdue > 0) {
                enriched.daysOverdue = daysOverdue;
              }
            }
            
          } catch (err) {
            console.error(`[TASKS API] Failed to enrich task ${task._id}:`, err);
          }
          
          return enriched;
        })
      );
      
      result.data = enrichedTasks;
    }
    
    // Get summary statistics if requested
    if (params.includeSummary === 'true') {
      const summary = await db.collection('tasks').aggregate([
        { $match: { locationId: params.locationId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: ['$completed', 1, 0] } },
            pending: { $sum: { $cond: ['$completed', 0, 1] } },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$completed', false] },
                      { $lt: ['$dueDate', new Date()] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            dueToday: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$completed', false] },
                      {
                        $gte: ['$dueDate', new Date(new Date().setHours(0, 0, 0, 0))]
                      },
                      {
                        $lt: ['$dueDate', new Date(new Date().setHours(23, 59, 59, 999))]
                      }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray();
      
      (result as any).summary = summary[0] || {
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        dueToday: 0
      };
    }
    
    return sendPaginatedSuccess(
      res,
      result.data,
      result.pagination,
      'Tasks retrieved successfully',
      (result as any).summary ? { summary: (result as any).summary } : undefined
    );
    
  } catch (error) {
    console.error('[TASKS API] Error fetching tasks:', error);
    return sendServerError(res, error, 'Failed to fetch tasks');
  }
}

// 🆕 POST: Create new task
async function createTask(db: any, body: any, res: NextApiResponse) {
  try {
    const {
      title,
      description,
      contactId,
      locationId,
      assignedTo,
      dueDate,
      priority = 'medium'
    } = body;
    
    // Validate required fields
    if (!title || !contactId || !locationId || !dueDate) {
      return sendValidationError(res, {
        title: !title ? 'Required' : undefined,
        contactId: !contactId ? 'Required' : undefined,
        locationId: !locationId ? 'Required' : undefined,
        dueDate: !dueDate ? 'Required' : undefined
      });
    }
    
    // Verify contact exists
    let contact;
    try {
      contact = await db.collection('contacts').findOne({
        _id: new ObjectId(contactId),
        locationId
      });
      
      if (!contact) {
        return sendError(res, 'Contact not found', 404);
      }
    } catch (err) {
      return sendValidationError(res, { contactId: 'Invalid format' });
    }
    
    // Verify assigned user exists if provided
    let user;
    if (assignedTo) {
      user = await db.collection('users').findOne({
        userId: assignedTo,
        locationId
      });
      
      if (!user) {
        return sendError(res, 'Assigned user not found', 404);
      }
    }
    
    // Get location for GHL sync
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.apiKey) {
      return sendError(res, 'Location not found or missing API key', 400);
    }
    
    // Create task in MongoDB first
    const newTask = {
      title,
      description: description || '',
      contactId: new ObjectId(contactId),
      locationId,
      assignedTo: assignedTo || null,
      status: 'pending',
      completed: false,
      priority,
      dueDate: new Date(dueDate),
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('tasks').insertOne(newTask);
    const createdTask = { ...newTask, _id: result.insertedId };
    
    // Sync to GHL if contact has GHL ID
    if (contact.ghlContactId) {
      try {
        const ghlPayload = {
          title,
          body: description || '',
          assignedTo: user?.ghlUserId || null,
          dueDate: new Date(dueDate).toISOString(),
          completed: false,
          contactId: contact.ghlContactId
        };
        
        const ghlResponse = await axios.post(
          'https://services.leadconnectorhq.com/contacts/tasks',
          ghlPayload,
          {
            headers: {
              Authorization: `Bearer ${location.apiKey}`,
              Version: '2021-07-28',
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Update task with GHL ID
        if (ghlResponse.data?.id) {
          await db.collection('tasks').updateOne(
            { _id: result.insertedId },
            { 
              $set: { 
                ghlTaskId: ghlResponse.data.id,
                lastSyncedAt: new Date()
              } 
            }
          );
          
          createdTask.ghlTaskId = ghlResponse.data.id;
        }
        
      } catch (ghlError: any) {
        console.error('[TASKS API] GHL sync failed:', ghlError.response?.data || ghlError);
        // Don't fail the task creation if GHL sync fails
      }
    }
    
    return sendSuccess(res, createdTask, 'Task created successfully', 201);
    
  } catch (error) {
    console.error('[TASKS API] Error creating task:', error);
    return sendServerError(res, error, 'Failed to create task');
  }
}