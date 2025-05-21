import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  // GET: Return all projects for a location, enriched with contact info
  if (req.method === 'GET') {
    try {
      const locationId = req.query.locationId as string;
      if (!locationId) {
        return res.status(403).json({ error: 'Missing locationId' });
      }

      // 1. Get all projects for this location
      const projects = await db
        .collection('projects')
        .find({ locationId })
        .sort({ createdAt: -1 })
        .toArray();

      // 2. Lookup all related contacts
      const contactIds = projects.map(p => p.contactId).filter(Boolean);
      const contacts = await db
        .collection('contacts')
        .find({ _id: { $in: contactIds.map(id => new ObjectId(id)) } })
        .toArray();

      // 3. Map contactId => contact info
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

      // 4. Attach contact info to each project
      const enriched = projects.map(p => {
        const contact = contactMap[p.contactId?.toString()];
        return {
          ...p,
          contactName: contact?.name || '—',
          contactEmail: contact?.email || '',
          contactPhone: contact?.phone || '',
        };
      });

      res.status(200).json(enriched);
    } catch (err) {
      console.error('❌ Failed to load all projects:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST: Create a new project (flexible, allows any fields)
  else if (req.method === 'POST') {
    try {
      const { contactId, userId, locationId, title } = req.body;
      if (!contactId || !userId || !locationId || !title) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Allow any extra fields (for custom/dynamic project fields)
      const projectData = {
        ...req.body,
        createdAt: new Date(),
      };

      const result = await db.collection('projects').insertOne(projectData);

      return res.status(201).json({ success: true, projectId: result.insertedId });
    } catch (err) {
      console.error('❌ Failed to create project:', err);
      res.status(500).json({ error: 'Failed to create project' });
    }
  }

  // Method not allowed
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
