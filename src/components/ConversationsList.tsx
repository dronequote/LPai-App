// src/components/ConversationsList.tsx
// Updated Date: 01/20/2025 - Added Ably WebSocket support with Expo Notifications
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
 View,
 Text,
 StyleSheet,
 TouchableOpacity,
 ActivityIndicator,
 Alert,
 TextInput,
 KeyboardAvoidingView,
 Platform,
 RefreshControl,
 FlatList,
 Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { conversationService } from '../services/conversationService';
import { smsService } from '../services/smsService';
import { emailService } from '../services/emailService';
import { COLORS, FONT, SHADOW } from '../styles/theme';
import api from '../lib/api';
import EmailViewerModal from './EmailViewerModal';
import Ably from 'ably';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type MessageFilter = 'all' | 'sms' | 'email' | 'call';

const messageFilters: { id: MessageFilter; label: string; icon: string }[] = [
 { id: 'all', label: 'All', icon: 'apps' },
 { id: 'sms', label: 'SMS', icon: 'chatbubble' },
 { id: 'email', label: 'Email', icon: 'mail' },
 { id: 'call', label: 'Calls', icon: 'call' },
];

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

interface OptimisticMessage {
  id: string;
  type: number;
  direction: 'outbound';
  dateAdded: string;
  body: string;
  subject?: string;
  read: boolean;
  status: MessageStatus;
  tempId: string;
  retryCount?: number;
}

interface ConversationsListProps {
 contactObjectId: string;
 contactPhone: string;
 contactEmail: string;
 locationId: string;
 userId: string;
 userName?: string;
 user?: any;
 onNavigateToProject?: (projectId: string) => void;
 onNavigateToAppointment?: (appointmentId: string) => void;
 onNavigateToSettings?: () => void;
 style?: any;
}

// Helper function to show notifications
async function showNotification(title: string, body: string, data?: any) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

