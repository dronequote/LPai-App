// pages/api/ghl/calendars/[locationId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;
  console.log('[CALENDARS][API] Called with locationId:', locationId, 'typeof:', typeof locationId);

  if (!locationId || typeof locationId !== 'string') {
    console.warn('[CALENDARS][API] Missing locationId param');
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get the API key for the location
    const location = await db.collection('locations').findOne({ locationId });
    console.log('[CALENDARS][API] Location doc:', location);
    const apiKey = location?.apiKey;
    if (!apiKey) {
      console.warn('[CALENDARS][API] No API key for location', locationId);
      return res.status(400).json({ error: 'API key not found for this location' });
    }
    console.log('[CALENDARS][API] Using API key:', apiKey.slice(0, 6) + '...' + apiKey.slice(-4));

    // Build exact URL (query string inline, no params object)
    const url = `https://services.leadconnectorhq.com/calendars/?locationId=${locationId}`;
    console.log('[CALENDARS][API] About to call GHL with URL:', url);

    let ghlRes;
    try {
      ghlRes = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: '2021-04-15',
          Accept: 'application/json',
        },
      });
      console.log('[CALENDARS][API] Raw GHL response status:', ghlRes.status);
    } catch (err: any) {
      console.error('[CALENDARS][API] Error from GHL:', err.response?.data || err.message);
      return res.status(err.response?.status || 500).json({
        error: err.response?.data || err.message
      });
    }

    // Grab calendars as array
    const calendars = Array.isArray(ghlRes.data.calendars) ? ghlRes.data.calendars : [];
    console.log('[CALENDARS][API] Calendars from GHL:', calendars);

    // Fetch current calendars from MongoDB
    const current = location.calendars || [];
    console.log('[CALENDARS][API] Calendars from MongoDB:', current);

    // Compare (simple deep equality)
    const changed = JSON.stringify(current) !== JSON.stringify(calendars);
    console.log('[CALENDARS][API] Calendars changed?', changed);

    if (changed) {
      await db.collection('locations').updateOne(
        { locationId },
        { $set: { calendars, calendarsUpdatedAt: new Date() } }
      );
      console.log(`[CALENDARS][API] MongoDB calendars updated for location ${locationId}`);
      return res.status(200).json({ success: true, updated: true, calendars });
    }

    console.log('[CALENDARS][API] No changes, returning current calendars');
    return res.status(200).json({ success: true, updated: false, calendars });

  } catch (error: any) {
    console.error('[CALENDARS][API] General error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to sync calendars', detail: error.response?.data || error.message });
  }
}
