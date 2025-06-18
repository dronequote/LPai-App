// pages/api/appointments/calendars/[calendarId]/free-slots.ts
// Updated: 2025-01-19

import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../../src/lib/mongodb';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { calendarId } = req.query;
    const {
      startDate,
      endDate,
      timezone,
      userId,
      enableLookBusy,
      locationId
    } = req.query;

    // Validate required parameters
    if (!calendarId || typeof calendarId !== 'string') {
      return res.status(400).json({ error: 'calendarId is required' });
    }

    if (!startDate || !endDate || !timezone) {
      return res.status(400).json({ 
        error: 'startDate, endDate, and timezone are required' 
      });
    }

    if (!locationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    // Get the database connection
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // Get the location's GHL access token
    const location = await db.collection('locations').findOne({
      _id: locationId
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    if (!location.ghlAccessToken) {
      return res.status(401).json({ error: 'Location not connected to GoHighLevel' });
    }

    // Build GHL API URL
    const ghlApiUrl = `https://services.leadconnectorhq.com/calendars/${calendarId}/free-slots`;

    // Build query parameters for GHL
    const params: any = {
      startDate,
      endDate,
      timezone,
    };

    if (userId) {
      params.userId = userId;
    }

    if (enableLookBusy) {
      params.enableLookBusy = enableLookBusy;
    }

    // Make request to GHL
    const response = await axios.get(ghlApiUrl, {
      params,
      headers: {
        'Authorization': `Bearer ${location.ghlAccessToken}`,
        'Version': '2021-04-15',
        'Accept': 'application/json'
      }
    });

    // Return the GHL response directly
    return res.status(200).json(response.data);

  } catch (error: any) {
    console.error('[GHL Free Slots] Error:', error);

    // Handle GHL API errors
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;

      if (status === 400) {
        return res.status(400).json({ 
          error: 'Invalid request parameters',
          details: error.response.data 
        });
      }

      if (status === 401) {
        return res.status(401).json({ 
          error: 'GHL authentication failed. Please reconnect your account.' 
        });
      }

      if (status === 403) {
        return res.status(403).json({ 
          error: 'Access denied to this calendar' 
        });
      }

      if (status === 404) {
        return res.status(404).json({ 
          error: 'Calendar not found in GoHighLevel' 
        });
      }

      if (status === 422) {
        return res.status(422).json({ 
          error: 'Invalid data format',
          details: error.response.data 
        });
      }

      if (status === 429) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded. Please try again later.' 
        });
      }

      return res.status(status).json({ 
        error: message,
        details: error.response.data 
      });
    }

    // Network or other errors
    return res.status(500).json({ 
      error: 'Failed to fetch calendar slots',
      message: error.message 
    });
  }
}