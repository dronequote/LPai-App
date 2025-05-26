// pages/api/templates/[locationId]/copy/[globalTemplateId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { locationId, globalTemplateId } = req.query;
  
  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }
  
  if (!globalTemplateId || typeof globalTemplateId !== 'string') {
    return res.status(400).json({ error: 'Missing globalTemplateId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // Find the global template
    let globalTemplate;
    if (ObjectId.isValid(globalTemplateId)) {
      globalTemplate = await db.collection('templates').findOne({
        _id: new ObjectId(globalTemplateId),
        isGlobal: true
      });
    } else {
      globalTemplate = await db.collection('templates').findOne({
        _id: globalTemplateId,
        isGlobal: true
      });
    }
    
    if (!globalTemplate) {
      return res.status(404).json({ error: 'Global template not found' });
    }
    
    // Check if location already has this template
    const existingCopy = await db.collection('templates').findOne({
      locationId,
      sourceTemplateId: globalTemplate._id.toString(),
      isGlobal: false
    });
    
    if (existingCopy) {
      return res.status(409).json({ 
        error: 'Template already copied to this location',
        existingTemplate: existingCopy
      });
    }
    
    // Create the copy
    const { _id, createdAt, updatedAt, createdBy, ...templateData } = globalTemplate;
    
    const locationTemplate = {
      ...templateData,
      locationId,
      isGlobal: false,
      sourceTemplateId: globalTemplate._id.toString(),
      name: `${templateData.name} (Copy)`, // Indicate it's a copy
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    
    // Allow customization during copy
    if (req.body.customizations) {
      Object.assign(locationTemplate, req.body.customizations);
    }
    
    const result = await db.collection('templates').insertOne(locationTemplate);
    const createdTemplate = { ...locationTemplate, _id: result.insertedId };
    
    console.log(`[TEMPLATES API] Copied global template "${globalTemplate.name}" to location ${locationId}`);
    return res.status(201).json(createdTemplate);
    
  } catch (error) {
    console.error('[TEMPLATES API] Error copying template:', error);
    return res.status(500).json({ error: 'Failed to copy template' });
  }
}