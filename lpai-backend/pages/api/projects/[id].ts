// pages/api/projects/[id].ts - UPDATED to use location-specific custom field IDs
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, locationId } = req.query;

  console.log('🚀🚀🚀 [API] /api/projects/[id] HANDLER CALLED 🚀🚀🚀');
  console.log('Method:', req.method);
  console.log('Project ID:', id);
  console.log('Location ID (query):', locationId);
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // 🔒 SECURITY: Validate required parameters
  if (!id || typeof id !== 'string') {
    console.error('❌ Missing or invalid project ID');
    return res.status(400).json({ error: 'Missing or invalid project ID' });
  }
  if (!locationId || typeof locationId !== 'string') {
    console.error('❌ Missing locationId - required for security');
    return res.status(400).json({ error: 'Missing locationId - required for security' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    switch (req.method) {
      case 'GET':
        return await getEnhancedProject(db, id, locationId, res);
      
      case 'PATCH':
        console.log('📝 [API] Routing to updateProjectWithSmartSync...');
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
  console.log('🚀🚀🚀 [API] PATCH updateProjectWithSmartSync STARTED 🚀🚀🚀');
  console.log('Project ID:', id);
  console.log('Location ID:', locationId);
  console.log('Update Data:', JSON.stringify(updateData, null, 2));
  
  try {
    console.log(`✏️ [API] Updating project ${id} for location ${locationId}`);
    console.log('📝 [API] Update data received:', updateData);

    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      console.error('❌ Invalid project ID format:', id);
      return res.status(400).json({ error: 'Invalid project ID format' });
    }

    // 🔒 Get existing project
    console.log('🔍 [API] Looking for project in MongoDB...');
    const existingProject = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      locationId: locationId,
      contactId: { $exists: true, $ne: null }
    });

    if (!existingProject) {
      console.error('❌ Project not found or access denied');
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    console.log('📋 [API] Existing project found:', {
      id: existingProject._id,
      title: existingProject.title,
      ghlOpportunityId: existingProject.ghlOpportunityId,
      quoteId: existingProject.quoteId
    });

    // 🔄 GHL UPDATE FIRST - Only if we have GHL opportunity ID
    if (existingProject.ghlOpportunityId && existingProject.locationId) {
      console.log('🔄 [API] Project has GHL opportunity ID, attempting GHL update...');
      
      // Get API key
      const locationDoc = await db.collection('locations').findOne({ locationId: existingProject.locationId });
      const apiKey = locationDoc?.apiKey;
      
      console.log('🔐 [API] Location document:', {
        hasApiKey: !!apiKey,
        hasGhlCustomFields: !!locationDoc?.ghlCustomFields,
        ghlCustomFields: locationDoc?.ghlCustomFields
      });
      
      if (!apiKey) {
        console.error('❌ No API key found for location');
        return res.status(400).json({ error: 'No API key found for location' });
      }

      // ✅ NEW: Get related quote data for custom fields
      let quoteData = null;
      try {
        if (updateData.quoteId || existingProject.quoteId) {
          const quoteId = updateData.quoteId || existingProject.quoteId;
          console.log('📄 [API] Looking for quote:', quoteId);
          quoteData = await db.collection('quotes').findOne({
            _id: new ObjectId(quoteId),
            locationId: locationId
          });
          console.log('📋 [GHL Update] Found quote data for custom fields:', {
            quoteNumber: quoteData?.quoteNumber,
            quoteId: quoteData?._id,
            total: quoteData?.total
          });
        }
      } catch (err) {
        console.warn('⚠️ [GHL Update] Could not fetch quote data:', err);
      }

      // ✅ UPDATED: Build custom fields with location-specific IDs
      console.log('🔧 [API] Building custom fields...');
      const customFields = await buildCustomFields(db, locationId, updateData, existingProject, quoteData);

      // Build GHL request - EXACT format with custom fields
      const ghlPayload = {
        name: updateData.title || existingProject.title,
        status: updateData.status || 'won', // Default to 'won' for signed contracts
        monetaryValue: quoteData?.total || existingProject.monetaryValue || 0, // Use quote total
        customFields: customFields
      };

      // Log the exact axios config we're about to send
      console.log('🚀 [GHL API] EXACT AXIOS CONFIG:');
      const axiosConfig = {
        method: 'PUT',
        url: `https://services.leadconnectorhq.com/opportunities/${existingProject.ghlOpportunityId}`,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        data: ghlPayload
      };

      console.log('const axios = require("axios").default;');
      console.log('const options =', JSON.stringify(axiosConfig, null, 2));
      console.log('// ACTUAL REQUEST BEING SENT ^^^^^');
      console.log('// Quote Total:', quoteData?.total);
      console.log('// Status:', ghlPayload.status);

      try {
        console.log('🌐 [API] Making axios request to GHL...');
        const { data } = await axios.request(axiosConfig);
        console.log('✅ GHL SUCCESS:', data);
        console.log('✅ Custom fields updated in GHL opportunity');
        
        // GHL succeeded, now update MongoDB
      } catch (ghlError: any) {
        console.error('❌ GHL FAILED:', ghlError.response?.status);
        console.error('❌ GHL ERROR RESPONSE:', JSON.stringify(ghlError.response?.data, null, 2));
        console.error('❌ REQUEST DATA WAS:', JSON.stringify(axiosConfig.data, null, 2));
        
        return res.status(400).json({ 
          error: 'Failed to update GHL opportunity',
          ghlStatus: ghlError.response?.status,
          ghlError: ghlError.response?.data || ghlError.message,
          requestData: axiosConfig.data,
          requestUrl: axiosConfig.url
        });
      }
    } else {
      console.log('ℹ️ [API] No GHL opportunity ID, skipping GHL update');
    }

    // 💾 MongoDB UPDATE - Only happens if GHL succeeded or no GHL ID
    console.log('💾 [API] Updating MongoDB...');
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
        locationId: existingProject.locationId  // Use the project's actual locationId
      },
      { $set: finalUpdateData },
      { returnDocument: 'after' }
    );
    if (!result.value) {
      console.error('❌ Project not found during MongoDB update');
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

// ✅ UPDATED: Build custom fields with location-specific IDs and KEYS
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
  
  console.log('🔧 [Custom Fields] Location custom field IDs:', customFieldIds);
  console.log('🔧 [Custom Fields] Update data:', {
    title: updateData.title,
    signedDate: updateData.signedDate,
    hasQuoteData: !!quoteData
  });
  
  if (!customFieldIds) {
    console.warn('⚠️ No custom field IDs configured for location:', locationId);
    return [];
  }
  
  const customFields = [];
  
  // ✅ Project Title (always update if provided)
  if ((updateData.title || existingProject.title) && customFieldIds.project_title) {
    customFields.push({
      id: customFieldIds.project_title,
      key: "project_title",
      field_value: updateData.title || existingProject.title  // ✅ CHANGED to field_value
    });
  }
  
  // ✅ Quote Number (from quote data if available)
  if (quoteData?.quoteNumber && customFieldIds.quote_number) {
    customFields.push({
      id: customFieldIds.quote_number,
      key: "quote_number",
      field_value: quoteData.quoteNumber  // ✅ CHANGED to field_value
    });
  }
  
  // ✅ Signed Date (only if provided - used when contract is signed)
  if (updateData.signedDate && customFieldIds.signed_date) {
    customFields.push({
      id: customFieldIds.signed_date,
      key: "signed_date",
      field_value: updateData.signedDate  // ✅ CHANGED to field_value
    });
  }
  
  console.log('🔧 [Custom Fields] Built custom fields for location', locationId, ':', JSON.stringify(customFields, null, 2));
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
        key: key,
        field_value: value  // ✅ CHANGED to field_value
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