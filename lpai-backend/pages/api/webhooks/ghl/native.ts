// pages/api/webhooks/ghl/native.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

// GHL Public Key from the docs for webhook verification
const GHL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

function verifyWebhookSignature(payload: string, signature: string): boolean {
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(payload);
    verifier.end();
    return verifier.verify(GHL_PUBLIC_KEY, signature, 'base64');
  } catch (error) {
    console.error('[Webhook Verification] Error:', error);
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get signature from headers - note it's x-wh-signature per the docs
  const signature = req.headers['x-wh-signature'] as string;
  
  if (!signature) {
    console.log('[Native Webhook] No signature provided');
    return res.status(401).json({ error: 'No signature' });
  }

  // Verify signature with the EXACT payload as string
  const payload = JSON.stringify(req.body);
  if (!verifyWebhookSignature(payload, signature)) {
    console.log('[Native Webhook] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Use webhookId from payload if available, otherwise generate
  const webhookId = req.body.webhookId || new ObjectId().toString();
  
  // Log webhook type for debugging
  if (req.body.type) {
    console.log(`[Native Webhook ${webhookId}] Received: ${req.body.type}`);
  } else {
    console.log(`[Native Webhook ${webhookId}] Received webhook without type field`);
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Check timestamp to prevent replay attacks (within 5 minutes)
    if (req.body.timestamp) {
      const webhookTime = new Date(req.body.timestamp).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (Math.abs(now - webhookTime) > fiveMinutes) {
        console.error(`[Native Webhook ${webhookId}] Timestamp too old, possible replay attack`);
        return res.status(200).json({ success: false, error: 'Timestamp expired' });
      }
    }

    // Native webhooks have the event type in the 'type' field
    const eventType = req.body.type;
    
    if (!eventType) {
      console.error(`[Native Webhook ${webhookId}] No event type in payload`);
      return res.status(200).json({ success: false, error: 'No event type' });
    }

    // Extract locationId - it's directly in the payload for native webhooks
    const locationId = req.body.locationId;
    
    if (!locationId) {
      console.warn(`[Native Webhook ${webhookId}] No location ID found in payload`);
    }

    // Queue webhook for processing
    await db.collection('webhook_queue').insertOne({
      _id: new ObjectId(),
      webhookId,
      type: eventType, // This will be 'ContactCreate', 'AppointmentUpdate', etc.
      payload: req.body,
      locationId: locationId,
      source: 'native', // Mark as native webhook
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
      processAfter: new Date(), // Process immediately
      // Store key identifiers for easier debugging
      metadata: {
        contactId: req.body.id || req.body.contactId,
        email: req.body.email,
        appointmentId: req.body.appointment?.id,
        opportunityId: req.body.id,
        invoiceId: req.body._id,
        orderId: req.body._id
      }
    });

    console.log(`[Native Webhook ${webhookId}] Queued ${eventType} webhook for location ${locationId}`);

    // Log webhook to separate collection for debugging (optional)
    await db.collection('webhook_logs').insertOne({
      _id: new ObjectId(),
      webhookId,
      type: eventType,
      locationId,
      payload: req.body,
      signature,
      verified: true,
      receivedAt: new Date()
    });

    // Return 200 immediately (don't block GHL)
    return res.status(200).json({ 
      success: true, 
      webhookId,
      type: eventType,
      queued: true 
    });
    
  } catch (error: any) {
    console.error(`[Native Webhook ${webhookId}] Queue error:`, error);
    
    // Still return 200 to prevent GHL from retrying
    return res.status(200).json({ 
      success: false,
      error: 'Internal error',
      webhookId
    });
  }
}