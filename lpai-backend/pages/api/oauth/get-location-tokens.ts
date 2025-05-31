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

    // If specific locationId provided, get token for that location
    if (locationId) {
      try {
        // Use company token to get location-specific token
        const locationTokenResponse = await axios.post(
          'https://services.leadconnectorhq.com/oauth/locationToken',
          {
            companyId: companyId,
            locationId: locationId
          },
          {
            headers: {
              'Authorization': `Bearer ${companyRecord.ghlOAuth.accessToken}`,
              'Version': '2021-07-28',
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        const { access_token, expires_in, scope } = locationTokenResponse.data;

        // Update location record with its own tokens
        await db.collection('locations').updateOne(
          { locationId: locationId },
          {
            $set: {
              locationId: locationId,
              companyId: companyId,
              ghlOAuth: {
                accessToken: access_token,
                refreshToken: companyRecord.ghlOAuth.refreshToken, // Use company refresh token
                expiresAt: new Date(Date.now() + (expires_in * 1000)),
                tokenType: 'Bearer',
                userType: 'Location',
                scope: scope,
                derivedFromCompany: true,
                installedAt: new Date()
              },
              hasLocationOAuth: true,
              updatedAt: new Date()
            },
            $setOnInsert: {
              name: `Location ${locationId}`,
              createdAt: new Date()
            }
          },
          { upsert: true }
        );

        console.log('[Get Location Tokens] Location token obtained for:', locationId);

        return res.status(200).json({
          success: true,
          locationId: locationId,
          message: 'Location token obtained successfully'
        });

      } catch (error: any) {
        console.error('[Get Location Tokens] Error getting location token:', error.response?.data || error);
        return res.status(500).json({ 
          error: 'Failed to get location token',
          details: error.response?.data 
        });
      }
    } else {
      // Get all locations for the company
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
              limit: 100
            }
          }
        );

        const locations = locationsResponse.data.locations || [];
        console.log(`[Get Location Tokens] Found ${locations.length} locations for company`);

        // Process each location
        const results = [];
        for (const location of locations) {
          try {
            // Get location-specific token
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

            // Update location in database
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
                  settings: location.settings || {},
                  updatedAt: new Date()
                },
                $setOnInsert: {
                  createdAt: new Date()
                }
              },
              { upsert: true }
            );

            results.push({
              locationId: location.id,
              name: location.name,
              success: true
            });

          } catch (err) {
            console.error(`[Get Location Tokens] Failed for location ${location.id}:`, err);
            results.push({
              locationId: location.id,
              name: location.name,
              success: false,
              error: err.message
            });
          }
        }

        return res.status(200).json({
          success: true,
          companyId: companyId,
          locationsProcessed: results.length,
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