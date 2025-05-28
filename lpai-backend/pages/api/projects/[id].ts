// pages/api/projects/[id].ts - UPDATED to use location-specific custom field IDs
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, locationId } = req.query;

  // 🔒 SECURITY: Validate required parameters
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid project ID' });
  }
  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId - required for security' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    switch (req.method) {
      case 'GET':
        return await getEnhancedProject(db, id, locationId, res);
      
      case 'PATCH':
        return await updateProjectWithSmartSync(db, id, locationId, req.body, res);
      
      case 'DELETE':
        return await softDeleteProject(db, id, locationId, res);
      
      default:
        res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('❌ [API] /api/projects/[id] error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// 📖 GET Enhanced Project with ALL details
async function getEnhancedProject(db: any, id: string, locationId: string, res: NextApiResponse) {
  try {
    console.log(`📖 [API] Fetching enhanced project ${id} for location ${locationId}`);

    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid project ID format' });
    }

    // 🔒 SECURITY: Get project with locationId validation + contact requirement
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      locationId: locationId,
      contactId: { $exists: true, $ne: null } // Must have valid contact
    });

    if (!project) {
      return res.status(404).json({ 
        error: 'Project not found or access denied' 
      });
    }

    // 👥 ENRICH: Get full contact details
    let contactDetails = null;
    try {
      const contactObjectId = ObjectId.isValid(project.contactId) 
        ? new ObjectId(project.contactId) 
        : project.contactId;
      
      contactDetails = await db.collection('contacts').findOne({
        $or: [
          { _id: contactObjectId },
          { _id: project.contactId },
          { contactId: project.contactId }
        ],
        locationId: locationId
      });

      if (!contactDetails) {
        console.warn(`⚠️ Contact ${project.contactId} not found for project ${id}`);
      }
    } catch (err) {
      console.error('❌ Failed to fetch contact details:', err);
    }

    // 🗂️ ENRICH: Get other projects for this contact
    let otherProjects = [];
    if (project.contactId) {
      try {
        otherProjects = await db.collection('projects').find({
          contactId: project.contactId,
          locationId: locationId,
          _id: { $ne: new ObjectId(id) },
          status: { $ne: 'Deleted' } // Exclude deleted projects
        }).sort({ createdAt: -1 }).limit(5).toArray();
      } catch (err) {
        console.warn('⚠️ Failed to fetch other projects:', err);
      }
    }

    // 📅 ENRICH: Get upcoming appointments for this contact
    let upcomingAppointments = [];
    if (project.contactId) {
      try {
        const now = new Date();
        upcomingAppointments = await db.collection('appointments').find({
          contactId: project.contactId,
          locationId: locationId,
          $or: [
            { start: { $gt: now } },
            { time: { $gt: now } }
          ],
          status: { $ne: 'cancelled' }
        }).sort({ $or: [{ start: 1 }, { time: 1 }] }).limit(3).toArray();
      } catch (err) {
        console.warn('⚠️ Failed to fetch appointments:', err);
      }
    }

    // 🔧 BUILD: Enhanced project response
    const enhancedProject = {
      ...project,
      
      // 👥 Contact information
      contact: contactDetails,
      contactName: contactDetails 
        ? `${contactDetails.firstName} ${contactDetails.lastName}`
        : project.contactName || 'Unknown Contact',
      
      // 🗂️ Related data
      otherProjects: otherProjects,
      upcomingAppointments: upcomingAppointments,
      
      // 📋 Initialize enhanced fields if missing
      milestones: project.milestones || [
        { id: '1', title: 'Initial consultation', completed: true, createdAt: new Date() },
        { id: '2', title: 'Site survey', completed: true, createdAt: new Date() },
        { id: '3', title: 'Materials ordered', completed: false, createdAt: new Date() },
        { id: '4', title: 'Installation complete', completed: false, createdAt: new Date() },
        { id: '5', title: 'Final inspection', completed: false, createdAt: new Date() },
      ],
      photos: project.photos || [],
      documents: project.documents || [],
      timeline: project.timeline || [],
      customFields: project.customFields || {},
      
      // 📊 Computed progress fields
      completedMilestones: (project.milestones || []).filter((m: any) => m.completed).length,
      totalMilestones: (project.milestones || []).length,
      progressPercentage: project.milestones?.length > 0 
        ? Math.round(((project.milestones.filter((m: any) => m.completed).length) / project.milestones.length) * 100)
        : 0,
      
      // 📅 Timestamps
      createdAt: project.createdAt || project._id.getTimestamp(),
      updatedAt: project.updatedAt || new Date(),
    };

    console.log(`✅ [API] Successfully fetched enhanced project ${id}`);
    return res.status(200).json(enhancedProject);

  } catch (error) {
    console.error('❌ [API] Error fetching enhanced project:', error);
    return res.status(500).json({ error: 'Failed to fetch project details' });
  }
}

