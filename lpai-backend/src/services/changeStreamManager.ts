// 1. Backend: Change Stream Manager (Singleton)
// lpai-backend/src/services/changeStreamManager.ts

import { Db, ChangeStream, ChangeStreamDocument } from 'mongodb';
import clientPromise from '../lib/mongodb';
import EventEmitter from 'events';

class ChangeStreamManager extends EventEmitter {
  private static instance: ChangeStreamManager;
  private messagesStream: ChangeStream | null = null;
  private conversationsStream: ChangeStream | null = null;
  private db: Db | null = null;
  private isInitialized = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.setMaxListeners(1000); // Support many SSE connections
  }

  static getInstance(): ChangeStreamManager {
    if (!ChangeStreamManager.instance) {
      ChangeStreamManager.instance = new ChangeStreamManager();
    }
    return ChangeStreamManager.instance;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      const client = await clientPromise;
      this.db = client.db('lpai');
      
      await this.startChangeStreams();
      this.isInitialized = true;
      
      console.log('[ChangeStreamManager] Initialized successfully');
    } catch (error) {
      console.error('[ChangeStreamManager] Initialization error:', error);
      this.scheduleReconnect();
    }
  }

  private async startChangeStreams() {
    if (!this.db) throw new Error('Database not initialized');

    // Watch messages collection
    const messagesPipeline = [
      {
        $match: {
          $and: [
            { operationType: { $in: ['insert', 'update'] } },
            { 'fullDocument.direction': 'inbound' },
            // Only watch for actual messages, not optimistic ones
            { 'fullDocument.source': { $ne: 'optimistic' } }
          ]
        }
      }
    ];

    this.messagesStream = this.db.collection('messages').watch(messagesPipeline, {
      fullDocument: 'updateLookup'
    });

    this.messagesStream.on('change', this.handleMessageChange.bind(this));
    this.messagesStream.on('error', this.handleStreamError.bind(this));

    // Watch conversations collection for updates (unread counts, etc.)
    const conversationsPipeline = [
      {
        $match: {
          operationType: { $in: ['update'] },
          'updateDescription.updatedFields.unreadCount': { $exists: true }
        }
      }
    ];

    this.conversationsStream = this.db.collection('conversations').watch(conversationsPipeline);
    this.conversationsStream.on('change', this.handleConversationChange.bind(this));
    this.conversationsStream.on('error', this.handleStreamError.bind(this));
  }

  private handleMessageChange(change: ChangeStreamDocument) {
    if (change.operationType === 'insert' || change.operationType === 'update') {
      const message = change.fullDocument;
      if (!message) return;

      // Emit events for specific location and contact
      this.emit(`message:${message.locationId}:${message.contactObjectId}`, {
        type: 'new_message',
        message
      });

      // Also emit location-wide event for dashboards
      this.emit(`location:${message.locationId}`, {
        type: 'new_message',
        contactId: message.contactObjectId,
        message
      });
    }
  }

  private handleConversationChange(change: ChangeStreamDocument) {
    if (change.operationType === 'update') {
      const conversationId = change.documentKey?._id;
      const updates = change.updateDescription?.updatedFields || {};
      
      // Emit conversation update event
      this.emit(`conversation:${conversationId}`, {
        type: 'conversation_update',
        conversationId,
        updates
      });
    }
  }

  private handleStreamError(error: Error) {
    console.error('[ChangeStreamManager] Stream error:', error);
    this.cleanup();
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      console.log('[ChangeStreamManager] Attempting to reconnect...');
      this.reconnectTimer = null;
      this.initialize();
    }, 5000); // Retry after 5 seconds
  }

  private cleanup() {
    if (this.messagesStream) {
      this.messagesStream.close();
      this.messagesStream = null;
    }
    if (this.conversationsStream) {
      this.conversationsStream.close();
      this.conversationsStream = null;
    }
    this.isInitialized = false;
    this.removeAllListeners();
  }

  async shutdown() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanup();
  }
}

export default ChangeStreamManager;

// 2. Backend: SSE Endpoint
// lpai-backend/pages/api/messages/stream.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import ChangeStreamManager from '../../../src/services/changeStreamManager';
import jwt from 'jsonwebtoken';

