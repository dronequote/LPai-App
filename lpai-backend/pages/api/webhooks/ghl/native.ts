// pages/api/webhooks/ghl/native.ts
// Updated: 2025-06-24 - Added direct processing for messages
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

    // Check for duplicate outbound messages BEFORE any processing
    if (eventType === 'OutboundMessage' && req.body.messageId) {
      const existingMessage = await db.collection('messages').findOne({
        ghlMessageId: req.body.messageId
      });
      
      if (existingMessage) {
        console.log(`[Native Webhook ${webhookId}] Duplicate outbound message ${req.body.messageId}, skipping`);
        return res.status(200).json({ 
          success: true, 
          skipped: true, 
          reason: 'Duplicate outbound message' 
        });
      }
    }

    // Parse the webhook data from the body
    const webhookData = req.body;
    
    // Handle nested webhook structure for native webhooks
    let parsedPayload;
    if (webhookData.webhookPayload) {
      // Native webhook structure
      parsedPayload = {
        ...webhookData.webhookPayload,
        type: webhookData.type,
        locationId: webhookData.locationId || webhookData.webhookPayload.locationId,
        companyId: webhookData.companyId || webhookData.webhookPayload.companyId,
        timestamp: webhookData.timestamp || webhookData.webhookPayload.timestamp || new Date().toISOString(),
        webhookId: webhookData.webhookId,
        // Add the entire webhook payload as nested data in case we need it
        webhookPayload: webhookData.webhookPayload
      };
    } else {
      // Direct webhook structure
      parsedPayload = webhookData;
    }

    // Check system health
    const systemHealthy = await isSystemHealthy(db);
    if (!systemHealthy) {
      console.warn(`[Native Webhook ${webhookId}] System unhealthy, queuing with lower priority`);
    }

    // NEW: Fast-track message processing
    const { type, locationId } = parsedPayload;
    
    if (type === 'InboundMessage' || type === 'OutboundMessage') {
      console.log(`[Native Webhook ${webhookId}] Attempting direct processing for ${type}`);
      
      try {
        // Extract the actual message data for direct processor
        let directPayload;
        
        if (parsedPayload.webhookPayload) {
          // Native webhook format - unwrap it
          directPayload = {
            type,
            locationId: parsedPayload.locationId || parsedPayload.webhookPayload.locationId,
            timestamp: parsedPayload.timestamp || parsedPayload.webhookPayload.timestamp,
            ...parsedPayload.webhookPayload  // Spread the actual webhook data
          };
        } else {
          // Already in direct format (from req.body)
          directPayload = webhookData;
        }
        
        // Log the payload structure for debugging
        console.log(`[Native Webhook ${webhookId}] Direct payload keys:`, Object.keys(directPayload));
        
        // Process directly for instant updates
        await processMessageDirect(db, webhookId, directPayload);
        
        console.log(`[Native Webhook ${webhookId}] Direct processing successful for ${type}`);
        
        // Still queue as backup but mark as already processed
        const queueManager = new QueueManager(db);
        await queueManager.addToQueue({
          webhookId,
          type,
          payload: parsedPayload,
          queueType: 'messages',
          priority: 2,
          receivedAt,
          metadata: { 
            directProcessed: true,
            directProcessedAt: new Date()
          }
        });
        
        // Return early - we're done!
        return res.status(200).json({ 
          success: true, 
          processed: 'direct',
          webhookId 
        });
        
      } catch (directError: any) {
        console.error(`[Native Webhook ${webhookId}] Direct processing failed for ${type}:`, directError.message);
        // Fall through to normal queue processing
      }
    }

    // Analyze webhook for routing
    const routingResult = analyzeWebhook(parsedPayload);
    console.log(`[Native Webhook ${webhookId}] Routing: queue=${routingResult.queueType}, priority=${routingResult.priority}`);

    // Queue for processing
    const queueManager = new QueueManager(db);
    const queueItem = await queueManager.addToQueue({
      webhookId,
      type: parsedPayload.type,
      payload: parsedPayload,
      queueType: routingResult.queueType,
      priority: routingResult.priority,
      receivedAt,
      metadata: {
        source: 'native',
        systemHealthy,
        routerAnalysis: routingResult
      }
    });

    console.log(`[Native Webhook ${webhookId}] Queued successfully as ${queueItem._id}`);

    // Store webhook for discovery/monitoring
    await db.collection('webhook_discovery').insertOne({
      _id: new ObjectId(),
      webhookId,
      type: parsedPayload.type,
      locationId: parsedPayload.locationId,
      companyId: parsedPayload.companyId,
      receivedAt,
      queuedAt: new Date(),
      queueType: routingResult.queueType,
      priority: routingResult.priority,
      structure: {
        hasWebhookPayload: !!webhookData.webhookPayload,
        topLevelKeys: Object.keys(webhookData),
        payloadKeys: webhookData.webhookPayload ? Object.keys(webhookData.webhookPayload) : [],
        nestedDepth: webhookData.webhookPayload ? 2 : 1
      },
      ttl: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    // Always return success to GHL
    return res.status(200).json({ success: true, webhookId });

  } catch (error: any) {
    console.error(`[Native Webhook ${webhookId}] Fatal error:`, error);
    
    // Still return 200 to prevent GHL retries
    return res.status(200).json({ 
      success: false, 
      error: error.message,
      webhookId 
    });
  }
}

// Vercel configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};