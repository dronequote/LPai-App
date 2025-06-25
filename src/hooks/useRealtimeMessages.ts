// src/hooks/useRealtimeMessages.ts
// Real-time message updates using react-native-sse
// Works on both React Native and Web!

import { useEffect, useRef, useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import EventSource from 'react-native-sse';
import 'react-native-url-polyfill/auto'; // Required for URL support

interface RealtimeConfig {
  locationId: string;
  contactObjectId: string;
  conversationId?: string;
  onNewMessage: (message: any) => void;
  onConversationUpdate?: (update: any) => void;
  onConnectionChange?: (connected: boolean) => void;
  enabled?: boolean;
}

export function useRealtimeMessages({
  locationId,
  contactObjectId,
  conversationId,
  onNewMessage,
  onConversationUpdate,
  onConnectionChange,
  enabled = true
}: RealtimeConfig) {
  const { user } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Store callbacks in refs to avoid recreating functions
  const onNewMessageRef = useRef(onNewMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onConversationUpdateRef = useRef(onConversationUpdate);
  
  // Update refs when callbacks change
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);
  
  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange;
  }, [onConnectionChange]);
  
  useEffect(() => {
    onConversationUpdateRef.current = onConversationUpdate;
  }, [onConversationUpdate]);

  // SSE Connection
  const connectSSE = useCallback(() => {
    if (!enabled || !user?.token || !locationId || !contactObjectId) {
      return;
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.removeAllEventListeners();
      eventSourceRef.current.close();
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://lpai-backend-omega.vercel.app';
    
    // Note: Your backend needs to accept token as query param since react-native-sse
    // doesn't support Authorization header in the same way
    const url = new URL(`${baseUrl}/api/messages/realtime`);
    url.searchParams.append('locationId', locationId);
    url.searchParams.append('contactObjectId', contactObjectId);
    url.searchParams.append('token', user.token);
    
    if (__DEV__) {
      console.log('[Realtime SSE] Connecting to:', url.toString());
    }

    // Create EventSource
    const es = new EventSource(url.toString(), {
      // react-native-sse specific options
      pollingInterval: 0, // Disable polling, use streaming
      withCredentials: false,
    });

    // Handle connection open
    es.addEventListener('open', (event) => {
      console.log('[Realtime SSE] Connected!');
      setIsConnected(true);
      setRetryCount(0);
      onConnectionChangeRef.current?.(true);
    });

    // Handle messages
    es.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (__DEV__ && data.type !== 'heartbeat') {
          console.log('[Realtime SSE] Received:', data.type);
        }
        
        switch (data.type) {
          case 'new_message':
            if (data.message) {
              onNewMessageRef.current(data.message);
            }
            break;
            
          case 'conversation_update':
            if (data.updates) {
              onConversationUpdateRef.current?.(data.updates);
            }
            break;
            
          case 'connected':
          case 'ready':
            console.log('[Realtime SSE] Ready to receive messages');
            break;
            
          case 'heartbeat':
            // Ignore heartbeats
            break;
            
          default:
            if (__DEV__) {
              console.log('[Realtime SSE] Unknown event type:', data.type);
            }
        }
      } catch (error) {
        console.error('[Realtime SSE] Error parsing message:', error);
      }
    });

    // Handle errors
    es.addEventListener('error', (event) => {
      console.error('[Realtime SSE] Error:', event);
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
      
      // Close the connection
      if (eventSourceRef.current) {
        eventSourceRef.current.removeAllEventListeners();
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Exponential backoff for reconnection
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      setRetryCount(prev => prev + 1);
      
      console.log(`[Realtime SSE] Reconnecting in ${delay}ms...`);
      reconnectTimeoutRef.current = setTimeout(connectSSE, delay);
    });

    eventSourceRef.current = es;
  }, [enabled, user?.token, locationId, contactObjectId, retryCount]);

  // Setup connection
  useEffect(() => {
    if (!enabled || !locationId || !contactObjectId || !user?.token) {
      return;
    }

    connectSSE();
    
    return () => {
      // Cleanup
      if (eventSourceRef.current) {
        console.log('[Realtime SSE] Closing connection');
        eventSourceRef.current.removeAllEventListeners();
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled, locationId, contactObjectId, user?.token, connectSSE]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.removeAllEventListeners();
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    onConnectionChangeRef.current?.(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setRetryCount(0);
    connectSSE();
  }, [disconnect, connectSSE]);

  return {
    isConnected,
    disconnect,
    reconnect,
    mode: 'sse' // Always SSE now!
  };
}