// ✏️ UPDATE Project - GHL First, MongoDB Second
async function updateProjectWithSmartSync(db: any, id: string, locationId: string, updateData: any, res: NextApiResponse) {
  try {
    console.log(`✏️ [API] Updating project ${id} for location ${locationId}`);

    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid project ID format' });
    }

    // 🔒 Get existing project
    const existingProject = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      locationId: locationId,
      contactId: { $exists: true, $ne: null }
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // 🔄 GHL UPDATE FIRST - Only if we have GHL opportunity ID
    if (existingProject.ghlOpportunityId && existingProject.locationId) {
      
      // Get API key
      const locationDoc = await db.collection('locations').findOne({ locationId: existingProject.locationId });
      const apiKey = locationDoc?.apiKey;
      
      if (!apiKey) {
        return res.status(400).json({ error: 'No API key found for location' });
      }

      // ✅ NEW: Get related quote data for custom fields
      let quoteData = null;
      try {
        if (updateData.quoteId || existingProject.quoteId) {
          const quoteId = updateData.quoteId || existingProject.quoteId;
          quoteData = await db.collection('quotes').findOne({
            _id: new ObjectId(quoteId),
            locationId: locationId
          });
          console.log('📋 [GHL Update] Found quote data for custom fields:', quoteData?.quoteNumber);
        }
      } catch (err) {
        console.warn('⚠️ [GHL Update] Could not fetch quote data:', err);
      }

      // ✅ UPDATED: Build custom fields with location-specific IDs
      const customFields = await buildCustomFields(db, locationId, updateData, existingProject, quoteData);

      // Build GHL request - EXACT format with custom fields
      const options = {
        method: 'PUT',
        url: `https://services.leadconnectorhq.com/opportunities/${existingProject.ghlOpportunityId}`,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        data: {
          name: updateData.title || existingProject.title,
          customFields: customFields // ✅ Real custom fields with IDs and values
        }
      };

      // 🚀 Log what we're sending
      console.log('🚀 SENDING TO GHL:');
      console.log('URL:', options.url);
      console.log('HEADERS:', { ...options.headers, Authorization: `Bearer ${apiKey?.slice(0, 8)}...${apiKey?.slice(-4)}` });
      console.log('DATA:', JSON.stringify(options.data, null, 2));

      try {
        const { data } = await axios.request(options);
        console.log('✅ GHL SUCCESS:', data);
        console.log('✅ Custom fields updated in GHL opportunity');
        
        // GHL succeeded, now update MongoDB
      } catch (ghlError: any) {
        console.error('❌ GHL FAILED:', ghlError.response?.status, ghlError.response?.data);
        return res.status(400).json({ 
          error: 'Failed to update GHL opportunity',
          ghlError: ghlError.response?.data || ghlError.message
        });
      }
    }

    // 💾 MongoDB UPDATE - Only happens if GHL succeeded or no GHL ID
    const {
      _id,
      locationId: _,
      createdAt,
      contact,
      otherProjects,
      upcomingAppointments,
      completedMilestones,
      totalMilestones,
      progressPercentage,
      ...validUpdateData
    } = updateData;

    const finalUpdateData = {
      ...validUpdateData,
      updatedAt: new Date()
    };

    const result = await db.collection('projects').findOneAndUpdate(
      { 
        _id: new ObjectId(id),
        locationId: locationId 
      },
      { $set: finalUpdateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Project not found during update' });
    }

    console.log('✅ MongoDB update successful');

    return res.status(200).json({
      success: true,
      project: result.value,
      ghlSynced: !!existingProject.ghlOpportunityId,
      customFieldsUpdated: !!existingProject.ghlOpportunityId
    });

  } catch (error) {
    console.error('❌ [API] Error updating project:', error);
    return res.status(500).json({ error: 'Failed to update project' });
  }
}

