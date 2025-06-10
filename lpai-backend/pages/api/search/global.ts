// pages/api/search/global.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendSuccess, sendError } from '../../../src/utils/response';

interface SearchRequest {
  query: string;
  entities?: ('contacts' | 'projects' | 'quotes' | 'appointments')[];
  locationId: string;
  limit?: number;
}

interface SearchResult {
  contacts: any[];
  projects: any[];
  quotes: any[];
  appointments: any[];
  totalResults: number;
  searchTime: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  
  try {
    const { 
      query, 
      entities = ['contacts', 'projects', 'quotes', 'appointments'],
      locationId,
      limit = 10 
    } = req.body as SearchRequest;

    // Validation
    if (!query || !locationId) {
      return sendError(res, 'Missing required fields: query, locationId');
    }

    if (query.length < 2) {
      return sendError(res, 'Search query must be at least 2 characters');
    }

    const client = await clientPromise;
    const db = client.db('lpai');

    // Prepare search results
    const results: SearchResult = {
      contacts: [],
      projects: [],
      quotes: [],
      appointments: [],
      totalResults: 0,
      searchTime: 0
    };

    // Build search queries for each entity
    const searchPromises = [];

    // 1. Search Contacts
    if (entities.includes('contacts')) {
      searchPromises.push(
        searchContacts(db, locationId, query, limit)
          .then(contacts => {
            results.contacts = contacts;
            results.totalResults += contacts.length;
          })
      );
    }

    // 2. Search Projects
    if (entities.includes('projects')) {
      searchPromises.push(
        searchProjects(db, locationId, query, limit)
          .then(projects => {
            results.projects = projects;
            results.totalResults += projects.length;
          })
      );
    }

    // 3. Search Quotes
    if (entities.includes('quotes')) {
      searchPromises.push(
        searchQuotes(db, locationId, query, limit)
          .then(quotes => {
            results.quotes = quotes;
            results.totalResults += quotes.length;
          })
      );
    }

    // 4. Search Appointments
    if (entities.includes('appointments')) {
      searchPromises.push(
        searchAppointments(db, locationId, query, limit)
          .then(appointments => {
            results.appointments = appointments;
            results.totalResults += appointments.length;
          })
      );
    }

    // Execute all searches in parallel
    await Promise.all(searchPromises);

    // Calculate search time
    results.searchTime = Date.now() - startTime;

    return sendSuccess(res, results, `Found ${results.totalResults} results in ${results.searchTime}ms`);

  } catch (error) {
    console.error('[Global Search] Error:', error);
    return sendError(res, 'Search failed', 500);
  }
}

// Search helper functions
async function searchContacts(db: any, locationId: string, query: string, limit: number) {
  const searchRegex = new RegExp(query, 'i');
  
  return db.collection('contacts')
    .find({
      locationId,
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { companyName: searchRegex }
      ]
    })
    .project({
      firstName: 1,
      lastName: 1,
      email: 1,
      phone: 1,
      companyName: 1,
      createdAt: 1,
      _id: 1
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

async function searchProjects(db: any, locationId: string, query: string, limit: number) {
  const searchRegex = new RegExp(query, 'i');
  
  const projects = await db.collection('projects')
    .find({
      locationId,
      $or: [
        { title: searchRegex },
        { notes: searchRegex },
        { scopeOfWork: searchRegex },
        { products: searchRegex }
      ]
    })
    .project({
      title: 1,
      status: 1,
      contactId: 1,
      createdAt: 1,
      monetaryValue: 1,
      _id: 1
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  // Enrich with contact names
  const contactIds = projects.map(p => new ObjectId(p.contactId)).filter(Boolean);
  if (contactIds.length > 0) {
    const contacts = await db.collection('contacts')
      .find({ _id: { $in: contactIds } })
      .project({ firstName: 1, lastName: 1 })
      .toArray();
    
    const contactMap = new Map(contacts.map(c => [c._id.toString(), c]));
    
    projects.forEach(project => {
      const contact = contactMap.get(project.contactId);
      project.contactName = contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown';
    });
  }

  return projects;
}

async function searchQuotes(db: any, locationId: string, query: string, limit: number) {
  const searchRegex = new RegExp(query, 'i');
  
  // Try to parse as quote number
  const isQuoteNumber = /^Q-\d{4}-\d{3}$/i.test(query);
  
  const searchQuery = {
    locationId,
    $or: [
      { quoteNumber: searchRegex },
      { title: searchRegex },
      { description: searchRegex },
      { 'sections.name': searchRegex },
      { 'sections.lineItems.name': searchRegex }
    ]
  };

  // If it looks like a quote number, prioritize exact match
  if (isQuoteNumber) {
    searchQuery.$or.unshift({ quoteNumber: query.toUpperCase() });
  }

  return db.collection('quotes')
    .find(searchQuery)
    .project({
      quoteNumber: 1,
      title: 1,
      status: 1,
      total: 1,
      contactId: 1,
      projectId: 1,
      createdAt: 1,
      _id: 1
    })
    .sort(isQuoteNumber ? { quoteNumber: -1 } : { createdAt: -1 })
    .limit(limit)
    .toArray();
}

async function searchAppointments(db: any, locationId: string, query: string, limit: number) {
  const searchRegex = new RegExp(query, 'i');
  
  return db.collection('appointments')
    .find({
      locationId,
      $or: [
        { title: searchRegex },
        { notes: searchRegex },
        { contactName: searchRegex },
        { address: searchRegex }
      ]
    })
    .project({
      title: 1,
      start: 1,
      end: 1,
      contactName: 1,
      status: 1,
      calendarId: 1,
      _id: 1
    })
    .sort({ start: -1 })
    .limit(limit)
    .toArray();
}