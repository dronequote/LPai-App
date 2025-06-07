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
    
    // Note: GHL tasks endpoint doesn't support date filtering in the search
    // We'll fetch all tasks and filter locally if needed
    
    // Fetch tasks from GHL
    const response = await axios.post(
      `https://services.leadconnectorhq.com/locations/${location.locationId}/tasks/search`,
      {
        limit: limit,
        skip: offset
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

    const tasksResponse = response.data;
    const ghlTasks = tasksResponse.tasks || [];
    const traceId = tasksResponse.traceId;
    
    console.log(`[Sync Tasks] Found ${ghlTasks.length} tasks (TraceId: ${traceId})`);

    // If we need to filter by date, do it locally
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const filteredTasks = daysBack ? ghlTasks.filter((task: any) => {
      const taskDate = new Date(task.dateAdded || task.createdAt);
      return taskDate >= cutoffDate;
    }) : ghlTasks;

    console.log(`[Sync Tasks] Processing ${filteredTasks.length} tasks within date range`);

    // Process each task
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const ghlTask of filteredTasks) {
      try {
        // Check if task exists
        const existingTask = await db.collection('tasks').findOne({
          ghlTaskId: ghlTask._id || ghlTask.id,
          locationId: location.locationId
        });

        // Prepare task data
        const taskData = {
          ghlTaskId: ghlTask._id || ghlTask.id,
          locationId: location.locationId,
          
          // Basic Info
          title: ghlTask.title || 'Untitled Task',
          description: ghlTask.body || '',
          
          // Relationships
          contactId: ghlTask.contactId || null,
          contactDetails: ghlTask.contactDetails || null,
          assignedTo: ghlTask.assignedTo || null,
          assignedToUserDetails: ghlTask.assignedToUserDetails || null,
          
          // Status & Priority
          status: ghlTask.completed ? 'completed' : 'pending',
          completed: ghlTask.completed || false,
          
          // Dates
          dueDate: ghlTask.dueDate ? new Date(ghlTask.dueDate) : null,
          completedAt: ghlTask.completedAt ? new Date(ghlTask.completedAt) : null,
          
          // Metadata
          deleted: ghlTask.deleted || false,
          ghlCreatedAt: ghlTask.createdAt ? new Date(ghlTask.createdAt) : null,
          ghlUpdatedAt: ghlTask.updatedAt ? new Date(ghlTask.updatedAt) : null,
          dateAdded: ghlTask.dateAdded ? new Date(ghlTask.dateAdded) : null,
          dateUpdated: ghlTask.dateUpdated ? new Date(ghlTask.dateUpdated) : null,
          
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
          taskId: ghlTask._id || ghlTask.id,
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
      processed: filteredTasks.length,
      totalInGHL: ghlTasks.length,
      taskStats: taskStats,
      hasMore: ghlTasks.length === limit,
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