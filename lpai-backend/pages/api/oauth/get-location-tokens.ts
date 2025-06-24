// pages/api/oauth/get-location-tokens.ts
// Updated: 2025-06-24 - Fixed MongoDB update conflict and variable name bug
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';
import { getAuthHeader } from '../../../src/utils/ghlAuth';

// Rate limiting helper
const rateLimiter = new Map<string, { count: number; resetAt: Date }>();

function checkRateLimit(key: string, maxRequests: number = 10): boolean {
  const now = new Date();
  const limit = rateLimiter.get(key);
  
  if (!limit || limit.resetAt < now) {
    rateLimiter.set(key, {
      count: 1,
      resetAt: new Date(now.getTime() + 60000) // 1 minute window
    });
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { companyId, locationId } = req.body;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  // Rate limiting
  if (!checkRateLimit(`company_${companyId}`)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again in a minute.' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get company-level OAuth record
    const companyRecord = await db.collection('locations').findOne({
      companyId: companyId,
      locationId: null,
      isCompanyLevel: true
    });

    if (!companyRecord || !companyRecord.ghlOAuth) {
      return res.status(404).json({ error: 'Company OAuth record not found' });
    }

    console.log('[Get Location Tokens] Found company record:', companyId);

    // First, get company (agency) details
    try {
      const companyResponse = await axios.get(
        `https://services.leadconnectorhq.com/companies/${companyId}`,
        {
          headers: {
            'Authorization': `Bearer ${companyRecord.ghlOAuth.accessToken}`,
            'Version': '2021-07-28'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      const companyData = companyResponse.data.company || companyResponse.data;
      
      // Update company record with agency details
      await db.collection('locations').updateOne(
        { _id: companyRecord._id },
        {
          $set: {
            name: companyData.name || 'Unknown Agency',
            email: companyData.email,
            phone: companyData.phone,
            website: companyData.website,
            address: companyData.address,
            city: companyData.city,
            state: companyData.state,
            country: companyData.country,
            postalCode: companyData.postalCode,
            timezone: companyData.timezone,
            agencyDetails: {
              subdomain: companyData.subdomain,
              status: companyData.status,
              twilioAccountSid: companyData.twilioAccountSid,
              settings: companyData.settings
            },
            updatedAt: new Date()
          }
        }
      );

      console.log(`[Get Location Tokens] Updated agency details for: ${companyData.name}`);
    } catch (error: any) {
      console.error('[Get Location Tokens] Error fetching company details:', error.response?.data || error);
    }

    // If specific locationId provided, get token for that location
    if (locationId) {
      console.log(`[Get Location Tokens] Getting token for specific location: ${locationId}`);
      
      // Check if location already has valid tokens
      const existingLocation = await db.collection('locations').findOne({ 
        locationId,
        'ghlOAuth.accessToken': { $exists: true }
      });
      
      if (existingLocation?.ghlOAuth?.expiresAt) {
        const expiresAt = new Date(existingLocation.ghlOAuth.expiresAt);
        if (expiresAt > new Date()) {
          console.log('[Get Location Tokens] Location already has valid tokens');
          return res.status(200).json({
            success: true,
            message: 'Location already has valid tokens',
            cached: true,
            locationId: locationId,
            companyId: companyId
          });
        }
      }
      
      try {
        // Get token for this specific location
        const tokenResponse = await axios.post(
          'https://services.leadconnectorhq.com/oauth/locationToken',
          new URLSearchParams({
            companyId: companyId,
            locationId: locationId
          }).toString(), // Convert to URL encoded string
          {
            headers: {
              'Authorization': `Bearer ${companyRecord.ghlOAuth.accessToken}`,
              'Version': '2021-07-28',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 15000
          }
        );

        console.log(`[Get Location Tokens] Got token response for location ${locationId}`);

        // Update location with OAuth tokens
        await db.collection('locations').updateOne(
          { locationId: locationId },
          {
            $set: {
              locationId: locationId,
              companyId: companyId,
              ghlOAuth: {
                accessToken: tokenResponse.data.access_token,
                refreshToken: tokenResponse.data.refresh_token, // Use the refresh token from the response!
                expiresAt: new Date(Date.now() + (tokenResponse.data.expires_in * 1000)),
                tokenType: tokenResponse.data.token_type || 'Bearer',
                userType: tokenResponse.data.userType || 'Location',
                scope: tokenResponse.data.scope,
                derivedFromCompany: true,
                installedAt: new Date(),
                needsReauth: false,
                lastRefreshError: null,
                refreshCount: 0,
                lastRefreshed: new Date()
              },
              hasLocationOAuth: true,
              appInstalled: true,
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true }
        );

        console.log(`[Get Location Tokens] Successfully stored token for location ${locationId}`);
        
        // IMPORTANT: Return here to prevent continuing to the "get all locations" logic
        return res.status(200).json({
          success: true,
          locationId: locationId,
          companyId: companyId,
          message: 'Location token obtained successfully'
        });
        
      } catch (error: any) {
        console.error(`[Get Location Tokens] Error getting token for location ${locationId}:`, error.response?.data || error);
        
        // Check if it's a rate limit error from GHL
        if (error.response?.status === 429) {
          return res.status(429).json({ 
            error: 'GHL API rate limit exceeded',
            retryAfter: error.response.headers['retry-after'] || 60
          });
        }
        
        return res.status(500).json({ 
          error: 'Failed to get location token',
          details: error.response?.data 
        });
      }
    } else {
      // Get all locations under the agency
      // Check rate limit for bulk operations
      if (!checkRateLimit(`company_bulk_${companyId}`, 2)) {
        return res.status(429).json({ 
          error: 'Bulk operation rate limit exceeded. Please try again later.' 
        });
      }
      
      try {
        const locationsResponse = await axios.get(
          'https://services.leadconnectorhq.com/locations/search',
          {
            headers: {
              'Authorization': `Bearer ${companyRecord.ghlOAuth.accessToken}`,
              'Version': '2021-07-28'
            },
            params: {
              companyId: companyId,
              limit: 100,
              skip: 0
            },
            timeout: 30000 // 30 second timeout for bulk operations
          }
        );

        const locations = locationsResponse.data.locations || [];
        const totalCount = locationsResponse.data.count || locations.length;
        
        console.log(`[Get Location Tokens] Found ${locations.length} locations (Total: ${totalCount}) for agency`);

        // Store agency-location relationship
        await db.collection('agencies').updateOne(
          { companyId: companyId },
          {
            $set: {
              companyId: companyId,
              name: companyRecord.name || 'Unknown Agency',
              locationCount: totalCount,
              locationsLastSynced: new Date(),
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true }
        );

        // Process locations in batches to avoid timeouts
        const BATCH_SIZE = 5;
        const results = [];
        
        for (let i = 0; i < locations.length; i += BATCH_SIZE) {
          const batch = locations.slice(i, i + BATCH_SIZE);
          
          // Process batch in parallel
          const batchResults = await Promise.allSettled(
            batch.map(async (location) => {
              try {
                // Check if app is installed for this location
                const isInstalled = location.settings?.appInstalled || false;
                
                // Update location in database (even if app not installed)
                await db.collection('locations').updateOne(
                  { locationId: location.id },
                  {
                    $set: {
                      locationId: location.id,
                      companyId: companyId,
                      name: location.name,
                      address: location.address,
                      city: location.city,
                      state: location.state,
                      country: location.country,
                      postalCode: location.postalCode,
                      website: location.website,
                      email: location.email,
                      phone: location.phone,
                      timezone: location.timezone,
                      settings: location.settings || {},
                      social: location.social || {},
                      business: location.business || {},
                      updatedAt: new Date()
                    },
                    $setOnInsert: {
                      createdAt: new Date(),
                      appInstalled: false
                    }
                  },
                  { upsert: true }
                );

                // If app is installed for this location, try to get location-specific token
                if (isInstalled && companyRecord.ghlOAuth) {
                  try {
                    const tokenResponse = await axios.post(
                      'https://services.leadconnectorhq.com/oauth/locationToken',
                      new URLSearchParams({
                        companyId: companyId,
                        locationId: location.id // FIXED: was using undefined locationId variable
                      }).toString(), // Convert to URL encoded string
                      {
                        headers: {
                          'Authorization': `Bearer ${companyRecord.ghlOAuth.accessToken}`,
                          'Version': '2021-07-28',
                          'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        timeout: 15000
                      }
                    );

                    // Update with OAuth tokens
                    await db.collection('locations').updateOne(
                      { locationId: location.id },
                      {
                        $set: {
                          ghlOAuth: {
                            accessToken: tokenResponse.data.access_token,
                            refreshToken: tokenResponse.data.refresh_token, // Use the refresh token from the response!
                            expiresAt: new Date(Date.now() + (tokenResponse.data.expires_in * 1000)),
                            tokenType: tokenResponse.data.token_type || 'Bearer',
                            userType: tokenResponse.data.userType || 'Location',
                            scope: tokenResponse.data.scope,
                            derivedFromCompany: true,
                            installedAt: new Date(),
                            needsReauth: false,
                            lastRefreshError: null,
                            refreshCount: 0,
                            lastRefreshed: new Date()
                          },
                          hasLocationOAuth: true,
                          appInstalled: true
                        }
                      }
                    );

                    return {
                      locationId: location.id,
                      name: location.name,
                      success: true,
                      hasToken: true
                    };
                  } catch (tokenError: any) {
                    console.error(`[Get Location Tokens] Token error for ${location.id}:`, tokenError.message);
                    return {
                      locationId: location.id,
                      name: location.name,
                      success: true,
                      hasToken: false,
                      tokenError: 'Failed to get location token'
                    };
                  }
                } else {
                  return {
                    locationId: location.id,
                    name: location.name,
                    success: true,
                    hasToken: false,
                    appInstalled: isInstalled
                  };
                }

              } catch (err: any) {
                console.error(`[Get Location Tokens] Failed for location ${location.id}:`, err);
                return {
                  locationId: location.id,
                  name: location.name,
                  success: false,
                  error: err.message
                };
              }
            })
          );
          
          // Collect results
          batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              results.push({
                locationId: batch[index].id,
                name: batch[index].name,
                success: false,
                error: result.reason?.message || 'Unknown error'
              });
            }
          });
          
          // Add small delay between batches to avoid rate limits
          if (i + BATCH_SIZE < locations.length) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
          }
        }

        // If there are more locations, note it in the response
        const hasMore = totalCount > locations.length;

        return res.status(200).json({
          success: true,
          companyId: companyId,
          agencyName: companyRecord.name,
          totalLocations: totalCount,
          locationsProcessed: results.length,
          hasMore: hasMore,
          results: results
        });

      } catch (error: any) {
        console.error('[Get Location Tokens] Error fetching locations:', error.response?.data || error);
        return res.status(500).json({ 
          error: 'Failed to fetch locations',
          details: error.response?.data 
        });
      }
    }

  } catch (error: any) {
    console.error('[Get Location Tokens] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}