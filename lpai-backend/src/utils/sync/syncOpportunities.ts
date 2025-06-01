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
          limit,
          offset
        }
      }
    );

    const ghlOpportunities = response.data.opportunities || [];
    const totalCount = response.data.meta?.total || response.data.total || ghlOpportunities.length;
    
    console.log(`[Sync Opportunities] Found ${ghlOpportunities.length} opportunities (Total: ${totalCount})`);

    // Get custom field mappings
    const customFieldMappings = location.ghlCustomFields || {};

    // Process each opportunity
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const ghlOpp of ghlOpportunities) {
      try {
        // Find the contact for this opportunity
        let contact = null;
        if (ghlOpp.contactId) {
          contact = await db.collection('contacts').findOne({
            ghlContactId: ghlOpp.contactId,
            locationId: location.locationId
          });
        }

        if (!contact) {
          console.warn(`[Sync Opportunities] Contact not found for opportunity ${ghlOpp.id}, skipping`);
          skipped++;
          continue;
        }

        // Check if project exists
        const existingProject = await db.collection('projects').findOne({
          $or: [
            { ghlOpportunityId: ghlOpp.id },
            { 
              title: ghlOpp.name,
              contactId: contact._id.toString(),
              locationId: location.locationId
            }
          ]
        });

        // Extract custom field values
        const customFieldValues: Record<string, any> = {};
        if (ghlOpp.customFields && Array.isArray(ghlOpp.customFields)) {
          ghlOpp.customFields.forEach((field: any) => {
            // Find which of our fields this is
            Object.entries(customFieldMappings).forEach(([key, fieldId]) => {
              if (field.id === fieldId || field.fieldKey === key) {
                customFieldValues[key] = field.value || field.fieldValue;
              }
            });
          });
        }

        // Map GHL status to our project status
        const projectStatus = mapGHLStatusToProjectStatus(ghlOpp.status);

        // Find assigned user if available
        let assignedUserId = null;
        if (ghlOpp.assignedTo) {
          const assignedUser = await db.collection('users').findOne({
            ghlUserId: ghlOpp.assignedTo,
            locationId: location.locationId
          });
          if (assignedUser) {
            assignedUserId = assignedUser._id.toString();
          }
        }

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
          userId: assignedUserId,
          
          // Pipeline Information
          pipelineId: ghlOpp.pipelineId || '',
          pipelineStageId: ghlOpp.pipelineStageId || '',
          pipelineName: ghlOpp.pipelineName || '',
          pipelineStageName: ghlOpp.pipelineStageName || '',
          
          // Financial
          monetaryValue: parseFloat(ghlOpp.monetaryValue || ghlOpp.leadValue || '0') || 0,
          
          // Custom Fields from GHL
          quoteNumber: customFieldValues.quote_number || '',
          signedDate: customFieldValues.signed_date || '',
          
          // Additional Fields
          source: ghlOpp.source || '',
          wonReason: ghlOpp.wonReason || '',
          lostReason: ghlOpp.lostReason || '',
          
          // Notes (if available)
          notes: ghlOpp.notes || '',
          
          // Contact Info (denormalized for convenience)
          contactName: contact.fullName || `${contact.firstName} ${contact.lastName}`.trim(),
          contactEmail: contact.email,
          contactPhone: contact.phone,
          
          // GHL Metadata
          ghlCreatedAt: ghlOpp.dateAdded ? new Date(ghlOpp.dateAdded) : null,
          ghlUpdatedAt: ghlOpp.dateUpdated ? new Date(ghlOpp.dateUpdated) : null,
          
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
              $setOnInsert: { 
                createdAt: new Date(),
                timeline: [],
                milestones: [],
                photos: [],
                documents: []
              }
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
            documents: [],
            products: [],
            scopeOfWork: ''
          });
          created++;
        }
        
      } catch (oppError: any) {
        console.error(`[Sync Opportunities] Error processing opportunity ${ghlOpp.name || ghlOpp.id}:`, oppError.message);
        errors.push({
          opportunityId: ghlOpp.id,
          name: ghlOpp.name,
          error: oppError.message
        });
        skipped++;
      }
    }

    // Update sync status
    await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          lastOpportunitySync: new Date(),
          opportunitySyncStatus: {
            lastSync: new Date(),
            totalOpportunities: totalCount,
            synced: offset + ghlOpportunities.length,
            errors: errors.length
          }
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Opportunities] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    // Determine if more opportunities need to be synced
    const hasMore = (offset + limit) < totalCount;

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
    
    // Handle specific error cases
    if (error.response?.status === 404) {
      console.log(`[Sync Opportunities] Opportunities endpoint not found`);
      return {
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        processed: 0,
        totalInGHL: 0,
        error: 'Opportunities endpoint not found'
      };
    }
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied - check permissions for opportunities');
    }
    
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded - too many requests');
    }
    
    throw error;
  }
}

// Helper function to map GHL status to our project status
function mapGHLStatusToProjectStatus(ghlStatus: string): string {
  const statusMap: Record<string, string> = {
    'open': 'open',
    'won': 'won',
    'lost': 'lost',
    'abandoned': 'abandoned',
    'deleted': 'deleted'
  };
  
  return statusMap[ghlStatus?.toLowerCase()] || 'open';
}