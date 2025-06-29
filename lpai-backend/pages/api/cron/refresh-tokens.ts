// pages/api/cron/refresh-tokens.ts
// Updated: 2025-06-24 - Call refresh logic directly instead of HTTP request
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { refreshOAuthToken, tokenNeedsRefresh } from '../../../src/utils/ghlAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const hasValidAuth = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  
  if (!isVercelCron && !hasValidAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // Find all locations with OAuth that need refresh
    const locations = await db.collection('locations').find({
      'ghlOAuth.accessToken': { $exists: true },
      'ghlOAuth.refreshToken': { $exists: true },
      appInstalled: true
    }).toArray();
    
    console.log(`[Token Refresh Cron] Checking ${locations.length} locations`);
    
    const results = {
      checked: locations.length,
      refreshed: 0,
      failed: 0,
      errors: [] as any[]
    };
    
    // Process each location
    for (const location of locations) {
      try {
        if (tokenNeedsRefresh(location)) {
          console.log(`[Token Refresh Cron] Refreshing token for ${location.locationId || location.companyId}`);
          await refreshOAuthToken(location);
          results.refreshed++;
        }
      } catch (error: any) {
        console.error(`[Token Refresh Cron] Failed for ${location.locationId || location.companyId}:`, error.message);
        results.failed++;
        results.errors.push({
          locationId: location.locationId,
          companyId: location.companyId,
          error: error.message
        });
      }
    }
    
    console.log(`[Token Refresh Cron] Complete - Refreshed: ${results.refreshed}, Failed: ${results.failed}`);
    
    return res.status(200).json({
      success: true,
      ...results
    });
    
  } catch (error: any) {
    console.error('[Token Refresh Cron] Fatal error:', error);
    return res.status(500).json({
      error: 'Token refresh cron failed',
      message: error.message
    });
  }
}