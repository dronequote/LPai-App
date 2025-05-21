import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;
  console.log('[CALENDARS][API] Called with locationId:', locationId, 'typeof:', typeof locationId);

  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    const location = await db.collection('locations').findOne({ locationId });
    const apiKey = location?.apiKey;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key not found for this location' });
    }

    const url = 'https://services.leadconnectorhq.com/calendars';
    const params = { locationId }; // No trailing slash!
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: '2021-04-15',
    };

    console.log('[CALENDARS][API] About to call GHL with:', { url, params, headers });

    const ghlRes = await axios.get(url, { params, headers });
    console.log('[CALENDARS][API] Raw GHL response:', ghlRes.data);

    const calendars = Array.isArray(ghlRes.data.calendars) ? ghlRes.data.calendars : [];
    // ...rest of logic
    return res.status(200).json({ success: true, calendars });
  } catch (error: any) {
    console.error('[CALENDARS][API] General error:', error.response?.data || error.message);
    return res.status(500).json({ error: error.response?.data || error.message });
  }
}