// ✅ UPDATED: Build custom fields with location-specific IDs
async function buildCustomFields(
  db: any,
  locationId: string,
  updateData: any, 
  existingProject: any, 
  quoteData: any
) {
  // ✅ NEW: Fetch custom field IDs from location
  const location = await db.collection('locations').findOne({ locationId });
  const customFieldIds = location?.ghlCustomFields;
  
  if (!customFieldIds) {
    console.warn('⚠️ No custom field IDs configured for location:', locationId);
    return [];
  }
  
  const customFields = [];
  
  // ✅ Project Title (always update if provided)
  if ((updateData.title || existingProject.title) && customFieldIds.project_title) {
    customFields.push({
      id: customFieldIds.project_title,
      fieldValue: updateData.title || existingProject.title
    });
  }
  
  // ✅ Quote Number (from quote data if available)
  if (quoteData?.quoteNumber && customFieldIds.quote_number) {
    customFields.push({
      id: customFieldIds.quote_number,
      fieldValue: quoteData.quoteNumber
    });
  }
  
  // ✅ Signed Date (only if provided - used when contract is signed)
  if (updateData.signedDate && customFieldIds.signed_date) {
    customFields.push({
      id: customFieldIds.signed_date,
      fieldValue: updateData.signedDate
    });
  }
  
  console.log('🔧 [Custom Fields] Built custom fields for location', locationId, ':', customFields);
  return customFields;
}

// ✅ UPDATED: Helper function to use location-specific field IDs
export async function updateOpportunityCustomFields(
  db: any, 
  projectId: string, 
  locationId: string, 
  customFieldUpdates: { [key: string]: string }
) {
  try {
    console.log('🔄 [Opportunity Update] Starting custom field update for project:', projectId);
    
    // Get project with GHL opportunity ID
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      locationId: locationId,
      ghlOpportunityId: { $exists: true, $ne: null }
    });

    if (!project?.ghlOpportunityId) {
      console.warn('⚠️ [Opportunity Update] No GHL opportunity ID found');
      return { success: false, reason: 'No GHL opportunity ID' };
    }

    // Get API key AND custom field IDs from location
    const locationDoc = await db.collection('locations').findOne({ locationId });
    const apiKey = locationDoc?.apiKey;
    const customFieldIds = locationDoc?.ghlCustomFields;
    
    if (!apiKey) {
      console.error('❌ [Opportunity Update] No API key found');
      return { success: false, reason: 'No API key' };
    }
    
    if (!customFieldIds) {
      console.error('❌ [Opportunity Update] No custom field IDs configured');
      return { success: false, reason: 'No custom field IDs configured' };
    }

    // Build custom fields array from updates using location-specific IDs
    const customFields = Object.entries(customFieldUpdates)
      .map(([key, value]) => ({
        id: customFieldIds[key],
        fieldValue: value
      }))
      .filter(field => field.id); // Only include valid field IDs

    if (customFields.length === 0) {
      console.warn('⚠️ [Opportunity Update] No valid custom fields to update');
      return { success: false, reason: 'No valid custom fields' };
    }

    // Update GHL opportunity
    const response = await axios.put(
      `https://services.leadconnectorhq.com/opportunities/${project.ghlOpportunityId}`,
      {
        name: project.title, // Keep existing name
        customFields: customFields
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ [Opportunity Update] Custom fields updated successfully');
    return { 
      success: true, 
      opportunityId: project.ghlOpportunityId,
      fieldsUpdated: customFields.length
    };

  } catch (error) {
    console.error('❌ [Opportunity Update] Failed to update custom fields:', error);
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
}

// 🗑️ SOFT DELETE Project
async function softDeleteProject(db: any, id: string, locationId: string, res: NextApiResponse) {
  try {
    console.log(`🗑️ [API] Soft deleting project ${id} for location ${locationId}`);

    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid project ID format' });
    }

    // 🔒 SECURITY: Verify project exists and belongs to location
    const existingProject = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      locationId: locationId
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // 💾 SOFT DELETE: Set status to 'Deleted'
    const result = await db.collection('projects').findOneAndUpdate(
      { 
        _id: new ObjectId(id),
        locationId: locationId 
      },
      { 
        $set: { 
          status: 'Deleted',
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Project not found during deletion' });
    }

    console.log(`✅ [API] Successfully deleted project ${id}`);
    return res.status(200).json({ 
      success: true, 
      message: 'Project deleted successfully' 
    });

  } catch (error) {
    console.error('❌ [API] Error deleting project:', error);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
}