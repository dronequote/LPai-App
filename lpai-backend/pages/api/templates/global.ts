// pages/api/templates/global.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return await getGlobalTemplates(db, res);
    case 'POST':
      return await createGlobalTemplate(db, req.body, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// Get all global templates
async function getGlobalTemplates(db: any, res: NextApiResponse) {
  try {
    const templates = await db.collection('templates').find({ 
      isGlobal: true 
    }).sort({ category: 1, name: 1 }).toArray();
    
    console.log(`[TEMPLATES API] Found ${templates.length} global templates`);
    return res.status(200).json(templates);
  } catch (error) {
    console.error('[TEMPLATES API] Error fetching global templates:', error);
    return res.status(500).json({ error: 'Failed to fetch global templates' });
  }
}

// Create global template (admin only)
async function createGlobalTemplate(db: any, body: any, res: NextApiResponse) {
  try {
    const template = {
      ...body,
      isGlobal: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: body.createdBy || 'admin'
    };
    
    const result = await db.collection('templates').insertOne(template);
    const createdTemplate = { ...template, _id: result.insertedId };
    
    console.log(`[TEMPLATES API] Created global template: ${template.name}`);
    return res.status(201).json(createdTemplate);
  } catch (error) {
    console.error('[TEMPLATES API] Error creating global template:', error);
    return res.status(500).json({ error: 'Failed to create global template' });
  }
}