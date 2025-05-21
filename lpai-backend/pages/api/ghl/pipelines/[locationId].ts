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

    // Get the API key for the location
    const location = await db.collection('locations').findOne({ locationId });
    const apiKey = location?.apiKey;
    console.log(`[PIPELINES][API] Location doc:`, location);
    if (!apiKey) {
      console.warn(`[PIPELINES][API] No API key for location ${locationId}`);
      return res.status(400).json({ error: 'API key not found for this location' });
    }
    console.log(`[PIPELINES][API] Using API key: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);

    // Fetch pipelines from GHL
    let ghlRes;
    try {
      ghlRes = await axios.get('https://services.leadconnectorhq.com/opportunities/pipelines/', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Version: '2021-07-28',
        },
        params: { locationId },
      });
      console.log(`[PIPELINES][API] Raw GHL response:`, ghlRes.data);
    } catch (err: any) {
      console.error('[PIPELINES][API] Error from GHL:', err.response?.data || err.message);
      throw err;
    }

    const pipelines = ghlRes.data.pipelines || [];
    if (!Array.isArray(pipelines)) {
      console.error('[PIPELINES][API] GHL response missing pipelines:', ghlRes.data);
      return res.status(500).json({ error: 'GHL response missing pipelines' });
    }
    console.log(`[PIPELINES][API] Pipelines from GHL:`, pipelines);

    // Fetch current pipelines from MongoDB
    const current = location.pipelines || [];
    console.log(`[PIPELINES][API] Pipelines from MongoDB:`, current);

    // Compare (simple deep equality)
    const changed = JSON.stringify(current) !== JSON.stringify(pipelines);
    console.log(`[PIPELINES][API] Pipelines changed?`, changed);

    if (changed) {
      // Update only if different
      await db.collection('locations').updateOne(
        { locationId },
        { $set: { pipelines, pipelinesUpdatedAt: new Date() } }
      );
      console.log(`[PIPELINES][API] MongoDB pipelines updated for location ${locationId}`);
      return res.status(200).json({ success: true, updated: true, pipelines });
    }

    console.log(`[PIPELINES][API] No changes, returning current pipelines`);
    return res.status(200).json({ success: true, updated: false, pipelines });
  } catch (error: any) {
    console.error('[PIPELINES][API] General error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to sync pipelines', detail: error.response?.data || error.message });
  }
}
