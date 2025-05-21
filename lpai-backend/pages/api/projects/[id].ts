// pages/api/projects/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid project ID' });
  }

  // GET: Fetch a single project
  if (req.method === 'GET') {
    try {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
      if (!project) return res.status(404).json({ error: 'Project not found' });
      return res.status(200).json(project);
    } catch (err) {
      console.error('❌ Failed to fetch project:', err);
      return res.status(500).json({ error: 'Failed to fetch project' });
    }
  }

  // PATCH: Update project (with support for custom fields) + sync to GHL if linked
  if (req.method === 'PATCH') {
    try {
      // Pick standard fields; everything else = custom
      const {
        title,
        status,
        notes,
        contactId,
        userId,
        locationId,
        quoteId,
        ghlOpportunityId,
        ...customFields // catch-all for everything else!
      } = req.body;

      // 1. Update in MongoDB
      const setObj: any = {
        updatedAt: new Date(),
      };
      if (title !== undefined) setObj.title = title;
      if (status !== undefined) setObj.status = status;
      if (notes !== undefined) setObj.notes = notes;
      if (contactId !== undefined) setObj.contactId = contactId;
      if (userId !== undefined) setObj.userId = userId;
      if (locationId !== undefined) setObj.locationId = locationId;
      if (quoteId !== undefined) setObj.quoteId = quoteId;
      if (ghlOpportunityId !== undefined) setObj.ghlOpportunityId = ghlOpportunityId;
      if (Object.keys(customFields).length > 0) setObj.custom = { ...customFields };

      const result = await db.collection('projects').updateOne(
        { _id: new ObjectId(id) },
        { $set: setObj }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const updated = await db.collection('projects').findOne({ _id: new ObjectId(id) });

      // (Optional) Sync to GHL opportunity if linked
      if (updated?.ghlOpportunityId && updated?.locationId) {
        const locationDoc = await db.collection('locations').findOne({ locationId: updated.locationId });
        const apiKey = locationDoc?.apiKey;
        if (apiKey) {
          try {
            const ghlPayload = {
              name: updated.title,          // GHL "Opportunity Name"
              status: updated.status,       // GHL Pipeline Stage or similar
              notes: updated.notes,         // If you use a notes/custom field in GHL
              // (Don't send "custom" fields to GHL)
            };
            await axios.put(
              `https://services.leadconnectorhq.com/opportunities/${updated.ghlOpportunityId}`,
              ghlPayload,
              {
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                  Version: '2021-07-28',
                },
              }
            );
            console.log('✅ Project synced to GHL Opportunity:', updated.ghlOpportunityId);
          } catch (syncErr: any) {
            console.warn('⚠️ Failed to sync project with GHL:', syncErr.response?.data || syncErr.message);
            // Still succeed locally
          }
        }
      }

      return res.status(200).json({ success: true, project: updated });
    } catch (err) {
      console.error('❌ Failed to update project:', err);
      return res.status(500).json({ error: 'Failed to update project' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
