// src/hooks/useRealtimeMessages.ts
// Real-time message updates - using polling for React Native compatibility
// Last Updated: 2025-06-24

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { conversationService } from '../services/conversationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';

interface RealtimeConfig {
  locationId: string;
  contactObjectId: string;
  conversationId?: string;
  onNewMessage: (message: any) => void;
  onConversationUpdate?: (update: any) => void;
  onConnectionChange?: (connected: boolean) => void;
  enabled?: boolean;
  pollInterval?: number; // milliseconds
}

export function useRealtimeMessages({
  locationId,
  contactObjectId,
  conversationId,
  onNewMessage,
  onConversationUpdate,
  onConnectionChange,
  enabled = true,
  pollInterval = 3000 // 3 seconds default
}: RealtimeConfig) {
  const { user } = useAuth();
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  
  // Store callbacks in refs to avoid recreating the polling function
  const onNewMessageRef = useRef(onNewMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);
  
  // Update refs when callbacks change
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);
  
  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange;
  }, [onConnectionChange]);

  // Create stable polling function that doesn't cause re-renders
  const pollForMessages = useCallback(async () => {
    if (!enabled || !user?.token || !locationId || !conversationId) {
      return;
    }

    // Prevent concurrent polls using ref instead of state
    if (pollTimeoutRef.current === null) {
      pollTimeoutRef.current = setTimeout(() => {
        pollTimeoutRef.current = null;
      }, 100);
    } else {
      return;
    }
    
    setIsPolling(true);
    
    try {
      // AGGRESSIVE CACHE CLEARING
      // Clear ALL conversation-related caches before polling
      try {
        const keys = await AsyncStorage.getAllKeys();
        const conversationKeys = keys.filter(key => 
          key.includes(`/api/conversations/${conversationId}`) ||
          key.includes('/api/conversations') && key.includes(conversationId)
        );
        if (conversationKeys.length > 0) {
          await AsyncStorage.multiRemove(conversationKeys);
        }
      } catch (e) {
        // Ignore cache errors
      }
      
      // Direct API call to bypass any service-level caching
      const response = await api.get(`/api/conversations/${conversationId}/messages`, {
        params: {
          locationId,
          limit: 10,
          offset: 0,
          _timestamp: Date.now(),
          _nocache: Math.random()
        },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      const messagesData = response.data;

      if (messagesData.messages && messagesData.messages.length > 0) {
        const latestMessage = messagesData.messages[0];
        
        // Check if we have a new message
        if (latestMessage.id !== lastMessageIdRef.current && 
            latestMessage._id !== lastMessageIdRef.current) {
          
          // Check if this is truly new (not just initial load)
          if (lastMessageIdRef.current !== null) {
            if (__DEV__) {
              console.log('[Realtime] New message detected:', latestMessage.body?.substring(0, 50));
              console.log('[Realtime] Message ID:', latestMessage.id || latestMessage._id);
              console.log('[Realtime] Previous ID:', lastMessageIdRef.current);
            }
            
            // Find all new messages since last check
            const lastIndex = messagesData.messages.findIndex(msg => 
              msg.id === lastMessageIdRef.current || msg._id === lastMessageIdRef.current
            );
            
            const newMessages = lastIndex > 0 
              ? messagesData.messages.slice(0, lastIndex).reverse() 
              : [latestMessage];
            
            // Notify about each new message
            newMessages.forEach(msg => {
              if (__DEV__) {
                console.log('[Realtime] Processing message:', {
                  id: msg.id,
                  direction: msg.direction,
                  body: msg.body?.substring(0, 30)
                });
              }
              
              // Notify about ALL messages (both inbound and outbound)
              onNewMessageRef.current(msg);
            });
          }
          
          // Update last message ID
          lastMessageIdRef.current = latestMessage.id || latestMessage._id;
        }
      }

      // Mark as connected after first successful poll
      if (!isConnected) {
        setIsConnected(true);
        onConnectionChangeRef.current?.(true);
      }

    } catch (error) {
      if (__DEV__) {
        console.error('[Realtime] Polling error:', error);
      }
      
      if (isConnected) {
        setIsConnected(false);
        onConnectionChangeRef.current?.(false);
      }
    } finally {
      setIsPolling(false);
    }
  }, [enabled, user?.token, locationId, conversationId, isConnected]);

  // Setup polling interval
  useEffect(() => {
    if (!enabled || !conversationId || !locationId || !user?.token) {
      return;
    }

    if (__DEV__) {
      console.log('[Realtime] Starting message polling for conversation:', conversationId);
    }
    
    let intervalId: NodeJS.Timer;
    let mounted = true;
    
    // Start polling after a short delay to ensure everything is initialized
    const startPolling = async () => {
      if (!mounted) return;
      
      // Do an immediate poll
      await pollForMessages();
      
      // Start polling interval
      intervalId = setInterval(async () => {
        if (mounted) {
          await pollForMessages();
        }
      }, pollInterval);
    };
    
    startPolling();
    
    return () => {
      mounted = false;
      if (__DEV__) {
        console.log('[Realtime] Stopping message polling');
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      setIsConnected(false);
      lastMessageIdRef.current = null;
    };
  }, [enabled, conversationId, locationId, user?.token, pollInterval]); // NO pollForMessages here!

  const disconnect = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    setIsConnected(false);
    onConnectionChangeRef.current?.(false);
  }, []);

  const reconnect = useCallback(() => {
    pollForMessages();
  }, [pollForMessages]);

  return {
    isConnected,
    disconnect,
    reconnect,
    isPolling
  };
}

// Future: SSE implementation for true real-time
// When ready, we can add EventSource support for web and a React Native compatible version