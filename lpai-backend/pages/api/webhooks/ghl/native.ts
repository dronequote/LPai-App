// pages/api/webhooks/ghl/native.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { analyzeWebhook, isSystemHealthy } from '../../../../src/utils/webhooks/router';
import { QueueManager } from '../../../../src/utils/webhooks/queueManager';
import { processMessageDirect } from '../../../../src/utils/webhooks/directProcessor';

// GHL Public Key for webhook verification
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

  const receivedAt = new Date();
  
  // Get signature from headers
  const signature = req.headers['x-wh-signature'] as string;
  
  if (!signature) {
    console.log('[Native Webhook] No signature provided');
    return res.status(401).json({ error: 'No signature' });
  }

  // Verify signature
  const payload = JSON.stringify(req.body);
  if (!verifyWebhookSignature(payload, signature)) {
    console.log('[Native Webhook] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Generate webhook ID
  const webhookId = req.body.webhookId || new ObjectId().toString();
  
  // Log webhook type
  const eventType = req.body.type;
  console.log(`[Native Webhook ${webhookId}] Received: ${eventType}`);


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

    // Analyze webhook to determine routing
    const routeDecision = analyzeWebhook(req.body);
    
      console.log(`[Native Webhook ${webhookId}] Route decision:`, {
        type: routeDecision.type,
        queue: routeDecision.queueType,
        priority: routeDecision.priority,
        direct: routeDecision.shouldDirectProcess
      });
    

    // Initialize queue manager
    const queueManager = new QueueManager(db);

    // Check if we should process directly
    if (routeDecision.shouldDirectProcess) {
      const systemHealthy = await isSystemHealthy(db);
      
      if (systemHealthy) {
        // Process immediately in background
        processMessageDirect(db, webhookId, req.body)
          .then(() => {
          console.log(`[Native Webhook ${webhookId}] Received: ${eventType}`);

          })
          .catch((error) => {
            console.error(`[Native Webhook ${webhookId}] Direct processing failed:`, error);
            // Will be picked up by queue processor as backup
          });
      }
    }

    // Always queue (even if direct processing) as backup
    try {
      await queueManager.addToQueue({
        webhookId,
        type: routeDecision.type,
        queueType: routeDecision.queueType,
        priority: routeDecision.priority,
        payload: req.body,
        receivedAt
      });
      
      console.log(`[Native Webhook ${webhookId}] Received: ${eventType}`);

      
    } catch (error: any) {
      if (error.message === 'DUPLICATE_WEBHOOK') {
        console.log(`[Native Webhook ${webhookId}] Duplicate webhook, ignoring`);
        return res.status(200).json({ 
          success: true, 
          webhookId,
          duplicate: true
        });
      }
      throw error;
    }

    // Log unrecognized types for discovery
    if (!routeDecision.isRecognized) {
      await db.collection('webhook_discovery').insertOne({
        _id: new ObjectId(),
        type: routeDecision.type,
        firstSeen: new Date(),
        lastSeen: new Date(),
        count: 1,
        samplePayload: req.body
      });
    }

    // Return 200 immediately (don't block GHL)
    return res.status(200).json({ 
      success: true, 
      webhookId,
      type: routeDecision.type,
      queued: true 
    });
    
  } catch (error: any) {
    console.error(`[Native Webhook ${webhookId}] Fatal error:`, error);
    
    // Still return 200 to prevent GHL from retrying
    return res.status(200).json({ 
      success: false,
      error: 'Internal error',
      webhookId
    });
  }
}