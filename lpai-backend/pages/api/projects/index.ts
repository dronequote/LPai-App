import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';

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

  // POST: Create a new project (sync to GHL if possible)
  else if (req.method === 'POST') {
    try {
      const { contactId, userId, locationId, title, status, ...rest } = req.body;
      if (!contactId || !userId || !locationId || !title) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Allow any extra fields (scopeOfWork, products, etc.)
      const projectData = {
        contactId, userId, locationId, title, status, ...rest,
        createdAt: new Date(),
      };

      // 1️⃣ Save project in MongoDB
      const result = await db.collection('projects').insertOne(projectData);

      // 2️⃣ Try to push to GHL as "opportunity" if we have what we need
      let ghlOpportunityId;
      try {
        // Find GHL contact ID
        const mongoContact = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });
        const ghlContactId = mongoContact?.ghlContactId;
        const locationDoc = await db.collection('locations').findOne({ locationId });
        const apiKey = locationDoc?.apiKey;
        const pipelineId = locationDoc?.pipelineId; // must be set in your locations collection

        if (apiKey && ghlContactId && pipelineId) {
          const ghlPayload = {
            contactId: ghlContactId,
            pipelineId,
            status: status || 'open',
            name: title,
            notes: rest.notes || '', // pass notes if available
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
          console.log({ apiKey, ghlContactId, pipelineId });
        }
      } catch (err: any) {
        console.error('❌ Failed to sync opportunity with GHL:', err.response?.data || err.message);
      }

      return res.status(201).json({ success: true, projectId: result.insertedId, ghlOpportunityId });
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
