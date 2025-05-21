import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;

  console.log(`[CALENDARS][API] Called with locationId:`, locationId);

  if (!locationId || typeof locationId !== 'string') {
    console.warn('[CALENDARS][API] Missing locationId param');
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get the API key for the location
    const location = await db.collection('locations').findOne({ locationId });
    const apiKey = location?.apiKey;
    console.log(`[CALENDARS][API] Location doc:`, location);

    if (!apiKey) {
      console.warn(`[CALENDARS][API] No API key for location ${locationId}`);
      return res.status(400).json({ error: 'API key not found for this location' });
    }
    console.log(`[CALENDARS][API] Using API key: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);

    // Fetch calendars from GHL
    let ghlRes;
    try {
      ghlRes = await axios.get('https://services.leadconnectorhq.com/calendars', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Version: '2021-04-15', // Calendar API version (not pipeline version)
        },
        params: { locationId },
      });
      console.log(`[CALENDARS][API] Raw GHL response:`, ghlRes.data);
    } catch (err: any) {
      console.error('[CALENDARS][API] Error from GHL:', err.response?.data || err.message);
      throw err;
    }

    const calendars = Array.isArray(ghlRes.data.calendars) ? ghlRes.data.calendars : [];
    if (!Array.isArray(calendars)) {
      console.error('[CALENDARS][API] GHL response missing calendars:', ghlRes.data);
      return res.status(500).json({ error: 'GHL response missing calendars' });
    }
    console.log(`[CALENDARS][API] Calendars from GHL:`, calendars);

    // Fetch current calendars from MongoDB
    const current = location.calendars || [];
    console.log(`[CALENDARS][API] Calendars from MongoDB:`, current);

    // Compare (simple deep equality)
    const changed = JSON.stringify(current) !== JSON.stringify(calendars);
    console.log(`[CALENDARS][API] Calendars changed?`, changed);

    if (changed) {
      // Update only if different
      await db.collection('locations').updateOne(
        { locationId },
        { $set: { calendars, calendarsUpdatedAt: new Date() } }
      );
      console.log(`[CALENDARS][API] MongoDB calendars updated for location ${locationId}`);
      return res.status(200).json({ success: true, updated: true, calendars });
    }

    console.log(`[CALENDARS][API] No changes, returning current calendars`);
    return res.status(200).json({ success: true, updated: false, calendars });
  } catch (error: any) {
    console.error('[CALENDARS][API] General error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to sync calendars', detail: error.response?.data || error.message });
  }
}
