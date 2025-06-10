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
  buildProjectFilter 
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

  // GET: Return all projects for a location with filtering and pagination
  if (req.method === 'GET') {
    try {
      // Parse and validate query parameters
      const params = parseQueryParams(req.query);
      
      if (!params.locationId) {
        return sendValidationError(res, { locationId: 'Missing locationId' });
      }

      // Build base filter
      const filter = buildProjectFilter(params);
      
      // Add date range filter
      const dateFilter = buildDateRangeFilter('createdAt', params.startDate, params.endDate);
      Object.assign(filter, dateFilter);
      
      // Add search filter
      if (params.search) {
        const searchFilter = buildSearchFilter(params.search, ['title', 'notes', 'scopeOfWork']);
        if (searchFilter.$or) {
          // Combine with existing filter
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
        db.collection('projects'),
        filter,
        {
          limit: params.limit,
          offset: params.offset,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder
        }
      );

      // Optionally enrich with contact info if requested
      if (params.includeContact === 'true') {
        const contactIds = result.data
          .map(p => p.contactId)
          .filter(Boolean)
          .filter(id => ObjectId.isValid(id));
          
        if (contactIds.length > 0) {
          const contacts = await db
            .collection('contacts')
            .find({ _id: { $in: contactIds.map(id => new ObjectId(id)) } })
            .toArray();

          // Map contact info to projects
          const contactMap = Object.fromEntries(
            contacts.map(c => [
              c._id.toString(),
              {
                name: `${c.firstName} ${c.lastName}`,
                email: c.email,
                phone: c.phone || '',
              },
            ])
          );

          // Attach contact info to each project
          result.data = result.data.map(p => ({
            ...p,
            contactName: contactMap[p.contactId?.toString()]?.name || '—',
            contactEmail: contactMap[p.contactId?.toString()]?.email || '',
            contactPhone: contactMap[p.contactId?.toString()]?.phone || '',
          }));
        }
      }

      return sendPaginatedSuccess(
        res, 
        result.data, 
        result.pagination, 
        'Projects retrieved successfully'
      );
      
    } catch (err) {
      console.error('❌ Failed to load projects:', err);
      return sendServerError(res, err, 'Failed to load projects');
    }
  }

  // POST: Create a new project (sync to GHL if possible)
  else if (req.method === 'POST') {
    try {
      const { contactId, userId, locationId, title, status, ...rest } = req.body;
      
      if (!contactId || !userId || !locationId || !title) {
        return sendValidationError(res, {
          contactId: !contactId ? 'Required' : undefined,
          userId: !userId ? 'Required' : undefined,
          locationId: !locationId ? 'Required' : undefined,
          title: !title ? 'Required' : undefined,
        });
      }

      // Allow any extra fields (scopeOfWork, products, etc.)
      const projectData = {
        contactId, 
        userId, 
        locationId, 
        title, 
        status: status || 'open',
        ...rest,
        createdAt: new Date(),
      };

      // 1️⃣ Save project in MongoDB
      const result = await db.collection('projects').insertOne(projectData);

      // 2️⃣ Try to push to GHL as "opportunity" if we have what we need
      let ghlOpportunityId;
      try {
        // Find GHL contact ID
        const mongoContact = await db.collection('contacts').findOne({ 
          _id: new ObjectId(contactId) 
        });
        const ghlContactId = mongoContact?.ghlContactId;
        const locationDoc = await db.collection('locations').findOne({ locationId });
        const apiKey = locationDoc?.apiKey;
        // The frontend sends the selected pipelineId for this project:
        const pipelineId = rest.pipelineId;

        if (apiKey && ghlContactId && pipelineId) {
          const ghlPayload = {
            contactId: ghlContactId,
            pipelineId,
            locationId,
            status: 'open', // Always start as open
            name: title,
            // ...add custom fields mapping here if needed
          };

          console.log('🚀 GHL Opportunity payload:', ghlPayload);

          const ghlRes = await axios.post(
            'https://services.leadconnectorhq.com/opportunities/',
            ghlPayload,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                Version: '2021-07-28',
              },
            }
          );

          ghlOpportunityId = ghlRes.data.opportunity?.id;
          console.log('✅ GHL Opportunity created:', ghlOpportunityId);

          // Optionally update project with GHL opportunity ID
          if (ghlOpportunityId) {
            await db.collection('projects').updateOne(
              { _id: result.insertedId },
              { $set: { ghlOpportunityId } }
            );
          }
        } else {
          console.warn('⚠️ Missing GHL info (apiKey, ghlContactId, pipelineId), skipping GHL sync.');
          console.log({ apiKey: !!apiKey, ghlContactId, pipelineId });
        }
      } catch (err: any) {
        console.error('❌ Failed to sync opportunity with GHL:', err.response?.data || err.message);
        // Don't fail the whole request - project is still created in MongoDB
      }

      return sendSuccess(res, { 
        success: true, 
        projectId: result.insertedId, 
        ghlOpportunityId 
      }, 'Project created successfully');
      
    } catch (err) {
      console.error('❌ Failed to create project:', err);
      return sendServerError(res, err, 'Failed to create project');
    }
  }

  // Method not allowed
  else {
    return sendMethodNotAllowed(res, ['GET', 'POST']);
  }
}