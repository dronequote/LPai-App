// pages/api/projects/batch.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { 
  sendSuccess, 
  sendError, 
  sendValidationError,
  sendServerError,
  sendMethodNotAllowed 
} from '../../../src/utils/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }
  
  const client = await clientPromise;
  const db = client.db('lpai');
  
  return await processBatchOperation(db, req.body, res);
}

async function processBatchOperation(db: any, body: any, res: NextApiResponse) {
  try {
    const { action, projects, locationId, userId, options = {} } = body;
    
    if (!action || !projects || !locationId) {
      return sendValidationError(res, {
        action: !action ? 'Required' : undefined,
        projects: !projects ? 'Required' : undefined,
        locationId: !locationId ? 'Required' : undefined
      });
    }
    
    if (!Array.isArray(projects) || projects.length === 0) {
      return sendValidationError(res, { projects: 'Must be a non-empty array' });
    }
    
    const validActions = ['create', 'update', 'delete', 'status', 'assign'];
    if (!validActions.includes(action)) {
      return sendValidationError(res, { 
        action: `Invalid action. Must be one of: ${validActions.join(', ')}` 
      });
    }
    
    // Get location for GHL sync
    const location = await db.collection('locations').findOne({ locationId });
    const hasGHLSync = location?.apiKey && location?.pipelines?.length > 0;
    
    const results = {
      success: [] as any[],
      failed: [] as any[],
      total: projects.length
    };
    
    switch (action) {
      case 'create':
        for (const projectData of projects) {
          try {
            // Validate required fields
            if (!projectData.title || !projectData.contactId) {
              results.failed.push({
                project: projectData,
                error: 'Title and contactId are required'
              });
              continue;
            }
            
            // Verify contact exists
            const contact = await db.collection('contacts').findOne({
              _id: new ObjectId(projectData.contactId),
              locationId
            });
            
            if (!contact) {
              results.failed.push({
                project: projectData,
                error: 'Contact not found'
              });
              continue;
            }
            
            // Create project
            const newProject = {
              title: projectData.title,
              status: projectData.status || 'open',
              contactId: projectData.contactId,
              userId: projectData.userId || userId,
              locationId,
              notes: projectData.notes || '',
              pipelineId: projectData.pipelineId,
              pipelineStageId: projectData.pipelineStageId,
              monetaryValue: projectData.monetaryValue || 0,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            const result = await db.collection('projects').insertOne(newProject);
            const createdProject = { ...newProject, _id: result.insertedId };
            
            // Sync to GHL if enabled
            if (hasGHLSync && contact.ghlContactId && projectData.pipelineId) {
              try {
                const ghlPayload = {
                  contactId: contact.ghlContactId,
                  pipelineId: projectData.pipelineId,
                  pipelineStageId: projectData.pipelineStageId,
                  locationId,
                  status: 'open',
                  name: projectData.title,
                  monetaryValue: projectData.monetaryValue || 0
                };
                
                const ghlResponse = await axios.post(
                  'https://services.leadconnectorhq.com/opportunities/',
                  ghlPayload,
                  {
                    headers: {
                      Authorization: `Bearer ${location.apiKey}`,
                      Version: '2021-07-28',
                      'Content-Type': 'application/json'
                    }
                  }
                );
                
                if (ghlResponse.data?.opportunity?.id) {
                  await db.collection('projects').updateOne(
                    { _id: result.insertedId },
                    { 
                      $set: { 
                        ghlOpportunityId: ghlResponse.data.opportunity.id,
                        lastSyncedAt: new Date()
                      }
                    }
                  );
                  createdProject.ghlOpportunityId = ghlResponse.data.opportunity.id;
                }
              } catch (ghlError: any) {
                console.error('[PROJECTS BATCH] GHL sync failed:', ghlError.response?.data);
              }
            }
            
            results.success.push(createdProject);
            
          } catch (error: any) {
            results.failed.push({
              project: projectData,
              error: error.message
            });
          }
        }
        break;
        
      case 'update':
        for (const updateData of projects) {
          try {
            if (!updateData.id) {
              results.failed.push({
                project: updateData,
                error: 'Missing project ID'
              });
              continue;
            }
            
            const { id, ...updates } = updateData;
            updates.updatedAt = new Date();
            
            const result = await db.collection('projects').updateOne(
              { _id: new ObjectId(id), locationId },
              { $set: updates }
            );
            
            if (result.matchedCount === 0) {
              results.failed.push({
                project: updateData,
                error: 'Project not found'
              });
            } else {
              results.success.push({ id, updated: true });
            }
            
          } catch (error: any) {
            results.failed.push({
              project: updateData,
              error: error.message
            });
          }
        }
        break;
        
      case 'delete':
        const projectIds = projects.map(p => new ObjectId(p.id || p));
        
        try {
          // Soft delete
          const result = await db.collection('projects').updateMany(
            { _id: { $in: projectIds }, locationId },
            {
              $set: {
                status: 'Deleted',
                deletedAt: new Date(),
                updatedAt: new Date()
              }
            }
          );
          
          results.success.push({
            deletedCount: result.modifiedCount
          });
          
        } catch (error: any) {
          results.failed.push({
            error: error.message
          });
        }
        break;
        
      case 'status':
        const { newStatus } = options;
        
        if (!newStatus) {
          return sendValidationError(res, { status: 'New status required' });
        }
        
        const statusProjectIds = projects.map(p => new ObjectId(p.id || p));
        
        try {
          const result = await db.collection('projects').updateMany(
            { _id: { $in: statusProjectIds }, locationId },
            {
              $set: {
                status: newStatus,
                updatedAt: new Date()
              },
              $push: {
                timeline: {
                  id: new ObjectId().toString(),
                  event: 'status_changed',
                  description: `Status changed to ${newStatus} (batch operation)`,
                  timestamp: new Date().toISOString(),
                  userId: userId || 'system'
                }
              }
            }
          );
          
          results.success.push({
            updatedCount: result.modifiedCount,
            newStatus
          });
          
        } catch (error: any) {
          results.failed.push({
            error: error.message
          });
        }
        break;
        
      case 'assign':
        const { assignTo } = options;
        
        if (!assignTo) {
          return sendValidationError(res, { assignTo: 'User ID required' });
        }
        
        const assignProjectIds = projects.map(p => new ObjectId(p.id || p));
        
        try {
          const result = await db.collection('projects').updateMany(
            { _id: { $in: assignProjectIds }, locationId },
            {
              $set: {
                userId: assignTo,
                updatedAt: new Date()
              },
              $push: {
                timeline: {
                  id: new ObjectId().toString(),
                  event: 'assigned',
                  description: `Project assigned to user (batch operation)`,
                  timestamp: new Date().toISOString(),
                  userId: userId || 'system',
                  metadata: { assignedTo: assignTo }
                }
              }
            }
          );
          
          results.success.push({
            assignedCount: result.modifiedCount,
            assignedTo: assignTo
          });
          
        } catch (error: any) {
          results.failed.push({
            error: error.message
          });
        }
        break;
    }
    
    return sendSuccess(res, {
      action,
      results: {
        successful: results.success.length,
        failed: results.failed.length,
        total: results.total,
        details: options.includeDetails ? results : undefined
      }
    }, `Batch ${action} completed`);
    
  } catch (error) {
    console.error('[PROJECTS BATCH] Operation error:', error);
    return sendServerError(res, error, 'Batch operation failed');
  }
}