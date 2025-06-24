// pages/api/cron/refresh-tokens.ts
// Updated: 2025-06-24 - Use simplified refresh endpoint
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { tokenNeedsRefresh } from '../../../src/utils/ghlAuth';

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
    
    // Find all entities with OAuth that need refresh
    const entities = await db.collection('locations').find({
      'ghlOAuth.accessToken': { $exists: true },
      'ghlOAuth.refreshToken': { $exists: true },
      appInstalled: true
    }).toArray();
    
    console.log(`[Token Refresh Cron] Checking ${entities.length} entities`);
    
    const results = {
      checked: entities.length,
      refreshed: 0,
      failed: 0,
      errors: [] as any[]
    };
    
    // Process each entity
    for (const entity of entities) {
      try {
        if (tokenNeedsRefresh(entity)) {
          const entityType = entity.locationId === null ? 'company' : 'location';
          const entityId = entityType === 'company' ? entity.companyId : entity.locationId;
          
          console.log(`[Token Refresh Cron] Refreshing ${entityType}: ${entityId}`);
          
          // Call the simplified refresh endpoint
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/oauth/refresh-token`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entityId,
                entityType
              })
            }
          );
          
          if (response.ok) {
            results.refreshed++;
          } else {
            const error = await response.json();
            throw new Error(error.details || error.error);
          }
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          entityId: entity.locationId || entity.companyId,
          entityType: entity.locationId === null ? 'company' : 'location',
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