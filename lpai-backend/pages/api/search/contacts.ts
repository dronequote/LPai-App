// pages/api/search/contacts.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { sendSuccess, sendError, sendPaginatedResponse } from '../../../src/utils/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      query, 
      locationId,
      filters = {},
      limit = 20,
      offset = 0
    } = req.body;

    if (!locationId) {
      return sendError(res, 'Missing locationId');
    }

    const client = await clientPromise;
    const db = client.db('lpai');

    // Build search filter
    const searchFilter: any = { locationId };

    // Add text search or field-specific search
    if (query) {
      const searchRegex = new RegExp(query, 'i');
      searchFilter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { companyName: searchRegex },
        { 'address': searchRegex }
      ];
    }

    // Add additional filters
    if (filters.hasProjects !== undefined) {
      // This would require a lookup, so for now we'll skip
    }
    if (filters.tags && filters.tags.length > 0) {
      searchFilter.tags = { $in: filters.tags };
    }
    if (filters.source) {
      searchFilter.source = filters.source;
    }
    if (filters.createdAfter) {
      searchFilter.createdAt = { $gte: new Date(filters.createdAfter) };
    }

    // Execute search with pagination
    const [contacts, total] = await Promise.all([
      db.collection('contacts')
        .find(searchFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .toArray(),
      db.collection('contacts').countDocuments(searchFilter)
    ]);

    return sendPaginatedResponse(res, contacts, {
      total,
      limit,
      offset
    });

  } catch (error) {
    console.error('[Contact Search] Error:', error);
    return sendError(res, 'Search failed', 500);
  }
}