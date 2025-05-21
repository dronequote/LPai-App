import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;
  console.log('[CALENDARS][API] Called with locationId:', locationId);

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
    console.log('[CALENDARS][API] Location doc:', location);
    if (!apiKey) {
      console.warn('[CALENDARS][API] No API key for location', locationId);
      return res.status(400).json({ error: 'API key not found for this location' });
    }
    console.log('[CALENDARS][API] Using API key:', apiKey.slice(0, 6) + '...' + apiKey.slice(-4));

    // ----- TEST HARDCODE URL -----
    const url = `https://services.leadconnectorhq.com/calendars?locationId=${locationId}&showDrafted=true`;
    console.log('[CALENDARS][API] About to call GHL with URL:', url);
    let ghlRes;
    try {
      ghlRes = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Version: '2021-04-15',
        }
      });
      console.log('[CALENDARS][API] Raw GHL response:', ghlRes.data);
    } catch (err: any) {
      console.error('[CALENDARS][API] Error from GHL:', err.response?.data || err.message);
      return res.status(err.response?.status || 500).json({
        error: 'GHL error',
        detail: err.response?.data || err.message,
      });
    }

    const calendars = Array.isArray(ghlRes.data.calendars) ? ghlRes.data.calendars : [];
    console.log('[CALENDARS][API] Calendars from GHL:', calendars);

    // ...rest of your sync logic...

    return res.status(200).json({ success: true, calendars });
  } catch (error: any) {
    console.error('[CALENDARS][API] General error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to sync calendars', detail: error.response?.data || error.message });
  }
}