// Keep track of active connections
const activeConnections = new Map<string, { 
  res: NextApiResponse, 
  heartbeat: NodeJS.Timeout 
}>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { locationId, contactObjectId } = req.query;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!locationId || !contactObjectId || !token) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Verify JWT token
  let userId: string;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    userId = decoded.userId;
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

  // Send initial connection event
  res.write(': Connection established\n\n');

  // Create unique connection ID
  const connectionId = `${userId}:${locationId}:${contactObjectId}:${Date.now()}`;
  
  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Store connection
  activeConnections.set(connectionId, { res, heartbeat });

  // Get change stream manager
  const manager = ChangeStreamManager.getInstance();
  await manager.initialize();

  // Message event handler
  const messageHandler = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Subscribe to events for this specific conversation
  const eventKey = `message:${locationId}:${contactObjectId}`;
  manager.on(eventKey, messageHandler);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    manager.off(eventKey, messageHandler);
    activeConnections.delete(connectionId);
    
    console.log(`[SSE] Client disconnected: ${connectionId}`);
    console.log(`[SSE] Active connections: ${activeConnections.size}`);
  });

  // Log connection
  console.log(`[SSE] Client connected: ${connectionId}`);
  console.log(`[SSE] Active connections: ${activeConnections.size}`);
}

// Make sure to handle Vercel's 10s function timeout for streaming
export const config = {
  api: {
    bodyParser: false,
  },
  // Enable Edge Runtime for better streaming support
  runtime: 'edge',
};

// 3. Frontend: Real-time Hook
// src/hooks/useRealtimeMessages.ts

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface RealtimeConfig {
  locationId: string;
  contactObjectId: string;
  onNewMessage: (message: any) => void;
  onConversationUpdate?: (update: any) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function useRealtimeMessages({
  locationId,
  contactObjectId,
  onNewMessage,
  onConversationUpdate,
  onConnectionChange
}: RealtimeConfig) {
  const { authToken } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const connect = useCallback(() => {
    if (!authToken || !locationId || !contactObjectId) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/messages/stream?locationId=${locationId}&contactObjectId=${contactObjectId}`;
    const eventSource = new EventSource(url, {
      withCredentials: true,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    eventSource.onopen = () => {
      console.log('[Realtime] Connected to message stream');
      setIsConnected(true);
      setRetryCount(0);
      onConnectionChange?.(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message') {
          onNewMessage(data.message);
        } else if (data.type === 'conversation_update') {
          onConversationUpdate?.(data);
        }
      } catch (error) {
        console.error('[Realtime] Error parsing message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[Realtime] Connection error:', error);
      setIsConnected(false);
      onConnectionChange?.(false);
      eventSource.close();

      // Exponential backoff for reconnection
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      setRetryCount(prev => prev + 1);
      
      console.log(`[Realtime] Reconnecting in ${delay}ms...`);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    eventSourceRef.current = eventSource;
  }, [authToken, locationId, contactObjectId, onNewMessage, onConversationUpdate, onConnectionChange, retryCount]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  return {
    isConnected,
    disconnect,
    reconnect: connect
  };
}

// 4. Add to ConversationsList component
// In src/components/ConversationsList.tsx, add after imports:

import { useRealtimeMessages } from '../hooks/useRealtimeMessages';

// Inside the component, after state declarations:

// Real-time messages
const { isConnected } = useRealtimeMessages({
  locationId,
  contactObjectId,
  onNewMessage: (newMessage) => {
    // Check if message already exists (prevent duplicates)
    setMessages(prevMessages => {
      const exists = prevMessages.some(msg => 
        msg.id === newMessage.id || 
        msg.ghlMessageId === newMessage.ghlMessageId
      );
      
      if (exists) return prevMessages;
      
      // Add new message to the top (newest first)
      return [newMessage, ...prevMessages];
    });
    
    // Optional: Play notification sound
    // playNotificationSound();
    
    // Optional: Show push notification
    // showPushNotification(newMessage);
  },
  onConnectionChange: (connected) => {
    if (__DEV__) {
      console.log('[Realtime] Connection status:', connected);
    }
  }
});

// Optional: Show connection status in UI
{isConnected && (
  <View style={styles.connectionIndicator}>
    <View style={styles.connectedDot} />
    <Text style={styles.connectionText}>Live</Text>
  </View>
)}