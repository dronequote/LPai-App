// pages/api/oauth/callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { acquireInstallLock, releaseInstallLock } from '../../../src/utils/installQueue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, locationId, companyId } = req.query;
  
  console.log('[OAuth Callback] Received:', { code, locationId, companyId });

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  try {
    // Exchange code for tokens
    console.log('[OAuth Callback] Exchanging code for tokens...');
    console.log('[OAuth Debug] Full query params:', req.query);
    console.log('[OAuth Debug] Full URL:', req.url);
    console.log('[OAuth Debug] Headers:', req.headers);
    
    const tokenResponse = await axios.post(
      'https://services.leadconnectorhq.com/oauth/token',
      new URLSearchParams({
        client_id: process.env.GHL_MARKETPLACE_CLIENT_ID!,
        client_secret: process.env.GHL_MARKETPLACE_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: `${process.env.NEXT_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app'}/api/oauth/callback`
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );

    console.log('[OAuth Callback] Token response:', tokenResponse.data);

    // Extract data from response
    const { 
      access_token, 
      refresh_token, 
      expires_in, 
      locationId: tokenLocationId,
      userId,
      companyId: tokenCompanyId,
      userType,
      approvedLocations
    } = tokenResponse.data;

    const finalLocationId = tokenLocationId || locationId;
    const finalCompanyId = tokenCompanyId || companyId;

    // Acquire install lock
    const lockKey = `oauth_${finalCompanyId}_${finalLocationId || 'company'}_${Date.now()}`;
    let lockAcquired = false;

    try {
      lockAcquired = await acquireInstallLock(
        db,
        finalCompanyId,
        finalLocationId,
        lockKey
      );

      if (!lockAcquired) {
        console.log(`[OAuth Callback] Install already in progress for ${finalLocationId || finalCompanyId}`);
        
        // Return a "processing" page that auto-refreshes
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Installation In Progress</title>
            <meta http-equiv="refresh" content="5">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 500px;
              }
              h1 { color: #2E86AB; margin-bottom: 10px; }
              p { color: #666; line-height: 1.6; }
              .spinner {
                border: 3px solid #f3f3f3;
                border-top: 3px solid #2E86AB;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 20px auto;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .details {
                background: #f0f0f0;
                padding: 15px;
                border-radius: 4px;
                margin: 20px 0;
                font-size: 14px;
                text-align: left;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>⏳ Installation In Progress</h1>
              <div class="spinner"></div>
              <p>Another installation is currently being processed for this location.</p>
              <div class="details">
                <strong>Location:</strong> ${finalLocationId || 'Company-level'}<br>
                <strong>Company:</strong> ${finalCompanyId || 'Unknown'}
              </div>
              <p>This page will refresh automatically every 5 seconds...</p>
            </div>
          </body>
          </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      }

      // Handle based on userType
      if (userType === 'Company' && !tokenLocationId) {
        // Company-level install
        console.log('[OAuth Callback] Company-level install detected');
        
        // Store company-level tokens
        await db.collection('locations').updateOne(
          { companyId: finalCompanyId, locationId: null },
          {
            $set: {
              companyId: finalCompanyId,
              ghlOAuth: {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: new Date(Date.now() + (expires_in * 1000)),
                tokenType: 'Bearer',
                userType: 'Company',
                installedAt: new Date(),
                installedBy: userId,
                approvedLocations: approvedLocations || []
              },
              isCompanyLevel: true,
              updatedAt: new Date()
            },
            $setOnInsert: {
              locationId: null,
              name: 'Company-Level OAuth',
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
        
        console.log('[OAuth Callback] Company tokens stored');
        
        // If we have approved locations, create/update records for them
        if (approvedLocations && approvedLocations.length > 0) {
          console.log('[OAuth Callback] Processing approved locations:', approvedLocations);
          
          for (const locId of approvedLocations) {
            await db.collection('locations').updateOne(
              { locationId: locId },
              {
                $set: {
                  companyId: finalCompanyId,
                  hasCompanyOAuth: true,
                  approvedViaCompany: true,
                  updatedAt: new Date()
                },
                $setOnInsert: {
                  name: `Location ${locId}`,
                  createdAt: new Date()
                }
              },
              { upsert: true }
            );
          }
        }
        
      } else if (tokenLocationId) {
        // Location-level install
        console.log('[OAuth Callback] Location-level install for:', tokenLocationId);
        
        // Check if location exists, create if not
        const existingLocation = await db.collection('locations').findOne({
          locationId: tokenLocationId
        });

        if (!existingLocation) {
          console.log('[OAuth Callback] Creating new location record');
          await db.collection('locations').insertOne({
            locationId: tokenLocationId,
            companyId: finalCompanyId,
            name: 'New Location', // Will be updated by webhook
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        // Update location with OAuth tokens
        const updateResult = await db.collection('locations').updateOne(
          { locationId: tokenLocationId },
          {
            $set: {
              ghlOAuth: {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: new Date(Date.now() + (expires_in * 1000)),
                tokenType: 'Bearer',
                userType: userType || 'Location',
                installedAt: new Date(),
                installedBy: userId
              },
              companyId: finalCompanyId,
              hasLocationOAuth: true,
              updatedAt: new Date()
            },
              $unset: {
              uninstalledAt: "",      // Clear uninstall timestamp
              uninstallReason: "",    // Clear uninstall reason
              uninstallWebhookId: ""  // Clear uninstall webhook ID
            }
          }
        );

        console.log('[OAuth Callback] Location tokens stored for:', tokenLocationId);
      }

      // After storing tokens...
        console.log('[OAuth Callback] Location tokens stored');

        // Add to setup queue for reliable processing
        await db.collection('install_retry_queue').insertOne({
          _id: new ObjectId(),
          webhookId: `setup_${tokenLocationId || finalCompanyId}_${Date.now()}`,
          payload: {
            type: 'INSTALL',
            locationId: tokenLocationId || finalCompanyId
          },
          reason: 'oauth_callback_setup',
          attempts: 0,
          status: 'pending',
          createdAt: new Date(),
          nextRetryAt: new Date() // Process immediately
        });

        console.log('[OAuth Callback] Added to setup queue for reliable processing');

      // Redirect to progress page
      const progressUrl = `/api/sync/progress/${tokenLocationId || finalCompanyId}?ui=true`;
      console.log('[OAuth Callback] Redirecting to:', progressUrl);

      res.writeHead(302, { Location: progressUrl });
      return res.end();
      } finally {
      // Always release the lock when done
      if (lockAcquired) {
        await releaseInstallLock(db, finalCompanyId, finalLocationId, lockKey);
        console.log(`[OAuth Callback] Released lock for ${finalLocationId || finalCompanyId}`);
      }
    }

  } catch (error: any) {
    console.error('[OAuth Callback] Error:', error.response?.data || error);
    
    // Error page
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Installation Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          h1 { color: #E74C3C; margin-bottom: 10px; }
          p { color: #666; line-height: 1.6; }
          .error { 
            background: #fee; 
            padding: 15px; 
            border-radius: 4px; 
            color: #c00;
            margin: 20px 0;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Installation Failed</h1>
          <p>There was an error installing the LPai App.</p>
          <div class="error">${error.response?.data?.error || error.message || 'Unknown error occurred'}</div>
          <p>Please try again or contact support if the problem persists.</p>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(errorHtml);
  }
}