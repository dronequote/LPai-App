import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import axios from 'axios';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;
  console.log('[Calendars][Sync] Starting for locationId:', locationId);

  if (!locationId || typeof locationId !== 'string') {
    console.warn('[Calendars][Sync] No locationId provided!');
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    const location = await db.collection('locations').findOne({ locationId });

    if (!location) {
      console.error('[Calendars][Sync] No location found for locationId:', locationId);
      return res.status(404).json({ error: 'Location not found' });
    }
    if (!location.apiKey) {
      console.error('[Calendars][Sync] No apiKey for location:', locationId);
      return res.status(404).json({ error: 'No API key for this location' });
    }

    // --- Axios request block ---
    let ghlRes;
    try {
      console.log('[Calendars][Sync] Fetching from GHL...');
      ghlRes = await axios.get(`${GHL_BASE_URL}/calendars`, {
        params: { locationId },
        headers: {
          'Authorization': `Bearer ${location.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Version': '2021-04-15', // or latest from docs
        },
        validateStatus: () => true, // Let us see non-200s for logging
      });
      console.log('[Calendars][Sync] GHL Raw Response:', ghlRes.status, ghlRes.data);
    } catch (err: any) {
      console.error('[Calendars][Sync] AXIOS error:', err?.response?.data || err.message);
      return res.status(500).json({ error: 'Failed to reach GHL', detail: err?.response?.data || err.message });
    }

    if (!ghlRes || ghlRes.status >= 400) {
      console.error('[Calendars][Sync] GHL returned error', ghlRes?.status, ghlRes?.data);
      return res.status(ghlRes?.status || 500).json({
        error: `GHL API error: ${ghlRes?.status}`,
        detail: ghlRes?.data || 'No response data',
      });
    }

    // --- Process calendars as before ---
    const fetched = Array.isArray(ghlRes.data.calendars) ? ghlRes.data.calendars.length : 0;
    console.log(`[Calendars][Sync] GHL returned ${fetched} calendars.`);

    const calendars = Array.isArray(ghlRes.data.calendars)
      ? ghlRes.data.calendars.map((c: any) => ({
          id: c.id,
          name: c.name,
          isActive: c.isActive,
          ...c,
        }))
      : [];

    // Compare and update only if changed
    const current = location.calendars || [];
    const changed = JSON.stringify(current) !== JSON.stringify(calendars);

    if (changed) {
      await db.collection('locations').updateOne(
        { locationId },
        {
          $set: {
            calendars,
            calendarsUpdatedAt: new Date(),
          },
        }
      );
      console.log(`[Calendars][Sync] Calendars UPDATED in DB for location ${locationId} (${calendars.length} total).`);
    } else {
      console.log(`[Calendars][Sync] Calendars unchanged for location ${locationId}.`);
    }

    res.status(200).json({
      success: true,
      updated: changed,
      count: calendars.length,
      calendars,
    });
  } catch (error: any) {
    console.error('[GHL Calendars Sync Error]', error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data || error.message });
  }
}
