// pages/api/ghl/pipelines/[locationId].ts
// Updated: 06/27/2025
// Fixed: Updated comments and error messages to reflect OAuth usage

import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;

  console.log(`[PIPELINES][API] Called with locationId:`, locationId);

  if (!locationId || typeof locationId !== 'string') {
    console.warn('[PIPELINES][API] Missing locationId param');
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get the OAuth token for the location
    const location = await db.collection('locations').findOne({ locationId });
    const accessToken = location?.ghlOAuth?.accessToken;
    
    if (__DEV__) {
      console.log(`[PIPELINES][API] Location found:`, !!location);
      console.log(`[PIPELINES][API] Has OAuth token:`, !!accessToken);
    }
    
    if (!accessToken) {
      console.warn(`[PIPELINES][API] No OAuth token for location ${locationId}`);
      return res.status(400).json({ error: 'OAuth token not found for this location' });
    }
    
    if (__DEV__) {
      console.log(`[PIPELINES][API] Using OAuth token: ${accessToken.slice(0, 20)}...`);
    }

    // Fetch pipelines from GHL
    let ghlRes;
    try {
      ghlRes = await axios.get('https://services.leadconnectorhq.com/opportunities/pipelines/', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Version: '2021-07-28',
        },
        params: { locationId },
      });
      
      if (__DEV__) {
        console.log(`[PIPELINES][API] GHL response status:`, ghlRes.status);
        console.log(`[PIPELINES][API] Pipeline count:`, ghlRes.data.pipelines?.length || 0);
      }
    } catch (err: any) {
      console.error('[PIPELINES][API] Error from GHL:', err.response?.data || err.message);
      throw err;
    }

    const pipelines = ghlRes.data.pipelines || [];
    if (!Array.isArray(pipelines)) {
      console.error('[PIPELINES][API] GHL response missing pipelines:', ghlRes.data);
      return res.status(500).json({ error: 'GHL response missing pipelines' });
    }
    console.log(`[PIPELINES][API] Fetched ${pipelines.length} pipelines from GHL`);

    // Fetch current pipelines from MongoDB
    const current = location.pipelines || [];
    console.log(`[PIPELINES][API] Current pipelines in MongoDB: ${current.length}`);

    // Compare (simple deep equality)
    const changed = JSON.stringify(current) !== JSON.stringify(pipelines);
    console.log(`[PIPELINES][API] Pipelines changed?`, changed);

    if (changed) {
      // Update only if different
      await db.collection('locations').updateOne(
        { locationId },
        { 
          $set: { 
            pipelines, 
            pipelinesUpdatedAt: new Date(),
            lastPipelineSync: new Date(),
            pipelineCount: pipelines.length
          } 
        }
      );
      console.log(`[PIPELINES][API] ✅ MongoDB pipelines updated for location ${locationId}`);
      return res.status(200).json({ success: true, updated: true, pipelines });
    }

    console.log(`[PIPELINES][API] 🔄 No changes, returning current pipelines`);
    return res.status(200).json({ success: true, updated: false, pipelines });
  } catch (error: any) {
    console.error('[PIPELINES][API] ❌ General error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to sync pipelines', detail: error.response?.data || error.message });
  }
}