// src/utils/ghlAuth.ts
// Update the tokenNeedsRefresh function to check expiration properly with a 4-hour buffer

export function tokenNeedsRefresh(location: any): boolean {
  // Check if we have OAuth data
  if (!location.ghlOAuth?.accessToken || !location.ghlOAuth?.refreshToken) {
    return false;
  }

  // If already marked as needing reauth, don't try to refresh (it will fail)
  if (location.ghlOAuth.needsReauth) {
    console.log(`[Token Check] ${location.locationId} needs manual reauth`);
    return false;
  }

  // Check if we have an expiration time
  if (!location.ghlOAuth.expiresAt) {
    console.log(`[Token Check] ${location.locationId} missing expiresAt - needs refresh`);
    return true;
  }

  // Convert expiresAt to Date if it's a string
  const expiresAt = new Date(location.ghlOAuth.expiresAt);
  const now = new Date();
  
  // Add 4-hour buffer (refresh if token expires in less than 4 hours)
  const fourHoursFromNow = new Date(now.getTime() + (4 * 60 * 60 * 1000));
  
  // Check if token expires within the next 4 hours
  const needsRefresh = expiresAt <= fourHoursFromNow;
  
  if (needsRefresh) {
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    console.log(`[Token Check] ${location.locationId} token expires in ${hoursUntilExpiry.toFixed(1)} hours - needs refresh`);
    console.log(`[Token Check] Current time: ${now.toISOString()}`);
    console.log(`[Token Check] Token expires: ${expiresAt.toISOString()}`);
  }
  
  return needsRefresh;
}

// Also update the refreshOAuthToken function to properly set expiresAt
export async function refreshOAuthToken(location: any): Promise<void> {
  const { locationId } = location;
  
  console.log(`[OAuth Refresh] Starting refresh for location ${locationId}`);
  
  try {
    // Make the refresh request to GHL
    const response = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GHL_MARKETPLACE_CLIENT_ID!,
        client_secret: process.env.GHL_MARKETPLACE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: location.ghlOAuth.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[OAuth Refresh] Error response:`, errorData);
      
      // If we get invalid_grant, mark for reauth
      if (errorData.error === 'invalid_grant') {
        await updateLocationOAuth(locationId, {
          needsReauth: true,
          lastRefreshError: errorData.error_description || 'Invalid refresh token',
          lastRefreshAttempt: new Date(),
        });
      }
      
      throw new Error(errorData.error_description || 'Failed to refresh token');
    }

    const data = await response.json();
    
    // Calculate new expiration time
    // GHL tokens typically expire in 86400 seconds (24 hours)
    const expiresIn = data.expires_in || 86400;
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));
    
    console.log(`[OAuth Refresh] Token refreshed successfully`);
    console.log(`[OAuth Refresh] New token expires in ${expiresIn} seconds`);
    console.log(`[OAuth Refresh] New expiration: ${expiresAt.toISOString()}`);
    
    // Update the location with new tokens
    await updateLocationOAuth(locationId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || location.ghlOAuth.refreshToken, // Some providers don't return new refresh token
      expiresAt: expiresAt,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope || location.ghlOAuth.scope,
      lastRefreshAttempt: new Date(),
      lastRefreshError: null,
      needsReauth: false,
    });
    
    console.log(`[OAuth Refresh] Location ${locationId} updated successfully`);
    
  } catch (error: any) {
    console.error(`[OAuth Refresh] Failed for ${locationId}:`, error.message);
    
    // Update with error info
    await updateLocationOAuth(locationId, {
      lastRefreshAttempt: new Date(),
      lastRefreshError: error.message,
    });
    
    throw error;
  }
}

// Helper function to update location OAuth data
async function updateLocationOAuth(locationId: string, updates: any): Promise<void> {
  const client = await clientPromise;
  const db = client.db('lpai');
  
  await db.collection('locations').updateOne(
    { locationId },
    {
      $set: {
        'ghlOAuth': {
          ...updates,
          updatedAt: new Date(),
        }
      }
    }
  );
}