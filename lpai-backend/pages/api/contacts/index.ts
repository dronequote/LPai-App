import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import clientPromise from '../../../src/lib/mongodb';
import { 
  paginate, 
  buildDateRangeFilter, 
  buildSearchFilter 
} from '../../../src/utils/pagination';
import { 
  parseQueryParams, 
  buildContactFilter 
} from '../../../src/utils/filters';
import { 
  sendPaginatedSuccess, 
  sendSuccess, 
  sendError, 
  sendValidationError,
  sendServerError,
  sendMethodNotAllowed 
} from '../../../src/utils/response';
import { GHL_ENDPOINTS } from '../../../constants/ghl';
import { getAuthHeader } from '@/utils/ghlAuth';
import { getLocation } from '../../../src/utils/getLocation';

function formatPhoneToE164(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (phone.startsWith('+')) return phone;

  return `+1${cleaned}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return handleGetContacts(req, res);
    case 'POST':
      return handleCreateContact(req, res);
    default:
      return sendMethodNotAllowed(res, ['GET', 'POST']);
  }
}

async function handleGetContacts(req: NextApiRequest, res: NextApiResponse) {
  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // Parse and validate query parameters
    const params = parseQueryParams(req.query);
    
    if (!params.locationId) {
      return sendValidationError(res, { locationId: 'Missing locationId' });
    }

    // Build base filter
    const filter = buildContactFilter(params);
    
    // Add date range filter
    const dateFilter = buildDateRangeFilter('createdAt', params.startDate, params.endDate);
    Object.assign(filter, dateFilter);
    
    // Add search filter (search in name, email, phone)
    if (params.search) {
      const searchFilter = buildSearchFilter(params.search, [
        'firstName', 
        'lastName', 
        'email', 
        'phone',
        'companyName'
      ]);
      if (searchFilter.$or) {
        // Also search for full name
        searchFilter.$or.push({
          $expr: {
            $regexMatch: {
              input: { $concat: ['$firstName', ' ', '$lastName'] },
              regex: params.search,
              options: 'i'
            }
          }
        });
        
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
      db.collection('contacts'),
      filter,
      {
        limit: params.limit,
        offset: params.offset,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder
      }
    );

    // Optionally include project count if requested
    if (params.includeProjects === 'true') {
      const contactIds = result.data.map(c => c._id.toString());
      
      if (contactIds.length > 0) {
        // Get project counts for all contacts
        const projectCounts = await db.collection('projects').aggregate([
          {
            $match: {
              contactId: { $in: contactIds },
              status: { $ne: 'Deleted' }
            }
          },
          {
            $group: {
              _id: '$contactId',
              count: { $sum: 1 }
            }
          }
        ]).toArray();
        
        // Create a map of contact ID to project count
        const projectCountMap = Object.fromEntries(
          projectCounts.map(pc => [pc._id, pc.count])
        );
        
        // Add project count to each contact
        result.data = result.data.map(contact => ({
          ...contact,
          projectCount: projectCountMap[contact._id.toString()] || 0
        }));
      }
    }

    return sendPaginatedSuccess(
      res, 
      result.data, 
      result.pagination, 
      'Contacts retrieved successfully'
    );
    
  } catch (error) {
    console.error('❌ Failed to fetch contacts:', error);
    return sendServerError(res, error, 'Failed to fetch contacts');
  }
}

async function handleCreateContact(req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = req.body;
    const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : null;

    if (!locationId) {
      return sendValidationError(res, { locationId: 'Missing locationId in query parameters' });
    }

    if (!body || !body.email) {
      return sendValidationError(res, { 
        email: !body.email ? 'Email is required' : undefined 
      });
    }

    if (body.phone) {
      body.phone = formatPhoneToE164(body.phone);
    }

    const location = await getLocation(locationId);
    const auth = await getAuthHeader(location);

    const ghlResponse = await axios.post(
      GHL_ENDPOINTS.CONTACTS.base,
      {
        ...body,
        locationId,
      },
      {
        headers: {
          Authorization: auth.header,
          'Content-Type': 'application/json',
          Version: '2021-07-28',
        },
      }
    );

    return sendSuccess(res, ghlResponse.data, 'Contact created successfully');
    
  } catch (error: any) {
    console.error('❌ Error creating contact in GHL:', error.response?.data || error.message);

    if (error?.response?.status === 401) {
      return sendError(res, 'Invalid or expired GHL token', 401);
    }

    return sendServerError(res, error, 'Failed to create contact');
  }
}