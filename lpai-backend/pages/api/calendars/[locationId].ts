import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '@/lib/mongodb';
import axios from 'axios';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;
  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    const location = await db.collection('locations').findOne({ locationId });

    if (!location || !location.apiKey) {
      return res.status(404).json({ error: 'No API key or location found for this locationId' });
    }

    // Call GHL API to get calendars for this location
    const ghlRes = await axios.get(`${GHL_BASE_URL}/calendars`, {
      params: { locationId },
      headers: {
        'Authorization': `Bearer ${location.apiKey}`,
        'Version': '2021-04-15',
        'Accept': 'application/json',
      },
    });

    const calendars = Array.isArray(ghlRes.data.calendars)
      ? ghlRes.data.calendars.map((c: any) => ({
          calendarId: c.id,
          name: c.name,
          isActive: c.isActive,
          ...c,
        }))
      : [];

    // Compare to current calendars, only update if changed
    const current = location.calendars || [];
    const changed = JSON.stringify(current) !== JSON.stringify(calendars);

    if (changed) {
      await db.collection('locations').updateOne(
        { locationId },
        { $set: { calendars } }
      );
      console.log(`[Calendars] Updated for location ${locationId} (${calendars.length} total)`);
    }

    return res.status(200).json({
      success: true,
      updated: changed,
      count: calendars.length,
      calendars,
    });
  } catch (error: any) {
    console.error('[GHL Calendars Sync Error]', error?.response?.data || error.message);
    return res.status(500).json({ error: error?.response?.data || error.message });
  }
}