export default function ConversationsList({
 contactObjectId,
 contactPhone,
 contactEmail,
 locationId,
 userId,
 userName,
 user,
 onNavigateToProject,
 onNavigateToAppointment,
 onNavigateToSettings,
 style,
}: ConversationsListProps) {
 // State declarations
 const [messageFilter, setMessageFilter] = useState<MessageFilter>('all');
 const [conversations, setConversations] = useState<any[]>([]);
 const [messages, setMessages] = useState<any[]>([]);
 const [loadingMessages, setLoadingMessages] = useState(false);
 const [composeText, setComposeText] = useState('');
 const [composeMode, setComposeMode] = useState<'sms' | 'email'>('sms');
 const [emailSubject, setEmailSubject] = useState('');
 const [sendingMessage, setSendingMessage] = useState(false);
 const [refreshingConversations, setRefreshingConversations] = useState(false);
 const [offset, setOffset] = useState(0);
 const [hasMore, setHasMore] = useState(true);
 const [loadingMore, setLoadingMore] = useState(false);
 const [emailContentCache, setEmailContentCache] = useState<Record<string, any>>({});
 const [fetchingEmails, setFetchingEmails] = useState<Set<string>>(new Set());
 const [emailViewerVisible, setEmailViewerVisible] = useState(false);
 const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
 const [selectedEmailSubject, setSelectedEmailSubject] = useState<string>('');
 const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

 // Refs
 const optimisticMessagesRef = useRef<Map<string, OptimisticMessage>>(new Map());
 const loadConversationsRef = useRef<any>(null);
 const ablyRef = useRef<Ably.Realtime | null>(null);

 // Helper function to clear all message caches
 const clearAllMessageCaches = async () => {
   try {
     const keys = await AsyncStorage.getAllKeys();
     const messageCacheKeys = keys.filter(key => 
       key.includes('/api/conversations/') && key.includes('/messages')
     );
     
     if (messageCacheKeys.length > 0) {
       await AsyncStorage.multiRemove(messageCacheKeys);
       if (__DEV__) {
         console.log(`Cleared ${messageCacheKeys.length} message cache entries`);
       }
     }
   } catch (error) {
     console.error('Error clearing message caches:', error);
   }
 };

 // Ably WebSocket real-time connection
 useEffect(() => {
   if (!user?.ghlUserId || !locationId || !contactObjectId) return;
   
   console.log('[Ably] Setting up real-time connection...');
   
   const ably = new Ably.Realtime({
     key: process.env.EXPO_PUBLIC_ABLY_API_KEY,
     clientId: user.ghlUserId
   });

   ablyRef.current = ably;

   const channel = ably.channels.get(`user:${user.ghlUserId}`);
   
   channel.subscribe('new-message', async (message) => {
     console.log('🎉 [Ably] Real-time message received!', message.data);
     
     // Only process if it's for this conversation
     if (message.data.conversation?.contactObjectId === contactObjectId || 
         message.data.contact?.id === contactObjectId) {
       
       // Add the new message
       setMessages(prev => {
         // Check if message already exists
         const messageData = message.data.message;
         const exists = prev.some(m => 
           (m._id === messageData._id) || 
           (m.id === messageData._id) ||
           (m.ghlMessageId === messageData.ghlMessageId)
         );
         if (exists) return prev;
         
         // Remove optimistic message if this is the real version
         if (messageData.direction === 'outbound') {
           const filtered = prev.filter(msg => {
             if (msg.tempId && msg.body === messageData.body) {
               optimisticMessagesRef.current.delete(msg.tempId);
               return false;
             }
             return true;
           });
           return [messageData, ...filtered];
         }
         
         // Add new inbound message to the beginning
         return [messageData, ...prev];
       });
       
       // Update conversation preview
       setConversations(prev => prev.map(conv => {
         if (conv._id === message.data.conversation?.id || 
             conv.contactObjectId === contactObjectId) {
           return {
             ...conv,
             lastMessageBody: message.data.message.body,
             lastMessageDate: new Date(),
             lastMessageDirection: message.data.message.direction,
             unreadCount: message.data.message.direction === 'inbound' 
               ? (conv.unreadCount || 0) + 1 
               : conv.unreadCount
           };
         }
         return conv;
       }));
       
       // Show notification and haptic feedback for inbound messages
       if (message.data.message.direction === 'inbound') {
         await showNotification(
           'New Message',
           `${message.data.contact?.name || 'Contact'}: ${message.data.message.body}`,
           { conversationId: conversations[0]?._id }
         );
         
         // Haptic feedback
         Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
       }
     }
   });

   // Connection status logging
   ably.connection.on('connected', () => {
     console.log('✅ [Ably] Connected!');
     setIsRealtimeConnected(true);
   });
   
   ably.connection.on('disconnected', () => {
     console.log('❌ [Ably] Disconnected');
     setIsRealtimeConnected(false);
   });

   ably.connection.on('failed', () => {
     console.log('❌ [Ably] Connection failed');
     setIsRealtimeConnected(false);
   });

   return () => {
     console.log('[Ably] Cleaning up connection...');
     channel.unsubscribe();
     ably.close();
     ablyRef.current = null;
   };
 }, [user, locationId, contactObjectId, conversations]);

 // Load conversations function
 const loadConversations = async (isLoadMore = false) => {
   if (!locationId || !contactObjectId) return;
   
   if (!isLoadMore) {
     setLoadingMessages(true);
     setOffset(0);
   } else {
     setLoadingMore(true);
   }
   
   try {
     const convs = await conversationService.list(locationId, {
       contactObjectId: contactObjectId
     });
     
     if (__DEV__) {
       console.log('Loading conversations for contact:', contactObjectId);
       console.log('Conversations response:', convs);
     }
     
     if (convs && convs.length > 0) {
       setConversations(convs);
       
       try {
         const messagesResponse = await conversationService.getMessages(
           convs[0]._id,
           locationId,
           {
             limit: 20,
             offset: isLoadMore ? offset : 0,
             cache: false
           }
         );
         
         if (__DEV__) {
           console.log('Messages response:', messagesResponse);
           if (messagesResponse.messages && messagesResponse.messages.length > 0) {
             console.log('First message structure:', JSON.stringify(messagesResponse.messages[0], null, 2));
           }
         }
         
         const newMessages = messagesResponse.messages || [];
         
         if (isLoadMore) {
           setMessages(prevMessages => [...prevMessages, ...newMessages]);
           setOffset(prevOffset => prevOffset + newMessages.length);
         } else {
           const optimisticMessages = Array.from(optimisticMessagesRef.current.values());
           const mergedMessages = [...optimisticMessages, ...newMessages];
           setMessages(mergedMessages);
           setOffset(newMessages.length);
         }
         
         setHasMore(messagesResponse.pagination?.hasMore || false);
         
         const emailsToFetch = newMessages
           .filter(msg => 
             msg.type === 3 && 
             msg.needsContentFetch && 
             msg.emailMessageId &&
             !emailContentCache[msg.emailMessageId]
           )
           .slice(0, 5);
         
         if (emailsToFetch.length > 0) {
           fetchEmailContents(emailsToFetch);
         }
         
       } catch (msgError) {
         console.error('Failed to load messages:', msgError);
         if (!isLoadMore) {
           setMessages([]);
         }
       }
     } else {
       setConversations([]);
       setMessages([]);
       
       if (__DEV__) {
         console.log('No conversations found for contact:', contactObjectId);
       }
     }
   } catch (error: any) {
     console.error('Failed to load conversations:', error);
     if (!isLoadMore) {
       setConversations([]);
       setMessages([]);
     }
   } finally {
     setLoadingMessages(false);
     setLoadingMore(false);
   }
 };

 // Assign loadConversations to ref so it can be called from realtime hook
 loadConversationsRef.current = loadConversations;

 // Fetch email contents
 const fetchEmailContents = async (emails: any[]) => {
   const fetchPromises = emails.map(async (email) => {
     if (fetchingEmails.has(email.emailMessageId)) return;
     
     setFetchingEmails(prev => new Set(prev).add(email.emailMessageId));
     
     try {
       const response = await api.get(`/api/messages/email/${email.emailMessageId}`, {
         params: { locationId }
       });
       
       if (response.data.success && response.data.email) {
         setEmailContentCache(prev => ({
           ...prev,
           [email.emailMessageId]: response.data.email
         }));
         
         setMessages(prevMessages => 
           prevMessages.map(msg => 
             msg.emailMessageId === email.emailMessageId
               ? { 
                   ...msg, 
                   body: response.data.email.body,
                   htmlBody: response.data.email.htmlBody,
                   subject: response.data.email.subject,
                   needsContentFetch: false
                 }
               : msg
           )
         );
       }
     } catch (error) {
       console.error(`Failed to fetch email ${email.emailMessageId}:`, error);
     } finally {
       setFetchingEmails(prev => {
         const newSet = new Set(prev);
         newSet.delete(email.emailMessageId);
         return newSet;
       });
     }
   });
   
   await Promise.all(fetchPromises);
 };

 // Fetch single email content on tap
 const fetchEmailContent = async (emailMessageId: string) => {
   if (fetchingEmails.has(emailMessageId) || emailContentCache[emailMessageId]) return;
   
   setFetchingEmails(prev => new Set(prev).add(emailMessageId));
   
   try {
     const response = await api.get(`/api/messages/email/${emailMessageId}`, {
       params: { locationId }
     });
     
     if (response.data.success && response.data.email) {
       setEmailContentCache(prev => ({
         ...prev,
         [emailMessageId]: response.data.email
       }));
       
       setMessages(prevMessages => 
         prevMessages.map(msg => 
           msg.emailMessageId === emailMessageId
             ? { 
                 ...msg, 
                 body: response.data.email.body,
                 htmlBody: response.data.email.htmlBody,
                 subject: response.data.email.subject,
                 needsContentFetch: false
               }
             : msg
         )
       );
     }
   } catch (error) {
     console.error(`Failed to fetch email ${emailMessageId}:`, error);
     Alert.alert('Error', 'Failed to load email content');
   } finally {
     setFetchingEmails(prev => {
       const newSet = new Set(prev);
       newSet.delete(emailMessageId);
       return newSet;
     });
   }
 };

 // Refresh handler with proper cache clearing
 const onRefreshConversations = useCallback(async () => {
   if (!locationId || !contactObjectId) return;
   
   setRefreshingConversations(true);
   try {
     await conversationService.clearConversationCache(locationId);
     await clearAllMessageCaches();
     
     optimisticMessagesRef.current.clear();
     
     const convs = await conversationService.list(locationId, {
       contactObjectId: contactObjectId
     });
     
     if (__DEV__) {
       console.log('Refreshing conversations for contact:', contactObjectId);
       console.log('Fresh conversations response:', convs);
     }
     
     if (convs && convs.length > 0) {
       setConversations(convs);
       
       try {
         if (convs[0]._id) {
           const messagesCacheKey = `@lpai_cache_GET_/api/conversations/${convs[0]._id}/messages`;
           const keys = await AsyncStorage.getAllKeys();
           const relevantKeys = keys.filter(key => key.startsWith(messagesCacheKey));
           await AsyncStorage.multiRemove(relevantKeys);
         }
         
         const messagesResponse = await conversationService.getMessages(
           convs[0]._id,
           locationId,
           { limit: 20, offset: 0, cache: false }
         );
         
         setMessages(messagesResponse.messages || []);
         setOffset(messagesResponse.messages?.length || 0);
         setHasMore(messagesResponse.pagination?.hasMore || false);
         
         const emailsToFetch = (messagesResponse.messages || [])
           .filter(msg => 
             msg.type === 3 && 
             msg.needsContentFetch && 
             msg.emailMessageId &&
             !emailContentCache[msg.emailMessageId]
           )
           .slice(0, 5);
         
         if (emailsToFetch.length > 0) {
           fetchEmailContents(emailsToFetch);
         }
       } catch (msgError) {
         console.error('Failed to load messages:', msgError);
         setMessages([]);
       }
     } else {
       setConversations([]);
       setMessages([]);
     }
   } catch (error: any) {
     console.error('Failed to refresh conversations:', error);
   } finally {
     setRefreshingConversations(false);
   }
 }, [locationId, contactObjectId, emailContentCache]);

 // Load conversations on mount
 useEffect(() => {
   loadConversations();
 }, [contactObjectId, locationId]);

 // Retry failed message
 const retryMessage = async (tempId: string) => {
   const optimisticMessage = optimisticMessagesRef.current.get(tempId);
   if (!optimisticMessage) return;

   optimisticMessage.status = 'sending';
   optimisticMessage.retryCount = (optimisticMessage.retryCount || 0) + 1;
   setMessages(prevMessages => 
     prevMessages.map(msg => 
       msg.tempId === tempId ? { ...msg, status: 'sending' } : msg
     )
   );

   try {
     if (optimisticMessage.type === 1) {
       const fromNumber = user?.preferences?.communication?.defaultPhoneNumber;
       const formattedFromNumber = fromNumber?.startsWith('+') ? fromNumber : `+1${fromNumber}`;
       const formattedToNumber = contactPhone.startsWith('+') ? contactPhone : `+1${contactPhone}`;

       await smsService.send({
         contactObjectId: contactObjectId,
         locationId: locationId,
         customMessage: optimisticMessage.body,
         toNumber: formattedToNumber,
         userId: userId,
         fromNumber: formattedFromNumber,
         templateKey: 'custom',
       });
     } else {
       await emailService.send({
         contactObjectId: contactObjectId,
         locationId: locationId,
         subject: optimisticMessage.subject || 'Message from ' + (userName || 'Team'),
         plainTextContent: optimisticMessage.body,
         userId: userId,
       });
     }

     optimisticMessage.status = 'sent';
     setMessages(prevMessages => 
       prevMessages.map(msg => 
         msg.tempId === tempId ? { ...msg, status: 'sent' } : msg
       )
     );

     setTimeout(() => {
       optimisticMessagesRef.current.delete(tempId);
       loadConversations();
     }, 2000);

   } catch (error) {
     optimisticMessage.status = 'failed';
     setMessages(prevMessages => 
       prevMessages.map(msg => 
         msg.tempId === tempId ? { ...msg, status: 'failed' } : msg
       )
     );
   }
 };

 // Handle send message with optimistic updates
 const handleSendMessage = async () => {
   if (!composeText.trim() || !userId || !locationId) return;
   
   setSendingMessage(true);
   
   const tempId = `temp_${Date.now()}`;
   const optimisticMessage: OptimisticMessage = {
     id: tempId,
     tempId,
     type: composeMode === 'sms' ? 1 : 3,
     direction: 'outbound',
     dateAdded: new Date().toISOString(),
     body: composeText,
     subject: composeMode === 'email' ? (emailSubject || 'Message from ' + (userName || 'Team')) : undefined,
     read: true,
     status: 'sending',
   };

   optimisticMessagesRef.current.set(tempId, optimisticMessage);
   setMessages(prevMessages => [optimisticMessage, ...prevMessages]);
   
   const savedComposeText = composeText;
   const savedEmailSubject = emailSubject;
   setComposeText('');
   setEmailSubject('');

   try {
     if (composeMode === 'sms') {
       const smsNumberId = user?.preferences?.communication?.smsNumberId;
       
       if (__DEV__) {
         console.log('SMS Configuration Check:');
         console.log('User preferences:', user?.preferences?.communication);
         console.log('SMS Number ID:', smsNumberId);
       }
       
       if (!smsNumberId) {
         setComposeText(savedComposeText);
         optimisticMessage.status = 'failed';
         setMessages(prevMessages => 
           prevMessages.map(msg => 
             msg.tempId === tempId ? { ...msg, status: 'failed' } : msg
           )
         );
         
         Alert.alert(
           'SMS Setup Required',
           'Please select your SMS number in Settings before sending messages.',
           [
             { text: 'Cancel', style: 'cancel' },
             { 
               text: 'Go to Settings', 
               onPress: () => {
                 if (onNavigateToSettings) {
                   onNavigateToSettings();
                 }
               }
             }
           ]
         );
         setSendingMessage(false);
         return;
       }
       
       const fromNumber = user?.preferences?.communication?.defaultPhoneNumber;
       
       if (!fromNumber) {
         setComposeText(savedComposeText);
         optimisticMessage.status = 'failed';
         setMessages(prevMessages => 
           prevMessages.map(msg => 
             msg.tempId === tempId ? { ...msg, status: 'failed' } : msg
           )
         );
         Alert.alert('Error', 'No phone number configured. Please update your settings.');
         setSendingMessage(false);
         return;
       }
       
       const formattedFromNumber = fromNumber.startsWith('+') ? fromNumber : `+1${fromNumber}`;
       const formattedToNumber = contactPhone.startsWith('+') ? contactPhone : `+1${contactPhone}`;
       
       if (__DEV__) {
         console.log('SMS Send Request:');
         console.log('From:', formattedFromNumber);
         console.log('To:', formattedToNumber);
         console.log('ContactObjectId:', contactObjectId);
         console.log('LocationId:', locationId);
         console.log('UserId:', userId);
         console.log('Message:', savedComposeText);
       }
       
       try {
         await smsService.send({
           contactObjectId: contactObjectId,
           locationId: locationId,
           customMessage: savedComposeText,
           toNumber: formattedToNumber,
           userId: userId,
           fromNumber: formattedFromNumber,
           templateKey: 'custom',
         });

         optimisticMessage.status = 'sent';
         setMessages(prevMessages => 
           prevMessages.map(msg => 
             msg.tempId === tempId ? { ...msg, status: 'sent' } : msg
           )
         );

       } catch (smsError: any) {
         if (smsError.response?.status === 500 && 
             smsError.response?.data?.error === 'Failed to send SMS') {
           if (__DEV__) {
             console.log('SMS sent successfully despite 500 error');
           }
           optimisticMessage.status = 'sent';
           setMessages(prevMessages => 
             prevMessages.map(msg => 
               msg.tempId === tempId ? { ...msg, status: 'sent' } : msg
             )
           );
         } else {
           throw smsError;
         }
       }

       // No need to refresh - Ably will deliver the real message
       setTimeout(() => {
         // Just remove the optimistic message after a delay if Ably hasn't replaced it
         if (optimisticMessagesRef.current.has(tempId)) {
           optimisticMessagesRef.current.delete(tempId);
         }
       }, 5000);
       
     } else {
       await emailService.send({
         contactObjectId: contactObjectId,
         locationId: locationId,
         subject: savedEmailSubject || 'Message from ' + (userName || 'Team'),
         plainTextContent: savedComposeText,
         userId: userId,
       });
       
       optimisticMessage.status = 'sent';
       setMessages(prevMessages => 
         prevMessages.map(msg => 
           msg.tempId === tempId ? { ...msg, status: 'sent' } : msg
         )
       );
       
       // No need to refresh - Ably will deliver the real message
       setTimeout(() => {
         if (optimisticMessagesRef.current.has(tempId)) {
           optimisticMessagesRef.current.delete(tempId);
         }
       }, 5000);
     }
   } catch (error: any) {
     if (__DEV__) {
       console.error('Send Error:', error);
       console.error('Error details:', error.response?.data);
     }
     
     optimisticMessage.status = 'failed';
     setMessages(prevMessages => 
       prevMessages.map(msg => 
         msg.tempId === tempId ? { ...msg, status: 'failed' } : msg
       )
     );
     
     if (error.message.includes('No SMS number configured')) {
       Alert.alert(
         'SMS Setup Required',
         'Please select your SMS number in Settings.',
         [
           { text: 'Cancel', style: 'cancel' },
           { 
             text: 'Go to Settings', 
             onPress: () => {
               if (onNavigateToSettings) {
                 onNavigateToSettings();
               }
             }
           }
         ]
       );
     } else if (error.message.includes('Selected SMS number is no longer available')) {
       Alert.alert(
         'SMS Configuration Error',
         'Your selected SMS number is no longer available. Please update your settings.',
         [
           { text: 'Cancel', style: 'cancel' },
           { 
             text: 'Go to Settings', 
             onPress: () => {
               if (onNavigateToSettings) {
                 onNavigateToSettings();
               }
             }
           }
         ]
       );
     } else if (error.message.includes('phone numbers do not include')) {
       Alert.alert(
         'Invalid Phone Number',
         'The selected phone number is not configured in GoHighLevel. Please contact your administrator.'
       );
     } else {
       Alert.alert(
         'Message Failed',
         `Failed to send ${composeMode}. Would you like to retry?`,
         [
           { text: 'Cancel', style: 'cancel' },
           { 
             text: 'Retry', 
             onPress: () => retryMessage(tempId)
           }
         ]
       );
     }
   } finally {
     setSendingMessage(false);
   }
 };

 // Filter messages
 const filteredMessages = useMemo(() => {
   if (messageFilter === 'all') return messages;
   
   return messages.filter(msg => {
     if (messageFilter === 'sms' && msg.type === 1) return true;
     if (messageFilter === 'email' && msg.type === 3) return true;
     if (messageFilter === 'call' && msg.type === 2) return true;
     return false;
   });
 }, [messages, messageFilter]);

 // Render message bubble
 const renderMessage = ({ item }: { item: any }) => {
   const isInbound = item.direction === 'inbound';
   const messageTime = new Date(item.dateAdded).toLocaleString('en-US', {
     hour: 'numeric',
     minute: '2-digit',
     hour12: true
   });
   
   const isActivity = item.type >= 25 || item.messageType?.startsWith('TYPE_ACTIVITY');
   const isEmail = item.type === 3 || item.messageType === 'TYPE_EMAIL';
   const isSMS = item.type === 1 || item.messageType === 'TYPE_SMS' || item.messageType === 'TYPE_PHONE';
   const isOptimistic = !!item.tempId;
   const messageStatus = item.status || 'delivered';
   
   // Render activity
   if (isActivity) {
     let isClickable = false;
     let onPressHandler = () => {};
     
     if (item.messageType === 'TYPE_ACTIVITY_APPOINTMENT' && item.appointmentId && onNavigateToAppointment) {
       isClickable = true;
       onPressHandler = () => onNavigateToAppointment(item.appointmentId);
     } else if (item.messageType === 'TYPE_ACTIVITY_OPPORTUNITY' && (item.projectId || conversations[0]?.projectId) && onNavigateToProject) {
       isClickable = true;
       onPressHandler = () => onNavigateToProject(item.projectId || conversations[0]?.projectId);
     } else if (item.projectId && onNavigateToProject) {
       isClickable = true;
       onPressHandler = () => onNavigateToProject(item.projectId);
     }
     
     if (isClickable) {
       return (
         <TouchableOpacity 
           style={styles.activityContainer}
           onPress={onPressHandler}
         >
           <View style={styles.activityDot} />
           <Text style={styles.activityText}>{item.body}</Text>
           <Text style={styles.activityTime}>{messageTime}</Text>
           <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} style={styles.activityChevron} />
         </TouchableOpacity>
       );
     }
     
     return (
       <View style={styles.activityContainer}>
         <View style={styles.activityDot} />
         <Text style={styles.activityText}>{item.body}</Text>
         <Text style={styles.activityTime}>{messageTime}</Text>
       </View>
     );
   }
   
   // Render email
   if (isEmail) {
     const hasContent = item.body && !item.needsContentFetch;
     const isFetching = item.emailMessageId && fetchingEmails.has(item.emailMessageId);
     
     return (
       <TouchableOpacity 
         style={[styles.messageBubbleContainer, isInbound ? styles.inboundContainer : styles.outboundContainer]}
         onPress={() => {
           if (item.emailMessageId) {
             setSelectedEmailId(item.emailMessageId);
             setSelectedEmailSubject(item.subject || 'Email');
             setEmailViewerVisible(true);
           } else {
             Alert.alert(
               'Email Content Unavailable', 
               'This email cannot be loaded. Email ID is missing.'
             );
           }
         }}
         disabled={!item.emailMessageId}
       >
         <View style={[styles.messageBubble, styles.emailBubble]}>
           <View style={styles.emailHeader}>
             <Ionicons name="mail-outline" size={14} color={COLORS.textGray} />
             <Text style={styles.emailLabel}>Email</Text>
             {isFetching && (
               <ActivityIndicator size="small" color={COLORS.accent} style={{ marginLeft: 8 }} />
             )}
           </View>
           {item.subject && (
             <Text style={styles.emailSubject} numberOfLines={1}>
               {item.subject}
             </Text>
           )}
           <Text style={styles.emailPreview} numberOfLines={hasContent ? 4 : 2}>
             {hasContent 
               ? item.body 
               : (item.preview || 'Tap to view email')
             }
           </Text>
           <Text style={styles.messageTime}>{messageTime}</Text>
           
           {isOptimistic && (
             <View style={styles.messageStatusContainer}>
               {messageStatus === 'sending' && <ActivityIndicator size="small" color={COLORS.accent} />}
               {messageStatus === 'failed' && (
                 <TouchableOpacity onPress={() => retryMessage(item.tempId)}>
                   <Text style={styles.retryText}>Failed - Tap to retry</Text>
                 </TouchableOpacity>
               )}
             </View>
           )}
         </View>
       </TouchableOpacity>
     );
   }
   
   // Render SMS/regular message
   return (
     <View style={[styles.messageBubbleContainer, isInbound ? styles.inboundContainer : styles.outboundContainer]}>
       <View style={[
         styles.messageBubble, 
         isInbound ? styles.inboundBubble : styles.outboundBubble,
         isOptimistic && messageStatus === 'failed' && styles.failedBubble
       ]}>
         <Text style={[styles.messageText, !isInbound && styles.outboundText]}>
           {item.body || item.preview || 'No content'}
         </Text>
         
         <View style={styles.messageFooter}>
           <Text style={[styles.messageTime, !isInbound && styles.outboundText]}>
             {messageTime}
           </Text>
           
           {!isInbound && isOptimistic && (
             <View style={styles.messageStatusIcon}>
               {messageStatus === 'sending' && (
                 <ActivityIndicator size="small" color={isInbound ? COLORS.textGray : COLORS.white} />
               )}
               {messageStatus === 'sent' && (
                 <Ionicons name="checkmark" size={16} color={isInbound ? COLORS.textGray : COLORS.white} />
               )}
               {messageStatus === 'delivered' && (
                 <Ionicons name="checkmark-done" size={16} color={isInbound ? COLORS.textGray : COLORS.white} />
               )}
               {messageStatus === 'failed' && (
                 <Ionicons name="alert-circle" size={16} color={COLORS.error} />
               )}
             </View>
           )}
         </View>
         
         {isOptimistic && messageStatus === 'failed' && (
           <TouchableOpacity 
             style={styles.retryButton}
             onPress={() => retryMessage(item.tempId)}
           >
             <Ionicons name="refresh" size={16} color={COLORS.error} />
             <Text style={styles.retryButtonText}>Retry</Text>
           </TouchableOpacity>
         )}
       </View>
     </View>
   );
 };

 // Handle load more
 const handleLoadMore = () => {
   if (!loadingMore && hasMore && messages.length > 0) {
     loadConversations(true);
   }
 };

 // Footer component for loading more
 const renderFooter = () => {
   if (!loadingMore) return null;
   
   return (
     <View style={styles.loadMoreContainer}>
       <ActivityIndicator size="small" color={COLORS.accent} />
       <Text style={styles.loadMoreText}>Loading more messages...</Text>
     </View>
   );
 };

 return (
   <KeyboardAvoidingView 
     style={[styles.conversationsContainer, style]}
     behavior={Platform.OS === 'ios' ? 'padding' : undefined}
     keyboardVerticalOffset={100}
   >
     {/* Message filters */}
     <View style={styles.messageFilters}>
       {messageFilters.map((filter) => (
         <TouchableOpacity
           key={filter.id}
           style={[styles.filterButton, messageFilter === filter.id && styles.filterButtonActive]}
           onPress={() => setMessageFilter(filter.id)}
         >
           <Ionicons 
             name={filter.icon as any} 
             size={16} 
             color={messageFilter === filter.id ? COLORS.white : COLORS.textDark} 
           />
           <Text style={[styles.filterButtonText, messageFilter === filter.id && styles.filterButtonTextActive]}>
             {filter.label}
           </Text>
         </TouchableOpacity>
       ))}
     </View>
     
     {/* Connection indicator */}
     {!isRealtimeConnected && (
       <View style={styles.connectionStatus}>
         <Text style={styles.connectionText}>Connecting to real-time updates...</Text>
       </View>
     )}
     
     {/* Messages list */}
     <FlatList
       data={filteredMessages}
       renderItem={renderMessage}
       keyExtractor={(item) => item.id || item.tempId || `${item._id}-${item.dateAdded}`}
       contentContainerStyle={styles.messagesList}
       inverted
       showsVerticalScrollIndicator={false}
       refreshControl={
         <RefreshControl
           refreshing={refreshingConversations}
           onRefresh={onRefreshConversations}
           tintColor={COLORS.accent}
         />
       }
       ListEmptyComponent={
         loadingMessages ? (
           <ActivityIndicator size="large" color={COLORS.accent} style={styles.loadingMessages} />
         ) : (
           <Text style={styles.noMessages}>No messages yet</Text>
         )
       }
       onEndReached={handleLoadMore}
       onEndReachedThreshold={0.5}
       ListFooterComponent={renderFooter}
     />
     
     {/* Compose area */}
     <View style={styles.composeContainer}>
       <View style={styles.composeTypeToggle}>
         <TouchableOpacity
           style={[styles.composeTypeButton, composeMode === 'sms' && styles.composeTypeActive]}
           onPress={() => setComposeMode('sms')}
         >
           <Ionicons name="chatbubble" size={16} color={composeMode === 'sms' ? COLORS.white : COLORS.textDark} />
           <Text style={[styles.composeTypeText, composeMode === 'sms' && styles.composeTypeTextActive]}>SMS</Text>
         </TouchableOpacity>
         <TouchableOpacity
           style={[styles.composeTypeButton, composeMode === 'email' && styles.composeTypeActive]}
           onPress={() => setComposeMode('email')}
         >
           <Ionicons name="mail" size={16} color={composeMode === 'email' ? COLORS.white : COLORS.textDark} />
           <Text style={[styles.composeTypeText, composeMode === 'email' && styles.composeTypeTextActive]}>Email</Text>
         </TouchableOpacity>
       </View>
       
       {composeMode === 'email' && (
         <TextInput
           style={styles.subjectInput}
           placeholder="Subject"
           value={emailSubject}
           onChangeText={setEmailSubject}
           placeholderTextColor={COLORS.textLight}
         />
       )}
       
       <View style={styles.composeInputContainer}>
         <TextInput
           style={styles.composeInput}
           placeholder={`Type your ${composeMode} message...`}
           value={composeText}
           onChangeText={setComposeText}
           multiline
           maxLength={composeMode === 'sms' ? 160 : undefined}
           placeholderTextColor={COLORS.textLight}
         />
         <TouchableOpacity 
           style={[styles.sendButton, (!composeText.trim() || sendingMessage) && styles.sendButtonDisabled]}
           onPress={handleSendMessage}
           disabled={!composeText.trim() || sendingMessage}
         >
           {sendingMessage ? (
             <ActivityIndicator size="small" color={COLORS.white} />
           ) : (
             <Ionicons name="send" size={20} color={COLORS.white} />
           )}
         </TouchableOpacity>
       </View>
       
       {composeMode === 'sms' && composeText.length > 0 && (
         <Text style={styles.charCount}>{composeText.length}/160</Text>
       )}
     </View>
     
     {/* Email Viewer Modal */}
     <EmailViewerModal
       visible={emailViewerVisible}
       onClose={() => {
         setEmailViewerVisible(false);
         setSelectedEmailId(null);
         setSelectedEmailSubject('');
       }}
       emailMessageId={selectedEmailId}
       locationId={locationId}
       initialSubject={selectedEmailSubject}
     />
   </KeyboardAvoidingView>
 );
}

