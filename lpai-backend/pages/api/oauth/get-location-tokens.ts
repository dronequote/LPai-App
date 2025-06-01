// pages/api/oauth/get-location-tokens.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';
import { getAuthHeader } from '../../../src/utils/ghlAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { companyId, locationId } = req.body;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
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
          }
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
      // ... (keep existing location-specific code)
    } else {
      // Get all locations under the agency
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
            }
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

        // Process each location
        const results = [];
        for (const location of locations) {
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
                  {
                    companyId: companyId,
                    locationId: location.id
                  },
                  {
                    headers: {
                      'Authorization': `Bearer ${companyRecord.ghlOAuth.accessToken}`,
                      'Version': '2021-07-28',
                      'Content-Type': 'application/x-www-form-urlencoded'
                    }
                  }
                );

                // Update with OAuth tokens
                await db.collection('locations').updateOne(
                  { locationId: location.id },
                  {
                    $set: {
                      ghlOAuth: {
                        accessToken: tokenResponse.data.access_token,
                        refreshToken: companyRecord.ghlOAuth.refreshToken,
                        expiresAt: new Date(Date.now() + (tokenResponse.data.expires_in * 1000)),
                        tokenType: 'Bearer',
                        userType: 'Location',
                        scope: tokenResponse.data.scope,
                        derivedFromCompany: true,
                        installedAt: new Date()
                      },
                      hasLocationOAuth: true,
                      appInstalled: true
                    }
                  }
                );

                results.push({
                  locationId: location.id,
                  name: location.name,
                  success: true,
                  hasToken: true
                });
              } catch (tokenError) {
                console.error(`[Get Location Tokens] Token error for ${location.id}:`, tokenError);
                results.push({
                  locationId: location.id,
                  name: location.name,
                  success: true,
                  hasToken: false,
                  tokenError: 'Failed to get location token'
                });
              }
            } else {
              results.push({
                locationId: location.id,
                name: location.name,
                success: true,
                hasToken: false,
                appInstalled: isInstalled
              });
            }

          } catch (err: any) {
            console.error(`[Get Location Tokens] Failed for location ${location.id}:`, err);
            results.push({
              locationId: location.id,
              name: location.name,
              success: false,
              error: err.message
            });
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