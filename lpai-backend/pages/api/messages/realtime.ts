// lpai-backend/pages/api/messages/realtime.ts
// Real-time message streaming via Server-Sent Events (SSE)

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { messageEvents } from '../../../src/utils/webhooks/directProcessor';
import clientPromise from '../../../src/lib/mongodb';

// Track active connections for monitoring
const activeConnections = new Map<string, {
  userId: string;
  locationId: string;
  contactObjectId: string;
  startTime: Date;
}>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests for SSE
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { locationId, contactObjectId } = req.query;
  const token = req.headers.authorization?.replace('Bearer ', '') || (req.query.token as string);

  // Validate required parameters
  if (!locationId || !contactObjectId || !token) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      required: ['locationId', 'contactObjectId', 'Authorization header']
    });
  }

  // Verify JWT token and extract user info
  let userId: string;
  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    userId = decoded.userId;
    
    if (!userId) {
      throw new Error('Invalid token: missing userId');
    }
  } catch (error: any) {
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      message: error.message 
    });
  }

  // Verify user has access to this location
  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    // FIX: Use ghlUserId instead of _id since JWT contains GHL user ID
    const user = await db.collection('users').findOne({
      ghlUserId: userId,  // Changed from _id to ghlUserId
      locationId: locationId
    });

    if (!user) {
      console.log('[SSE] Access denied for:', {
        ghlUserId: userId,
        locationId: locationId,
        message: 'User not found with these credentials'
      });
      
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'User does not have access to this location' 
      });
    }
    
    console.log('[SSE] User authenticated:', user.email);
  } catch (error) {
    console.error('[SSE] Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering
  });

  // Send initial connection success event
  res.write(`data: ${JSON.stringify({ 
    type: 'connected', 
    timestamp: new Date().toISOString(),
    message: 'Real-time connection established'
  })}\n\n`);

  // Create unique connection ID
  const connectionId = `${userId}:${locationId}:${contactObjectId}:${Date.now()}`;
  
  // Track connection
  activeConnections.set(connectionId, {
    userId,
    locationId: locationId as string,
    contactObjectId: contactObjectId as string,
    startTime: new Date()
  });

  console.log(`[SSE] New connection: ${connectionId}`);
  console.log(`[SSE] Active connections: ${activeConnections.size}`);

  // Heartbeat to keep connection alive (every 30 seconds)
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    } catch (error) {
      // Connection closed, cleanup will happen in close handler
      clearInterval(heartbeat);
    }
  }, 30000);

  // Message handler for this specific conversation
  const conversationMessageHandler = (data: any) => {
    try {
      // Add timestamp if not present
      if (!data.timestamp) {
        data.timestamp = new Date().toISOString();
      }
      
      // Send the message event
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      
      // Log for debugging
      console.log(`[SSE] Sent message to ${connectionId}:`, data.type);
    } catch (error) {
      console.error(`[SSE] Error sending message to ${connectionId}:`, error);
      // Client disconnected, will cleanup in close handler
    }
  };

  // User-specific handler (for messages assigned to this user)
  const userMessageHandler = (data: any) => {
    try {
      // Only send if it's for a different contact (avoid duplicates)
      if (data.contactId?.toString() !== contactObjectId) {
        res.write(`data: ${JSON.stringify({
          ...data,
          type: 'assigned_message' // Differentiate from conversation messages
        })}\n\n`);
      }
    } catch (error) {
      // Client disconnected
    }
  };

  // Location-wide handler (for dashboards, analytics, etc.)
  const locationMessageHandler = (data: any) => {
    try {
      // Only send if user wants location-wide updates (could be a preference)
      if (data.contactId?.toString() !== contactObjectId) {
        res.write(`data: ${JSON.stringify({
          ...data,
          type: 'location_message' // Differentiate from direct messages
        })}\n\n`);
      }
    } catch (error) {
      // Client disconnected
    }
  };

  // Subscribe to events
  const conversationEvent = `message:${locationId}:${contactObjectId}`;
  const userEvent = `user:${userId}`;
  const locationEvent = `location:${locationId}`;
  
  messageEvents.on(conversationEvent, conversationMessageHandler);
  messageEvents.on(userEvent, userMessageHandler);
  // Optionally subscribe to location-wide events (commented out to reduce noise)
  // messageEvents.on(locationEvent, locationMessageHandler);

  // Log subscriptions
  console.log(`[SSE] Subscribed to events:`, {
    conversation: conversationEvent,
    user: userEvent,
    // location: locationEvent
  });

  // Cleanup function
  const cleanup = () => {
    // Clear heartbeat
    clearInterval(heartbeat);
    
    // Remove event listeners
    messageEvents.off(conversationEvent, conversationMessageHandler);
    messageEvents.off(userEvent, userMessageHandler);
    // messageEvents.off(locationEvent, locationMessageHandler);
    
    // Remove from active connections
    activeConnections.delete(connectionId);
    
    // Log disconnection
    console.log(`[SSE] Client disconnected: ${connectionId}`);
    console.log(`[SSE] Active connections: ${activeConnections.size}`);
    
    // End response
    res.end();
  };

  // Handle client disconnect
  req.on('close', cleanup);
  req.on('error', (error) => {
    console.error(`[SSE] Request error for ${connectionId}:`, error);
    cleanup();
  });

  // Send initial "ready" event after all setup
  res.write(`data: ${JSON.stringify({ 
    type: 'ready',
    subscriptions: {
      conversation: conversationEvent,
      user: userEvent
    },
    timestamp: new Date().toISOString()
  })}\n\n`);
}

// Disable body parsing for SSE
export const config = {
  api: {
    bodyParser: false,
  },
  // Note: Can't use Edge Runtime with EventEmitter
  // If you need Edge Runtime, would need to use Redis Pub/Sub instead
};

// Optional: Endpoint to check active connections (for monitoring)
export async function getActiveConnections() {
  return Array.from(activeConnections.entries()).map(([id, info]) => ({
    id,
    ...info,
    duration: Date.now() - info.startTime.getTime()
  }));
}