const styles = StyleSheet.create({
 conversationsContainer: {
   flex: 1,
   backgroundColor: COLORS.background,
 },
 messageFilters: {
   flexDirection: 'row',
   padding: 16,
   backgroundColor: COLORS.white,
   borderBottomWidth: 1,
   borderBottomColor: COLORS.border,
 },
 filterButton: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingHorizontal: 12,
   paddingVertical: 6,
   borderRadius: 16,
   backgroundColor: COLORS.background,
   marginRight: 8,
 },
 filterButtonActive: {
   backgroundColor: COLORS.accent,
 },
 filterButtonText: {
   fontSize: 14,
   fontFamily: FONT.medium,
   color: COLORS.textDark,
   marginLeft: 4,
 },
 filterButtonTextActive: {
   color: COLORS.white,
 },
 messagesList: {
   padding: 16,
   flexGrow: 1,
 },
 loadingMessages: {
   marginTop: 50,
 },
 noMessages: {
   textAlign: 'center',
   color: COLORS.textLight,
   fontFamily: FONT.regular,
   fontSize: 16,
   marginTop: 50,
 },
 messageBubbleContainer: {
   marginBottom: 16,
 },
 inboundContainer: {
   alignItems: 'flex-start',
 },
 outboundContainer: {
   alignItems: 'flex-end',
 },
 messageBubble: {
   maxWidth: '80%',
   padding: 12,
   borderRadius: 16,
 },
 inboundBubble: {
   backgroundColor: COLORS.background,
   borderBottomLeftRadius: 4,
 },
 outboundBubble: {
   backgroundColor: COLORS.accent,
   borderBottomRightRadius: 4,
 },
 failedBubble: {
   backgroundColor: COLORS.errorLight,
   borderWidth: 1,
   borderColor: COLORS.error,
 },
 messageSubject: {
   fontSize: 14,
   fontFamily: FONT.semiBold,
   color: COLORS.textDark,
   marginBottom: 4,
 },
 messageText: {
   fontSize: 15,
   fontFamily: FONT.regular,
   color: COLORS.textDark,
   marginBottom: 4,
 },
 outboundText: {
   color: COLORS.white,
 },
 messageFooter: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
 },
 messageTime: {
   fontSize: 12,
   fontFamily: FONT.regular,
   color: COLORS.textGray,
 },
 messageStatusIcon: {
   marginLeft: 8,
 },
 messageStatusContainer: {
   marginTop: 4,
 },
 retryText: {
   fontSize: 12,
   fontFamily: FONT.medium,
   color: COLORS.error,
 },
 retryButton: {
   flexDirection: 'row',
   alignItems: 'center',
   marginTop: 8,
   paddingVertical: 4,
   paddingHorizontal: 8,
   backgroundColor: COLORS.white,
   borderRadius: 12,
   borderWidth: 1,
   borderColor: COLORS.error,
 },
 retryButtonText: {
   fontSize: 12,
   fontFamily: FONT.medium,
   color: COLORS.error,
   marginLeft: 4,
 },
 composeContainer: {
   backgroundColor: COLORS.white,
   borderTopWidth: 1,
   borderTopColor: COLORS.border,
   padding: 16,
 },
 composeTypeToggle: {
   flexDirection: 'row',
   marginBottom: 12,
 },
 composeTypeButton: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingHorizontal: 16,
   paddingVertical: 8,
   borderRadius: 20,
   backgroundColor: COLORS.background,
   marginRight: 8,
 },
 composeTypeActive: {
   backgroundColor: COLORS.accent,
 },
 composeTypeText: {
   fontSize: 14,
   fontFamily: FONT.medium,
   color: COLORS.textDark,
   marginLeft: 6,
 },
 composeTypeTextActive: {
   color: COLORS.white,
 },
 subjectInput: {
   borderWidth: 1,
   borderColor: COLORS.border,
   borderRadius: 8,
   paddingHorizontal: 12,
   paddingVertical: 8,
   fontSize: 15,
   fontFamily: FONT.regular,
   color: COLORS.textDark,
   marginBottom: 8,
 },
 composeInputContainer: {
   flexDirection: 'row',
   alignItems: 'flex-end',
 },
 composeInput: {
   flex: 1,
   borderWidth: 1,
   borderColor: COLORS.border,
   borderRadius: 20,
   paddingHorizontal: 16,
   paddingVertical: 10,
   paddingRight: 50,
   fontSize: 15,
   fontFamily: FONT.regular,
   color: COLORS.textDark,
   maxHeight: 100,
 },
 sendButton: {
   position: 'absolute',
   right: 4,
   bottom: 4,
   width: 40,
   height: 40,
   borderRadius: 20,
   backgroundColor: COLORS.accent,
   justifyContent: 'center',
   alignItems: 'center',
 },
 sendButtonDisabled: {
   backgroundColor: COLORS.textLight,
 },
 charCount: {
   fontSize: 12,
   fontFamily: FONT.regular,
   color: COLORS.textGray,
   textAlign: 'right',
   marginTop: 4,
 },
 activityContainer: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingVertical: 16,
   paddingHorizontal: 20,
 },
 activityDot: {
   width: 6,
   height: 6,
   borderRadius: 3,
   backgroundColor: COLORS.textLight,
   marginRight: 12,
 },
 activityText: {
   fontSize: 14,
   fontFamily: FONT.regular,
   color: COLORS.textGray,
   fontStyle: 'italic',
   flex: 1,
 },
 activityTime: {
   fontSize: 12,
   fontFamily: FONT.regular,
   color: COLORS.textLight,
   marginLeft: 12,
 },
 activityChevron: {
   marginLeft: 8,
 },
 emailBubble: {
   backgroundColor: COLORS.white,
   borderWidth: 1,
   borderColor: COLORS.border,
   minHeight: 80,
 },
 emailHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   marginBottom: 8,
 },
 emailLabel: {
   fontSize: 12,
   fontFamily: FONT.medium,
   color: COLORS.textGray,
   marginLeft: 4,
 },
 emailSubject: {
   fontSize: 14,
   fontFamily: FONT.semiBold,
   color: COLORS.textDark,
   marginBottom: 4,
 },
 emailPreview: {
   fontSize: 14,
   fontFamily: FONT.regular,
   color: COLORS.textGray,
   marginBottom: 8,
 },
 loadMoreContainer: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   paddingVertical: 16,
 },
 loadMoreText: {
   fontSize: 14,
   fontFamily: FONT.regular,
   color: COLORS.textGray,
   marginLeft: 8,
 },
 connectionStatus: {
   backgroundColor: COLORS.warning + '20',
   paddingHorizontal: 12,
   paddingVertical: 4,
   alignItems: 'center',
 },
 connectionText: {
   fontSize: 12,
   fontFamily: FONT.regular,
   color: COLORS.warning,
 },
 error: '#DC2626',
 errorLight: '#FEE2E2',
 success: '#10B981',
 warning: '#F59E0B',
});