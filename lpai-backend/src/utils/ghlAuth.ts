// /src/utils/ghlAuth.ts
// Updated: 2025-01-17 - Changed token refresh buffer from 8 hours to 4 hours
import axios from 'axios';
import clientPromise from '../lib/mongodb';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType: string;
}

export async function getAuthHeader(location: any): Promise<{ header: string; type: string }> {
  if (location?.ghlAuth) {
    return {
      header: `Bearer ${location.ghlAuth.access_token}`,
      type: 'OAuth'
    };
  }
  if (location?.ghlOAuth?.accessToken) {
    return {
      header: `Bearer ${location.ghlOAuth.accessToken}`,
      type: 'OAuth'
    };
  }
  if (location?.ghlApiKey) {
    return {
      header: `Bearer ${location.ghlApiKey}`,
      type: 'API Key'
    };
  }
  throw new Error('No authentication method available');
}

export function tokenNeedsRefresh(location: any): boolean {
  if (!location?.ghlOAuth?.expiresAt) return false;
  
  const expiresAt = new Date(location.ghlOAuth.expiresAt);
  const now = new Date();
  const bufferTime = 12 * 60 * 60 * 1000; // 12 hour buffer instead of 4
  
  return (expiresAt.getTime() - now.getTime()) < bufferTime;
}

export async function refreshOAuthToken(location: any): Promise<OAuthTokens> {
  if (!location?.ghlOAuth?.refreshToken) {
    throw new Error('No refresh token available');
  }

  console.log(`[OAuth Refresh] Starting refresh for location ${location.locationId}`);

  try {
    const response = await axios.post(
      'https://services.leadconnectorhq.com/oauth/token',
      new URLSearchParams({
        client_id: process.env.GHL_MARKETPLACE_CLIENT_ID!,
        client_secret: process.env.GHL_MARKETPLACE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: location.ghlOAuth.refreshToken
        // No user_type parameter - GHL determines this from the refresh token
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );

    const { access_token, refresh_token, expires_in, locationId, companyId } = response.data;
    
    // Calculate new expiry
    const expiresAt = new Date(Date.now() + (expires_in * 1000));
    
    // Update the database with new tokens
    const client = await clientPromise;
    const db = client.db('lpai');
    
    const updateResult = await db.collection('locations').updateOne(
      { 
        locationId: location.locationId 
      },
      {
        $set: {
          'ghlOAuth.accessToken': access_token,
          'ghlOAuth.refreshToken': refresh_token || location.ghlOAuth.refreshToken, // Keep old refresh token if new one not provided
          'ghlOAuth.expiresAt': expiresAt,
          'ghlOAuth.lastRefreshed': new Date(),
          'ghlOAuth.refreshCount': (location.ghlOAuth.refreshCount || 0) + 1,
          updatedAt: new Date()
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      console.error(`[OAuth Refresh] Failed to update tokens for location ${location.locationId}`);
      throw new Error('Failed to update tokens in database');
    }

    console.log(`[OAuth Refresh] Successfully refreshed tokens for location ${location.locationId}`);
    console.log(`[OAuth Refresh] New token expires at: ${expiresAt.toISOString()}`);
    console.log(`[OAuth Refresh] Response locationId: ${locationId || 'not specified'}`);
    console.log(`[OAuth Refresh] Response companyId: ${companyId || 'not specified'}`);
    console.log(`[OAuth Refresh] This is refresh #${(location.ghlOAuth.refreshCount || 0) + 1}`);

    return {
      accessToken: access_token,
      refreshToken: refresh_token || location.ghlOAuth.refreshToken,
      expiresAt: expiresAt,
      tokenType: 'Bearer'
    };

  } catch (error: any) {
    console.error(`[OAuth Refresh] Error refreshing token for location ${location.locationId}:`, error.response?.data || error);
    
    // If refresh fails, mark the location as needing reauth
    try {
      const client = await clientPromise;
      const db = client.db('lpai');
      
      await db.collection('locations').updateOne(
        { locationId: location.locationId },
        {
          $set: {
            'ghlOAuth.needsReauth': true,
            'ghlOAuth.lastRefreshError': error.response?.data?.error || error.message,
            'ghlOAuth.lastRefreshAttempt': new Date()
          }
        }
      );
    } catch (dbError) {
      console.error('[OAuth Refresh] Failed to mark location as needing reauth:', dbError);
    }
    
    throw error;
  }
}

export async function getLocationToken(companyToken: string, locationId: string): Promise<any> {
  try {
    console.log('[Auth] Getting location token from company token...');
    
    const response = await axios.post(
      'https://services.leadconnectorhq.com/oauth/locationToken',
      new URLSearchParams({
        companyId: process.env.GHL_COMPANY_ID!,
        locationId: locationId
      }),
      {
        headers: {
          'Authorization': `Bearer ${companyToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('[Auth] Location token obtained successfully');
    return response.data;
    
  } catch (error: any) {
    console.error('[Auth] Failed to get location token:', error.response?.data || error);
    throw error;
  }
}