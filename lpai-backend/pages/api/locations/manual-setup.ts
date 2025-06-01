// pages/api/locations/manual-setup.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { locationId } = req.body;

  if (!locationId) {
    return res.status(400).json({ error: 'Location ID is required' });
  }

  console.log(`[Manual Setup] Triggering setup for location: ${locationId}`);

  try {
    // Call the setup endpoint
    const setupResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app'}/api/locations/setup-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: locationId,
        fullSync: true
      })
    });

    if (setupResponse.ok) {
      const setupResult = await setupResponse.json();
      console.log(`[Manual Setup] Completed successfully`);
      
      return res.status(200).json({
        success: true,
        message: 'Location setup completed successfully',
        results: setupResult
      });
    } else {
      const error = await setupResponse.text();
      console.error(`[Manual Setup] Failed:`, error);
      
      return res.status(500).json({
        success: false,
        error: 'Setup failed',
        details: error
      });
    }

  } catch (error: any) {
    console.error('[Manual Setup] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger setup',
      message: error.message
    });
  }
}