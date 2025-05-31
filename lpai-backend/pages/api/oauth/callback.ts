// pages/api/oauth/callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, locationId, companyId } = req.query;
  
  console.log('[OAuth Callback] Received:', { code, locationId, companyId });

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Exchange code for tokens
    console.log('[OAuth Callback] Exchanging code for tokens...');
    
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
      companyId: tokenCompanyId 
    } = tokenResponse.data;

    const finalLocationId = tokenLocationId || locationId;

    // Check if location exists, create if not
    const existingLocation = await db.collection('locations').findOne({
      locationId: finalLocationId
    });

    if (!existingLocation) {
      console.log('[OAuth Callback] Creating new location record');
      await db.collection('locations').insertOne({
        locationId: finalLocationId,
        companyId: tokenCompanyId || companyId,
        name: 'New Location', // Will be updated by webhook
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Update location with OAuth tokens
    const updateResult = await db.collection('locations').updateOne(
      { locationId: finalLocationId },
      {
        $set: {
          ghlOAuth: {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: new Date(Date.now() + (expires_in * 1000)),
            tokenType: 'Bearer',
            installedAt: new Date(),
            installedBy: userId
          },
          companyId: tokenCompanyId || companyId,
          updatedAt: new Date()
        }
      }
    );

    console.log('[OAuth Callback] Tokens stored for location:', finalLocationId);
    console.log('[OAuth Callback] Update result:', updateResult);

    // For now, return a simple success page
    // Later you can redirect to a nice success page
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Installation Successful</title>
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
          h1 { color: #2E86AB; margin-bottom: 10px; }
          p { color: #666; line-height: 1.6; }
          .success { color: #27AE60; font-weight: 600; }
          .location-id { 
            background: #f0f0f0; 
            padding: 10px; 
            border-radius: 4px; 
            font-family: monospace;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Installation Successful!</h1>
          <p class="success">LPai App has been successfully installed.</p>
          <div class="location-id">Location ID: ${finalLocationId}</div>
          <p>The app is now connected and webhooks will begin flowing automatically.</p>
          <p style="margin-top: 30px; font-size: 14px;">You can close this window.</p>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);

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