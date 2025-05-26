// pages/api/templates/[locationId]/[templateId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId, templateId } = req.query;
  
  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }
  
  if (!templateId || typeof templateId !== 'string') {
    return res.status(400).json({ error: 'Missing templateId' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return await getTemplate(db, locationId, templateId, res);
    case 'PATCH':
      return await updateTemplate(db, locationId, templateId, req.body, res);
    case 'DELETE':
      return await deleteTemplate(db, locationId, templateId, res);
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// Get specific template (location or global)
async function getTemplate(db: any, locationId: string, templateId: string, res: NextApiResponse) {
  try {
    let template;
    
    // Try location template first
    if (ObjectId.isValid(templateId)) {
      template = await db.collection('templates').findOne({
        _id: new ObjectId(templateId),
        $or: [
          { locationId, isGlobal: false },
          { isGlobal: true }
        ]
      });
    } else {
      // Handle string IDs for global templates
      template = await db.collection('templates').findOne({
        $or: [
          { _id: templateId, isGlobal: true },
          { locationId, isGlobal: false, _id: templateId }
        ]
      });
    }
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Add computed fields for presentation
    const enrichedTemplate = {
      ...template,
      isEditable: !template.isGlobal, // Global templates can't be edited directly
      enabledSectionsCount: template.sections?.filter(s => s.enabled).length || 0
    };
    
    console.log(`[TEMPLATES API] Retrieved template: ${template.name}`);
    return res.status(200).json(enrichedTemplate);
  } catch (error) {
    console.error('[TEMPLATES API] Error fetching template:', error);
    return res.status(500).json({ error: 'Failed to fetch template' });
  }
}

// Update location template
async function updateTemplate(db: any, locationId: string, templateId: string, body: any, res: NextApiResponse) {
  try {
    if (!ObjectId.isValid(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID format' });
    }
    
    // Ensure we can only update location templates, not global ones
    const existingTemplate = await db.collection('templates').findOne({
      _id: new ObjectId(templateId),
      locationId,
      isGlobal: false
    });
    
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found or not editable' });
    }
    
    const updateData = {
      ...body,
      locationId, // Ensure locationId doesn't change
      isGlobal: false, // Ensure this stays false
      updatedAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    
    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.sourceTemplateId; // Don't allow changing the source
    
    const result = await db.collection('templates').findOneAndUpdate(
      { _id: new ObjectId(templateId), locationId, isGlobal: false },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    console.log(`[TEMPLATES API] Updated template: ${result.value.name}`);
    return res.status(200).json(result.value);
  } catch (error) {
    console.error('[TEMPLATES API] Error updating template:', error);
    return res.status(500).json({ error: 'Failed to update template' });
  }
}

// Delete location template
async function deleteTemplate(db: any, locationId: string, templateId: string, res: NextApiResponse) {
  try {
    if (!ObjectId.isValid(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID format' });
    }
    
    const result = await db.collection('templates').deleteOne({
      _id: new ObjectId(templateId),
      locationId,
      isGlobal: false // Can only delete location templates
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Template not found or cannot be deleted' });
    }
    
    console.log(`[TEMPLATES API] Deleted template ${templateId} for location ${locationId}`);
    return res.status(200).json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('[TEMPLATES API] Error deleting template:', error);
    return res.status(500).json({ error: 'Failed to delete template' });
  }
}