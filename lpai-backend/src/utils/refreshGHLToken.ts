// src/utils/refreshGHLToken.ts
import axios from 'axios';
import { Db } from 'mongodb';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  userType: string;
}

export async function refreshGHLToken(db: Db, location: any) {
  console.log(`[Token Refresh] Starting for location ${location.locationId}`);
  
  try {
    // Check if we have OAuth tokens
    if (!location.ghlOAuth?.refreshToken) {
      console.log(`[Token Refresh] No refresh token found for ${location.locationId}`);
      return null;
    }

    // Check if token is expired or expiring soon (within 1 hour)
    const expiresAt = new Date(location.ghlOAuth.expiresAt);
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    if (expiresAt > oneHourFromNow) {
      console.log(`[Token Refresh] Token still valid until ${expiresAt.toISOString()}`);
      return location.ghlOAuth.accessToken;
    }

    console.log(`[Token Refresh] Token expired or expiring soon, refreshing...`);

    // Refresh the token
    const response = await axios.post(
      'https://services.leadconnectorhq.com/oauth/token',
      {
        grant_type: 'refresh_token',
        refresh_token: location.ghlOAuth.refreshToken,
        client_id: process.env.GHL_MARKETPLACE_CLIENT_ID,
        client_secret: process.env.GHL_MARKETPLACE_CLIENT_SECRET
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );

    const tokenData: TokenResponse = response.data;
    
    // Calculate new expiry time
    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in);

    // Update location with new tokens
    const updateResult = await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          'ghlOAuth.accessToken': tokenData.access_token,
          'ghlOAuth.refreshToken': tokenData.refresh_token,
          'ghlOAuth.expiresAt': newExpiresAt,
          'ghlOAuth.tokenType': tokenData.token_type,
          'ghlOAuth.lastRefreshed': new Date()
        }
      }
    );

    console.log(`[Token Refresh] Successfully refreshed token for ${location.locationId}`);
    return tokenData.access_token;

  } catch (error: any) {
    console.error(`[Token Refresh] Error:`, error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      // Invalid refresh token - user needs to re-authenticate
      console.error(`[Token Refresh] Invalid refresh token for ${location.locationId}`);
      
      // Mark location as needing re-auth
      await db.collection('locations').updateOne(
        { _id: location._id },
        {
          $set: {
            'ghlOAuth.needsReauth': true,
            'ghlOAuth.reauthReason': 'Invalid refresh token',
            'ghlOAuth.reauthDate': new Date()
          }
        }
      );
    }
    
    throw error;
  }
}

// Helper function to check if token needs refresh
export function tokenNeedsRefresh(location: any): boolean {
  if (!location.ghlOAuth?.expiresAt) return true;
  
  const expiresAt = new Date(location.ghlOAuth.expiresAt);
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  
  return expiresAt <= oneHourFromNow;
}