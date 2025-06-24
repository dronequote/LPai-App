// pages/api/oauth/refresh-token.ts
// Updated: 2025-06-24 - Simplified token refresh for both company and location
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { entityId, entityType } = req.body; // entityType: 'company' or 'location'

  if (!entityId || !entityType) {
    return res.status(400).json({ error: 'entityId and entityType are required' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Find the entity (company or location)
    const query = entityType === 'company' 
      ? { companyId: entityId, locationId: null, isCompanyLevel: true }
      : { locationId: entityId };

    const entity = await db.collection('locations').findOne(query);

    if (!entity || !entity.ghlOAuth?.refreshToken) {
      return res.status(404).json({ 
        error: 'Entity not found or no refresh token available',
        entityId,
        entityType 
      });
    }

    console.log(`[Token Refresh] Refreshing token for ${entityType}: ${entityId}`);

    try {
      // Refresh the token using GHL OAuth endpoint
      const response = await axios.post(
        'https://services.leadconnectorhq.com/oauth/token',
        new URLSearchParams({
          client_id: process.env.GHL_MARKETPLACE_CLIENT_ID!,
          client_secret: process.env.GHL_MARKETPLACE_CLIENT_SECRET!,
          grant_type: 'refresh_token',
          refresh_token: entity.ghlOAuth.refreshToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      
      // Calculate new expiry
      const expiresAt = new Date(Date.now() + (expires_in * 1000));
      
      // Update the entity with new tokens
      const updateResult = await db.collection('locations').updateOne(
        { _id: entity._id },
        {
          $set: {
            'ghlOAuth.accessToken': access_token,
            'ghlOAuth.refreshToken': refresh_token || entity.ghlOAuth.refreshToken,
            'ghlOAuth.expiresAt': expiresAt,
            'ghlOAuth.lastRefreshed': new Date(),
            'ghlOAuth.refreshCount': (entity.ghlOAuth.refreshCount || 0) + 1,
            'ghlOAuth.needsReauth': false,
            'ghlOAuth.lastRefreshError': null,
            updatedAt: new Date()
          }
        }
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error('Failed to update tokens in database');
      }

      console.log(`[Token Refresh] Successfully refreshed token for ${entityType}: ${entityId}`);

      return res.status(200).json({
        success: true,
        entityId,
        entityType,
        expiresAt,
        message: 'Token refreshed successfully'
      });

    } catch (error: any) {
      console.error(`[Token Refresh] Failed for ${entityType} ${entityId}:`, error.response?.data || error);
      
      // Mark entity as needing reauth
      await db.collection('locations').updateOne(
        { _id: entity._id },
        {
          $set: {
            'ghlOAuth.needsReauth': true,
            'ghlOAuth.lastRefreshError': error.response?.data?.error || error.message,
            'ghlOAuth.lastRefreshAttempt': new Date()
          }
        }
      );
      
      return res.status(400).json({
        error: 'Token refresh failed',
        details: error.response?.data || error.message,
        entityId,
        entityType
      });
    }

  } catch (error: any) {
    console.error('[Token Refresh] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}