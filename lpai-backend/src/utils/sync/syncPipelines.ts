// src/utils/sync/syncPipelines.ts
import axios from 'axios';
import { Db } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

export async function syncPipelines(db: Db, location: any) {
  const startTime = Date.now();
  console.log(`[Sync Pipelines] Starting for ${location.locationId}`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Fetch pipelines from GHL
    const response = await axios.get(
      'https://services.leadconnectorhq.com/opportunities/pipelines',
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        },
        params: {
          locationId: location.locationId
        }
      }
    );

    const pipelines = response.data.pipelines || [];
    console.log(`[Sync Pipelines] Found ${pipelines.length} pipelines`);

    // Transform pipeline data to match our schema
    const transformedPipelines = pipelines.map((pipeline: any) => ({
      id: pipeline.id,
      name: pipeline.name,
      stages: (pipeline.stages || []).map((stage: any) => ({
        id: stage.id,
        name: stage.name,
        position: stage.position || 0,
        // Some versions include these fields
        showInFunnel: stage.showInFunnel !== undefined ? stage.showInFunnel : true,
        showInPieChart: stage.showInPieChart !== undefined ? stage.showInPieChart : true
      })).sort((a: any, b: any) => a.position - b.position),
      // Additional fields if available
      showInFunnel: pipeline.showInFunnel !== undefined ? pipeline.showInFunnel : true,
      showInPieChart: pipeline.showInPieChart !== undefined ? pipeline.showInPieChart : true
    }));

    // Check if pipelines have changed
    const existingPipelines = location.pipelines || [];
    const hasChanged = JSON.stringify(existingPipelines) !== JSON.stringify(transformedPipelines);

    let result;
    if (hasChanged) {
      // Update pipelines in database
      result = await db.collection('locations').updateOne(
        { _id: location._id },
        {
          $set: {
            pipelines: transformedPipelines,
            pipelinesUpdatedAt: new Date(),
            lastPipelineSync: new Date()
          }
        }
      );
      console.log(`[Sync Pipelines] Updated ${transformedPipelines.length} pipelines`);
    } else {
      // Just update sync timestamp
      result = await db.collection('locations').updateOne(
        { _id: location._id },
        {
          $set: {
            lastPipelineSync: new Date()
          }
        }
      );
      console.log(`[Sync Pipelines] No changes detected`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Sync Pipelines] Completed in ${duration}ms`);

    // Return summary
    const pipelineSummary = transformedPipelines.map((p: any) => ({
      name: p.name,
      stageCount: p.stages.length
    }));

    return {
      updated: hasChanged,
      pipelineCount: transformedPipelines.length,
      pipelines: pipelineSummary,
      totalStages: transformedPipelines.reduce((sum: number, p: any) => sum + p.stages.length, 0),
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Pipelines] Error:`, error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.status === 404) {
      // No pipelines endpoint or not found
      console.log(`[Sync Pipelines] No pipelines found for location`);
      return {
        updated: false,
        pipelineCount: 0,
        pipelines: [],
        totalStages: 0,
        error: 'No pipelines found'
      };
    }
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied - check permissions for pipelines');
    }
    
    throw error;
  }
}