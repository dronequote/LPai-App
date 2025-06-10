// pages/api/search/projects.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
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
      offset = 0,
      includeContact = true
    } = req.body;

    if (!locationId) {
      return sendError(res, 'Missing locationId');
    }

    const client = await clientPromise;
    const db = client.db('lpai');

    // Build search filter
    const searchFilter: any = { locationId };

    // Add text search
    if (query) {
      const searchRegex = new RegExp(query, 'i');
      searchFilter.$or = [
        { title: searchRegex },
        { notes: searchRegex },
        { scopeOfWork: searchRegex },
        { quoteNumber: searchRegex }
      ];
    }

    // Add filters
    if (filters.status) {
      searchFilter.status = Array.isArray(filters.status) 
        ? { $in: filters.status }
        : filters.status;
    }
    if (filters.contactId) {
      searchFilter.contactId = filters.contactId;
    }
    if (filters.pipelineId) {
      searchFilter.pipelineId = filters.pipelineId;
    }
    if (filters.hasQuote !== undefined) {
      searchFilter.quoteId = filters.hasQuote 
        ? { $exists: true, $ne: null }
        : { $exists: false };
    }
    if (filters.minValue) {
      searchFilter.monetaryValue = { $gte: filters.minValue };
    }
    if (filters.dateRange) {
      searchFilter.createdAt = {};
      if (filters.dateRange.start) {
        searchFilter.createdAt.$gte = new Date(filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        searchFilter.createdAt.$lte = new Date(filters.dateRange.end);
      }
    }

    // Execute search
    const [projects, total] = await Promise.all([
      db.collection('projects')
        .find(searchFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .toArray(),
      db.collection('projects').countDocuments(searchFilter)
    ]);

    // Enrich with contact info if requested
    if (includeContact && projects.length > 0) {
      const contactIds = [...new Set(projects.map(p => p.contactId).filter(Boolean))];
      const contacts = await db.collection('contacts')
        .find({ 
          _id: { $in: contactIds.map(id => new ObjectId(id)) } 
        })
        .project({ firstName: 1, lastName: 1, email: 1, phone: 1 })
        .toArray();
      
      const contactMap = new Map(contacts.map(c => [c._id.toString(), c]));
      
      projects.forEach(project => {
        const contact = contactMap.get(project.contactId);
        if (contact) {
          project.contact = contact;
          project.contactName = `${contact.firstName} ${contact.lastName}`;
        }
      });
    }

    return sendPaginatedResponse(res, projects, {
      total,
      limit,
      offset
    });

  } catch (error) {
    console.error('[Project Search] Error:', error);
    return sendError(res, 'Search failed', 500);
  }
}