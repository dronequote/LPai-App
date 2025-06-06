// src/utils/sync/syncTasks.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

interface SyncOptions {
  daysBack?: number;
  limit?: number;
  offset?: number;
}

export async function syncTasks(db: Db, location: any, options: SyncOptions = {}) {
  const startTime = Date.now();
  const { daysBack = 90, limit = 100, offset = 0 } = options;
  
  console.log(`[Sync Tasks] Starting for ${location.locationId} - Last ${daysBack} days`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    // Fetch tasks from GHL
    // Updated syncTasks.ts
    const response = await axios.post(
    `https://services.leadconnectorhq.com/locations/${location.locationId}/tasks/search`,
    {
        limit: 100,
        skip: offset,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
    },
    {
        headers: {
        'Authorization': auth.header,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
        }
    }
    );

    const ghlTasks = response.data.tasks || [];
    const meta = response.data.meta || {};
    
    console.log(`[Sync Tasks] Found ${ghlTasks.length} tasks (Total: ${meta.total || ghlTasks.length})`);

    // Process each task
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const ghlTask of ghlTasks) {
      try {
        // Check if task exists
        const existingTask = await db.collection('tasks').findOne({
          ghlTaskId: ghlTask.id,
          locationId: location.locationId
        });

        // Prepare task data
        const taskData = {
          ghlTaskId: ghlTask.id,
          locationId: location.locationId,
          
          // Basic Info
          title: ghlTask.title || ghlTask.name || 'Untitled Task',
          description: ghlTask.description || ghlTask.body || '',
          
          // Relationships
          contactId: ghlTask.contactId || null,
          opportunityId: ghlTask.opportunityId || null,
          assignedTo: ghlTask.assignedTo || ghlTask.userId || null,
          
          // Status & Priority
          status: ghlTask.isCompleted || ghlTask.completed ? 'completed' : 'pending',
          priority: ghlTask.priority || 'normal',
          
          // Dates
          dueDate: ghlTask.dueDate ? new Date(ghlTask.dueDate) : null,
          completedAt: ghlTask.completedAt ? new Date(ghlTask.completedAt) : null,
          
          // Additional Fields
          type: ghlTask.type || 'general',
          tags: ghlTask.tags || [],
          reminderDate: ghlTask.reminderDate ? new Date(ghlTask.reminderDate) : null,
          
          // Metadata
          createdBy: ghlTask.createdBy || ghlTask.userId,
          ghlCreatedAt: ghlTask.createdAt ? new Date(ghlTask.createdAt) : null,
          ghlUpdatedAt: ghlTask.updatedAt ? new Date(ghlTask.updatedAt) : null,
          
          // Sync Metadata
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        };

        if (existingTask) {
          // Update existing task
          await db.collection('tasks').updateOne(
            { _id: existingTask._id },
            { 
              $set: taskData,
              $setOnInsert: { createdAt: new Date() }
            }
          );
          updated++;
        } else {
          // Create new task
          await db.collection('tasks').insertOne({
            _id: new ObjectId(),
            ...taskData,
            createdAt: new Date(),
            createdBySync: true
          });
          created++;
        }
        
      } catch (taskError: any) {
        console.error(`[Sync Tasks] Error processing task ${ghlTask.title}:`, taskError.message);
        errors.push({
          taskId: ghlTask.id,
          title: ghlTask.title,
          error: taskError.message
        });
        skipped++;
      }
    }

    // Get task stats
    const taskStats = await db.collection('tasks').aggregate([
      { $match: { locationId: location.locationId } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]).toArray();

    const duration = Date.now() - startTime;
    console.log(`[Sync Tasks] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    return {
      success: true,
      created,
      updated,
      skipped,
      processed: ghlTasks.length,
      totalInGHL: meta.total || ghlTasks.length,
      taskStats: taskStats,
      hasMore: meta.nextPage !== null,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Tasks] Error:`, error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log(`[Sync Tasks] Tasks endpoint not found`);
      return {
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        processed: 0,
        error: 'Tasks endpoint not found'
      };
    }
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    throw error;
  }
}