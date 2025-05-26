// pages/api/templates/[locationId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;
  
  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return await getLocationTemplates(db, locationId, res);
    case 'POST':
      return await createLocationTemplate(db, locationId, req.body, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// Get location templates + global templates for copying
async function getLocationTemplates(db: any, locationId: string, res: NextApiResponse) {
  try {
    // Get location's custom templates
    const locationTemplates = await db.collection('templates').find({ 
      locationId,
      isGlobal: false 
    }).sort({ name: 1 }).toArray();
    
    // Get global templates for reference
    const globalTemplates = await db.collection('templates').find({ 
      isGlobal: true 
    }).sort({ category: 1, name: 1 }).toArray();
    
    console.log(`[TEMPLATES API] Location ${locationId}: ${locationTemplates.length} custom, ${globalTemplates.length} global templates`);
    
    return res.status(200).json({
      locationTemplates,
      globalTemplates
    });
  } catch (error) {
    console.error('[TEMPLATES API] Error fetching location templates:', error);
    return res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

// Create location template (custom or copy from global)
async function createLocationTemplate(db: any, locationId: string, body: any, res: NextApiResponse) {
  try {
    const template = {
      ...body,
      locationId,
      isGlobal: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const result = await db.collection('templates').insertOne(template);
    const createdTemplate = { ...template, _id: result.insertedId };
    
    console.log(`[TEMPLATES API] Created template for location ${locationId}: ${template.name}`);
    return res.status(201).json(createdTemplate);
  } catch (error) {
    console.error('[TEMPLATES API] Error creating location template:', error);
    return res.status(500).json({ error: 'Failed to create template' });
  }
}