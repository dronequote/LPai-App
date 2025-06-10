// pages/api/search/global-optimized.ts
// This version uses MongoDB text indexes for better performance

import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendSuccess, sendError } from '../../../src/utils/response';

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
    } = req.body;

    // Validation
    if (!query || !locationId) {
      return sendError(res, 'Missing required fields: query, locationId');
    }

    if (query.length < 2) {
      return sendError(res, 'Search query must be at least 2 characters');
    }

    const client = await clientPromise;
    const db = client.db('lpai');

    // Results object
    const results = {
      contacts: [],
      projects: [],
      quotes: [],
      appointments: [],
      totalResults: 0,
      searchTime: 0,
      query,
      highlightedQuery: query // For frontend highlighting
    };

    // Execute searches in parallel using text indexes
    const searchPromises = [];

    if (entities.includes('contacts')) {
      searchPromises.push(
        db.collection('contacts')
          .find({
            locationId,
            $text: { $search: query }
          })
          .project({
            score: { $meta: "textScore" },
            firstName: 1,
            lastName: 1,
            email: 1,
            phone: 1,
            companyName: 1,
            createdAt: 1
          })
          .sort({ score: { $meta: "textScore" }, createdAt: -1 })
          .limit(limit)
          .toArray()
          .then(contacts => {
            results.contacts = contacts;
            results.totalResults += contacts.length;
          })
          .catch(() => {
            // Fallback to regex if text search fails
            return searchContactsFallback(db, locationId, query, limit)
              .then(contacts => {
                results.contacts = contacts;
                results.totalResults += contacts.length;
              });
          })
      );
    }

    if (entities.includes('projects')) {
      searchPromises.push(
        db.collection('projects')
          .find({
            locationId,
            $text: { $search: query }
          })
          .project({
            score: { $meta: "textScore" },
            title: 1,
            status: 1,
            contactId: 1,
            createdAt: 1,
            monetaryValue: 1
          })
          .sort({ score: { $meta: "textScore" }, createdAt: -1 })
          .limit(limit)
          .toArray()
          .then(async projects => {
            // Enrich with contact names
            await enrichProjectsWithContacts(db, projects);
            results.projects = projects;
            results.totalResults += projects.length;
          })
          .catch(() => {
            return searchProjectsFallback(db, locationId, query, limit)
              .then(projects => {
                results.projects = projects;
                results.totalResults += projects.length;
              });
          })
      );
    }

    if (entities.includes('quotes')) {
      searchPromises.push(
        db.collection('quotes')
          .find({
            locationId,
            $text: { $search: query }
          })
          .project({
            score: { $meta: "textScore" },
            quoteNumber: 1,
            title: 1,
            status: 1,
            total: 1,
            contactId: 1,
            projectId: 1,
            createdAt: 1
          })
          .sort({ score: { $meta: "textScore" }, createdAt: -1 })
          .limit(limit)
          .toArray()
          .then(quotes => {
            results.quotes = quotes;
            results.totalResults += quotes.length;
          })
          .catch(() => {
            return searchQuotesFallback(db, locationId, query, limit)
              .then(quotes => {
                results.quotes = quotes;
                results.totalResults += quotes.length;
              });
          })
      );
    }

    if (entities.includes('appointments')) {
      searchPromises.push(
        db.collection('appointments')
          .find({
            locationId,
            $text: { $search: query }
          })
          .project({
            score: { $meta: "textScore" },
            title: 1,
            start: 1,
            end: 1,
            contactName: 1,
            status: 1,
            calendarId: 1
          })
          .sort({ score: { $meta: "textScore" }, start: -1 })
          .limit(limit)
          .toArray()
          .then(appointments => {
            results.appointments = appointments;
            results.totalResults += appointments.length;
          })
          .catch(() => {
            return searchAppointmentsFallback(db, locationId, query, limit)
              .then(appointments => {
                results.appointments = appointments;
                results.totalResults += appointments.length;
              });
          })
      );
    }

    // Wait for all searches to complete
    await Promise.all(searchPromises);

    // Calculate search time
    results.searchTime = Date.now() - startTime;

    // Clean up scores from results (frontend doesn't need them)
    ['contacts', 'projects', 'quotes', 'appointments'].forEach(entity => {
      results[entity] = results[entity].map(item => {
        const { score, ...rest } = item;
        return rest;
      });
    });

    return sendSuccess(res, results, `Found ${results.totalResults} results in ${results.searchTime}ms`);

  } catch (error) {
    console.error('[Global Search] Error:', error);
    return sendError(res, 'Search failed', 500);
  }
}

// Fallback functions for when text indexes aren't available
async function searchContactsFallback(db: any, locationId: string, query: string, limit: number) {
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
    .limit(limit)
    .toArray();
}

async function searchProjectsFallback(db: any, locationId: string, query: string, limit: number) {
  const searchRegex = new RegExp(query, 'i');
  const projects = await db.collection('projects')
    .find({
      locationId,
      $or: [
        { title: searchRegex },
        { notes: searchRegex },
        { scopeOfWork: searchRegex }
      ]
    })
    .limit(limit)
    .toArray();
  
  await enrichProjectsWithContacts(db, projects);
  return projects;
}

async function searchQuotesFallback(db: any, locationId: string, query: string, limit: number) {
  const searchRegex = new RegExp(query, 'i');
  return db.collection('quotes')
    .find({
      locationId,
      $or: [
        { quoteNumber: searchRegex },
        { title: searchRegex },
        { description: searchRegex }
      ]
    })
    .limit(limit)
    .toArray();
}

async function searchAppointmentsFallback(db: any, locationId: string, query: string, limit: number) {
  const searchRegex = new RegExp(query, 'i');
  return db.collection('appointments')
    .find({
      locationId,
      $or: [
        { title: searchRegex },
        { notes: searchRegex },
        { contactName: searchRegex }
      ]
    })
    .limit(limit)
    .toArray();
}

async function enrichProjectsWithContacts(db: any, projects: any[]) {
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
}