// src/utils/sync/syncOpportunities.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

interface SyncOptions {
  limit?: number;
  offset?: number;
  fullSync?: boolean;
}

export async function syncOpportunities(db: Db, location: any, options: SyncOptions = {}) {
  const startTime = Date.now();
  const { limit = 100, offset = 0, fullSync = false } = options;
  
  console.log(`[Sync Opportunities] Starting for ${location.locationId} - Limit: ${limit}, Offset: ${offset}`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Calculate page number from offset
    const page = Math.floor(offset / limit) + 1;
    
    // Fetch opportunities from GHL
    const response = await axios.get(
      'https://services.leadconnectorhq.com/opportunities/search',
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        },
        params: {
          location_id: location.locationId,
          limit,
          page
        }
      }
    );

    const ghlOpportunities = response.data.opportunities || [];
    const meta = response.data.meta || {};
    const totalCount = meta.total || 0;
    
    console.log(`[Sync Opportunities] Found ${ghlOpportunities.length} opportunities (Total: ${totalCount})`);

    // Get custom field mappings if they exist
    const customFieldMappings = location.ghlCustomFields || {};

    // Process each opportunity
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const ghlOpp of ghlOpportunities) {
      try {
        // Find the contact for this opportunity
        let contact = await db.collection('contacts').findOne({
          ghlContactId: ghlOpp.contactId,
          locationId: location.locationId
        });

        if (!contact) {
          console.warn(`[Sync Opportunities] Contact not found for opportunity ${ghlOpp.id}, skipping`);
          skipped++;
          continue;
        }

        // Check if project exists
        const existingProject = await db.collection('projects').findOne({
          ghlOpportunityId: ghlOpp.id
        });

        // Extract custom field values
        const customFieldValues: Record<string, any> = {};
        if (ghlOpp.customFields && Array.isArray(ghlOpp.customFields)) {
          ghlOpp.customFields.forEach((field: any) => {
            // Map custom field by ID to our field names
            if (field.id === customFieldMappings.project_title) {
              customFieldValues.project_title = field.fieldValue;
            } else if (field.id === customFieldMappings.quote_number) {
              customFieldValues.quote_number = field.fieldValue;
            } else if (field.id === customFieldMappings.signed_date) {
              customFieldValues.signed_date = field.fieldValue;
            }
          });
        }

        // Map GHL status to our project status
        const projectStatus = mapGHLStatusToProjectStatus(ghlOpp.status);

        // Prepare project data
        const projectData = {
          // GHL Integration
          ghlOpportunityId: ghlOpp.id,
          locationId: location.locationId,
          
          // Basic Information
          title: customFieldValues.project_title || ghlOpp.name || 'Untitled Project',
          status: projectStatus,
          
          // Relationships
          contactId: contact._id.toString(),
          userId: ghlOpp.assignedTo || null,
          
          // Pipeline Information
          pipelineId: ghlOpp.pipelineId || '',
          pipelineStageId: ghlOpp.pipelineStageId || '',
          
          // Financial
          monetaryValue: ghlOpp.monetaryValue || 0,
          
          // Custom Fields from GHL
          quoteNumber: customFieldValues.quote_number || '',
          signedDate: customFieldValues.signed_date || '',
          
          // Contact Info (denormalized)
          contactName: contact.fullName || `${contact.firstName} ${contact.lastName}`.trim(),
          contactEmail: contact.email,
          contactPhone: contact.phone,
          
          // Timestamps
          ghlCreatedAt: ghlOpp.createdAt ? new Date(ghlOpp.createdAt) : null,
          ghlUpdatedAt: ghlOpp.updatedAt ? new Date(ghlOpp.updatedAt) : null,
          
          // Sync Metadata
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        };

        if (existingProject) {
          // Update existing project
          await db.collection('projects').updateOne(
            { _id: existingProject._id },
            { 
              $set: projectData,
              $setOnInsert: { createdAt: new Date() }
            }
          );
          updated++;
        } else {
          // Create new project
          await db.collection('projects').insertOne({
            _id: new ObjectId(),
            ...projectData,
            createdAt: new Date(),
            createdBySync: true,
            
            // Initialize arrays
            timeline: [{
              id: new ObjectId().toString(),
              event: 'project_created',
              description: 'Project synced from GHL',
              timestamp: new Date().toISOString(),
              metadata: { syncedFrom: 'GHL' }
            }],
            milestones: [],
            photos: [],
            documents: []
          });
          created++;
        }
        
      } catch (oppError: any) {
        console.error(`[Sync Opportunities] Error processing opportunity ${ghlOpp.name}:`, oppError.message);
        errors.push({
          opportunityId: ghlOpp.id,
          name: ghlOpp.name,
          error: oppError.message
        });
        skipped++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Sync Opportunities] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    // Determine if more opportunities need to be synced
    const hasMore = meta.nextPage !== null;

    return {
      success: true,
      created,
      updated,
      skipped,
      processed: ghlOpportunities.length,
      totalInGHL: totalCount,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Opportunities] Error:`, error.response?.data || error.message);
    throw error;
  }
}

// Helper function to map GHL status to our project status
function mapGHLStatusToProjectStatus(ghlStatus: string): string {
  const statusMap: Record<string, string> = {
    'open': 'open',
    'won': 'won',
    'lost': 'lost',
    'abandoned': 'abandoned'
  };
  
  return statusMap[ghlStatus?.toLowerCase()] || 'open';
}