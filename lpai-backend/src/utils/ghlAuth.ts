// src/utils/ghlAuth.ts
import axios from 'axios';
import clientPromise from '../lib/mongodb';

export interface AuthResult {
  header: string;
  type: 'oauth' | 'apikey';
  needsRefresh?: boolean;
}

export async function getAuthHeader(location: any): Promise<AuthResult> {
  // Check if we have OAuth tokens
  if (location.ghlOAuth?.accessToken) {
    // Check if token is expired
    const expiresAt = new Date(location.ghlOAuth.expiresAt);
    const now = new Date();
    
    if (expiresAt < now) {
      console.log(`[Auth] Token expired for location ${location.locationId}, needs refresh`);
      // Token expired, try to refresh
      const refreshed = await refreshOAuthToken(location);
      if (refreshed) {
        return {
          header: `Bearer ${refreshed.accessToken}`,
          type: 'oauth',
          needsRefresh: false
        };
      }
    }
    
    return {
      header: `Bearer ${location.ghlOAuth.accessToken}`,
      type: 'oauth',
      needsRefresh: false
    };
  }
  
  // Fall back to API key
  if (location.apiKey) {
    return {
      header: location.apiKey,
      type: 'apikey',
      needsRefresh: false
    };
  }
  
  throw new Error(`No authentication method available for location ${location.locationId || location._id}`);
}

export async function refreshOAuthToken(location: any): Promise<any> {
  if (!location.ghlOAuth?.refreshToken) {
    console.error('[Auth] No refresh token available');
    return null;
  }
  
  try {
    console.log('[Auth] Refreshing OAuth token...');
    
    const response = await axios.post(
      'https://services.leadconnectorhq.com/oauth/token',
      new URLSearchParams({
        client_id: process.env.GHL_MARKETPLACE_CLIENT_ID!,
        client_secret: process.env.GHL_MARKETPLACE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: location.ghlOAuth.refreshToken
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );
    
    const { access_token, refresh_token, expires_in } = response.data;
    
    // Update tokens in database
    const client = await clientPromise;
    const db = client.db('lpai');
    
    await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          'ghlOAuth.accessToken': access_token,
          'ghlOAuth.refreshToken': refresh_token,
          'ghlOAuth.expiresAt': new Date(Date.now() + (expires_in * 1000)),
          'ghlOAuth.lastRefreshed': new Date()
        }
      }
    );
    
    console.log('[Auth] Token refreshed successfully');
    
    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + (expires_in * 1000))
    };
    
  } catch (error: any) {
    console.error('[Auth] Token refresh failed:', error.response?.data || error);
    return null;
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