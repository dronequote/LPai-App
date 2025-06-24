// src/components/ConversationsList.tsx
// Updated Date: 06/24/2025
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // ADD THIS IMPORT
import { Ionicons } from '@expo/vector-icons';
import { conversationService } from '../services/conversationService';
import { smsService } from '../services/smsService';
import { emailService } from '../services/emailService';
import { COLORS, FONT, SHADOW } from '../styles/theme';
// NEW: Import api for email fetching
import api from '../lib/api';
// NEW: Import EmailViewerModal
import EmailViewerModal from './EmailViewerModal';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';

type MessageFilter = 'all' | 'sms' | 'email' | 'call';

const messageFilters: { id: MessageFilter; label: string; icon: string }[] = [
 { id: 'all', label: 'All', icon: 'apps' },
 { id: 'sms', label: 'SMS', icon: 'chatbubble' },
 { id: 'email', label: 'Email', icon: 'mail' },
 { id: 'call', label: 'Calls', icon: 'call' },
];

// NEW: Message status type
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

// NEW: Optimistic message interface
interface OptimisticMessage {
  id: string;
  type: number;
  direction: 'outbound';
  dateAdded: string;
  body: string;
  subject?: string;
  read: boolean;
  status: MessageStatus;
  tempId: string; // For tracking optimistic updates
  retryCount?: number;
}

interface ConversationsListProps {
 contactObjectId: string;  // Changed from contactId
 contactPhone: string;
 contactEmail: string;
 locationId: string;
 userId: string;
 userName?: string;
 user?: any; // Add this to get user preferences
 onNavigateToProject?: (projectId: string) => void;
 onNavigateToAppointment?: (appointmentId: string) => void;
 onNavigateToSettings?: () => void;
 style?: any;
}

export default function ConversationsList({
 contactObjectId,  // Changed from contactId
 contactPhone,
 contactEmail,
 locationId,
 userId,
 userName,
 user, // Add this
 onNavigateToProject,
 onNavigateToAppointment,
 onNavigateToSettings,
 style,
}: ConversationsListProps) {
 // Conversations state
 const [messageFilter, setMessageFilter] = useState<MessageFilter>('all');
 const [conversations, setConversations] = useState<any[]>([]);
 const [messages, setMessages] = useState<any[]>([]);
 const [loadingMessages, setLoadingMessages] = useState(false);
 const [composeText, setComposeText] = useState('');
 const [composeMode, setComposeMode] = useState<'sms' | 'email'>('sms');
 const [emailSubject, setEmailSubject] = useState('');
 const [sendingMessage, setSendingMessage] = useState(false);
 const [refreshingConversations, setRefreshingConversations] = useState(false);
 
 // NEW: Pagination state
 const [offset, setOffset] = useState(0);
 const [hasMore, setHasMore] = useState(true);
 const [loadingMore, setLoadingMore] = useState(false);
 
 // NEW: Email content cache
 const [emailContentCache, setEmailContentCache] = useState<Record<string, any>>({});
 const [fetchingEmails, setFetchingEmails] = useState<Set<string>>(new Set());
 
 // NEW: Email viewer modal state
 const [emailViewerVisible, setEmailViewerVisible] = useState(false);
 const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
 const [selectedEmailSubject, setSelectedEmailSubject] = useState<string>('');

 // NEW: Track optimistic messages
 const optimisticMessagesRef = useRef<Map<string, OptimisticMessage>>(new Map());

 // Real-time messages hook - FIXED VERSION
 const { isConnected } = useRealtimeMessages({
   locationId,
   contactObjectId,
   conversationId: conversations[0]?._id,
   onNewMessage: useCallback((newMessage) => {
     if (__DEV__) {
       console.log('[ConversationsList] New message received:', {
         id: newMessage.id,
         _id: newMessage._id,
         body: newMessage.body?.substring(0, 50),
         direction: newMessage.direction
       });
     }
     
     // Force a refresh approach - more reliable
     if (newMessage.direction === 'inbound') {
       // Small delay to ensure the message is saved in DB
       setTimeout(() => {
         if (__DEV__) {
           console.log('[ConversationsList] Reloading conversations for inbound message');
         }
         loadConversations();
       }, 500);
     } else {
       // For outbound messages, try to merge
       setMessages(prevMessages => {
         // Simple duplicate check
         const messageId = newMessage.id || newMessage._id;
         const exists = prevMessages.some(msg => 
           (msg.id === messageId) || (msg._id === messageId)
         );
         
         if (exists) {
           if (__DEV__) {
             console.log('[ConversationsList] Message already exists, skipping');
           }
           return prevMessages;
         }
         
         if (__DEV__) {
           console.log('[ConversationsList] Adding new message to list');
         }
         
         // Remove any optimistic message with the same body
         const filtered = prevMessages.filter(msg => {
           if (msg.tempId && msg.body === newMessage.body) {
             optimisticMessagesRef.current.delete(msg.tempId);
             return false;
           }
           return true;
         });
         
         return [newMessage, ...filtered];
       });
     }
   }, []), // Empty deps array since loadConversations is defined below
   onConnectionChange: useCallback((connected) => {
     if (__DEV__) {
       console.log('[ConversationsList] Connection status changed:', connected);
     }
   }, []),
   enabled: true,
   pollInterval: 2000 // Poll every 2 seconds
 });

 // NEW: Helper function to clear all message caches
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

 // Load conversations
 const loadConversations = async (isLoadMore = false) => {
   if (!locationId || !contactObjectId) return;  // Changed from contactId
   
   if (!isLoadMore) {
     setLoadingMessages(true);
     setOffset(0); // Reset offset for fresh load
   } else {
     setLoadingMore(true);
   }
   
   try {
     const convs = await conversationService.list(locationId, {
       contactObjectId: contactObjectId  // Changed from contactId
     });
     
     if (__DEV__) {
       console.log('Loading conversations for contact:', contactObjectId);  // Changed from contactId
       console.log('Conversations response:', convs);
     }
     
     if (convs && convs.length > 0) {
       setConversations(convs);
       
       // Load messages from first conversation
       try {
         const messagesResponse = await conversationService.getMessages(
           convs[0]._id,
           locationId,
           {
             limit: 20,
             offset: isLoadMore ? offset : 0,
             cache: false // Force fresh fetch
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
           // NEW: Merge with optimistic messages that haven't been replaced
           const optimisticMessages = Array.from(optimisticMessagesRef.current.values());
           const mergedMessages = [...optimisticMessages, ...newMessages];
           setMessages(mergedMessages);
           setOffset(newMessages.length);
         }
         
         // Update hasMore based on pagination
         setHasMore(messagesResponse.pagination?.hasMore || false);
         
         // NEW: Auto-fetch email content for recent emails without content
         const emailsToFetch = newMessages
           .filter(msg => 
             msg.type === 3 && 
             msg.needsContentFetch && 
             msg.emailMessageId &&
             !emailContentCache[msg.emailMessageId]
           )
           .slice(0, 5); // Limit to 5 emails at a time
         
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
         console.log('No conversations found for contact:', contactObjectId);  // Changed from contactId
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

 // NEW: Fetch email contents
 const fetchEmailContents = async (emails: any[]) => {
   const fetchPromises = emails.map(async (email) => {
     if (fetchingEmails.has(email.emailMessageId)) return;
     
     setFetchingEmails(prev => new Set(prev).add(email.emailMessageId));
     
     try {
       const response = await api.get(`/messages/email/${email.emailMessageId}`, {
         params: { locationId }
       });
       
       if (response.data.success && response.data.email) {
         setEmailContentCache(prev => ({
           ...prev,
           [email.emailMessageId]: response.data.email
         }));
         
         // Update the message in state with fetched content
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

 // NEW: Fetch single email content on tap
 const fetchEmailContent = async (emailMessageId: string) => {
   if (fetchingEmails.has(emailMessageId) || emailContentCache[emailMessageId]) return;
   
   setFetchingEmails(prev => new Set(prev).add(emailMessageId));
   
   try {
     const response = await api.get(`/messages/email/${emailMessageId}`, {
       params: { locationId }
     });
     
     if (response.data.success && response.data.email) {
       setEmailContentCache(prev => ({
         ...prev,
         [emailMessageId]: response.data.email
       }));
       
       // Update the message in state
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

 // UPDATED: Refresh handler with proper cache clearing
 const onRefreshConversations = useCallback(async () => {
   if (!locationId || !contactObjectId) return;  // Changed from contactId
   
   setRefreshingConversations(true);
   try {
     // Clear ALL relevant caches
     await conversationService.clearConversationCache(locationId);
     await clearAllMessageCaches();
     
     // Clear optimistic messages
     optimisticMessagesRef.current.clear();
     
     // Now load fresh conversations
     const convs = await conversationService.list(locationId, {
       contactObjectId: contactObjectId  // Changed from contactId
     });
     
     if (__DEV__) {
       console.log('Refreshing conversations for contact:', contactObjectId);  // Changed from contactId
       console.log('Fresh conversations response:', convs);
     }
     
     if (convs && convs.length > 0) {
       setConversations(convs);
       
       // Load messages from first conversation
       try {
         // Force fresh fetch by clearing cache first
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
         
         // Auto-fetch recent emails
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
 }, [locationId, contactObjectId, emailContentCache]);  // Changed from contactId

 // Load conversations on mount
 useEffect(() => {
   loadConversations();
 }, [contactObjectId, locationId]);  // Changed from contactId

 // NEW: Retry failed message
 const retryMessage = async (tempId: string) => {
   const optimisticMessage = optimisticMessagesRef.current.get(tempId);
   if (!optimisticMessage) return;

   // Update status to sending
   optimisticMessage.status = 'sending';
   optimisticMessage.retryCount = (optimisticMessage.retryCount || 0) + 1;
   setMessages(prevMessages => 
     prevMessages.map(msg => 
       msg.tempId === tempId ? { ...msg, status: 'sending' } : msg
     )
   );

   try {
     if (optimisticMessage.type === 1) {
       // Retry SMS
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
       // Retry Email
       await emailService.send({
         contactObjectId: contactObjectId,
         locationId: locationId,
         subject: optimisticMessage.subject || 'Message from ' + (userName || 'Team'),
         plainTextContent: optimisticMessage.body,
         userId: userId,
       });
     }

     // Success - update status
     optimisticMessage.status = 'sent';
     setMessages(prevMessages => 
       prevMessages.map(msg => 
         msg.tempId === tempId ? { ...msg, status: 'sent' } : msg
       )
     );

     // Remove from optimistic after delay
     setTimeout(() => {
       optimisticMessagesRef.current.delete(tempId);
       loadConversations();
     }, 2000);

   } catch (error) {
     // Failed again
     optimisticMessage.status = 'failed';
     setMessages(prevMessages => 
       prevMessages.map(msg => 
         msg.tempId === tempId ? { ...msg, status: 'failed' } : msg
       )
     );
   }
 };

 // UPDATED: handleSendMessage with optimistic updates
 const handleSendMessage = async () => {
   if (!composeText.trim() || !userId || !locationId) return;
   
   setSendingMessage(true);
   
   // Create optimistic message
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

   // Add to optimistic messages map
   optimisticMessagesRef.current.set(tempId, optimisticMessage);

   // Add to UI immediately
   setMessages(prevMessages => [optimisticMessage, ...prevMessages]);
   
   // Clear inputs immediately for better UX
   const savedComposeText = composeText;
   const savedEmailSubject = emailSubject;
   setComposeText('');
   setEmailSubject('');

   try {
     if (composeMode === 'sms') {
       // Check if SMS is configured by looking at user preferences directly
       const smsNumberId = user?.preferences?.communication?.smsNumberId;
       
       if (__DEV__) {
         console.log('SMS Configuration Check:');
         console.log('User preferences:', user?.preferences?.communication);
         console.log('SMS Number ID:', smsNumberId);
       }
       
       if (!smsNumberId) {
         // Restore text and mark as failed
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
       
       // Get the phone number from user preferences to avoid the 404 error
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
       
       // Format the phone number properly (add +1 if not present)
       const formattedFromNumber = fromNumber.startsWith('+') ? fromNumber : `+1${fromNumber}`;
       const formattedToNumber = contactPhone.startsWith('+') ? contactPhone : `+1${contactPhone}`;
       
       if (__DEV__) {
         console.log('SMS Send Request:');
         console.log('From:', formattedFromNumber);
         console.log('To:', formattedToNumber);
         console.log('ContactObjectId:', contactObjectId);  // Changed from ContactId
         console.log('LocationId:', locationId);
         console.log('UserId:', userId);
         console.log('Message:', savedComposeText);
       }
       
       try {
         await smsService.send({
           contactObjectId: contactObjectId,  // Changed from contactId
           locationId: locationId,
           customMessage: savedComposeText,
           toNumber: formattedToNumber,
           userId: userId,
           fromNumber: formattedFromNumber,
           templateKey: 'custom',
         });

         // Success - update status to sent
         optimisticMessage.status = 'sent';
         setMessages(prevMessages => 
           prevMessages.map(msg => 
             msg.tempId === tempId ? { ...msg, status: 'sent' } : msg
           )
         );

       } catch (smsError: any) {
         // Check if it's the known issue where SMS sends but returns 500
         if (smsError.response?.status === 500 && 
             smsError.response?.data?.error === 'Failed to send SMS') {
           if (__DEV__) {
             console.log('SMS sent successfully despite 500 error');
           }
           // Mark as sent
           optimisticMessage.status = 'sent';
           setMessages(prevMessages => 
             prevMessages.map(msg => 
               msg.tempId === tempId ? { ...msg, status: 'sent' } : msg
             )
           );
         } else {
           // Real error - mark as failed
           throw smsError;
         }
       }

       // Clear caches and reload after delay
       setTimeout(async () => {
         await clearAllMessageCaches();
         await conversationService.clearConversationCache(locationId);
         optimisticMessagesRef.current.delete(tempId);
         await loadConversations();
       }, 2000);
       
     } else {
       // Email sending code
       await emailService.send({
         contactObjectId: contactObjectId,  // Changed from contactId
         locationId: locationId,
         subject: savedEmailSubject || 'Message from ' + (userName || 'Team'),
         plainTextContent: savedComposeText,
         userId: userId,
       });
       
       // Success - update status
       optimisticMessage.status = 'sent';
       setMessages(prevMessages => 
         prevMessages.map(msg => 
           msg.tempId === tempId ? { ...msg, status: 'sent' } : msg
         )
       );
       
       // Clear caches and reload
       setTimeout(async () => {
         await clearAllMessageCaches();
         await conversationService.clearConversationCache(locationId);
         optimisticMessagesRef.current.delete(tempId);
         await loadConversations();
       }, 2000);
     }
   } catch (error: any) {
     if (__DEV__) {
       console.error('Send Error:', error);
       console.error('Error details:', error.response?.data);
     }
     
     // Mark message as failed
     optimisticMessage.status = 'failed';
     setMessages(prevMessages => 
       prevMessages.map(msg => 
         msg.tempId === tempId ? { ...msg, status: 'failed' } : msg
       )
     );
     
     // Handle specific SMS errors
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
       // Generic error - show retry option
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
   
   // Check if it's an activity (type >= 25)
   const isActivity = item.type >= 25 || item.messageType?.startsWith('TYPE_ACTIVITY');
   const isEmail = item.type === 3 || item.messageType === 'TYPE_EMAIL';
   const isSMS = item.type === 1 || item.messageType === 'TYPE_SMS' || item.messageType === 'TYPE_PHONE';
   
   // NEW: Check if this is an optimistic message
   const isOptimistic = !!item.tempId;
   const messageStatus = item.status || 'delivered';
   
   // Render activity
   if (isActivity) {
     // Determine if clickable and where to navigate
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
     
     // Non-clickable activity
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
     // NEW: Check if email has content or needs fetching
     const hasContent = item.body && !item.needsContentFetch;
     const isFetching = item.emailMessageId && fetchingEmails.has(item.emailMessageId);
     
     // Debug log to check email structure
     if (__DEV__) {
       console.log('Email message structure:', {
         id: item.id,
         emailMessageId: item.emailMessageId,
         ghlMessageId: item.ghlMessageId,
         needsContentFetch: item.needsContentFetch,
         hasContent
       });
     }
     
     return (
       <TouchableOpacity 
         style={[styles.messageBubbleContainer, isInbound ? styles.inboundContainer : styles.outboundContainer]}
         onPress={() => {
           // NEW: Open email viewer modal
           if (item.emailMessageId) {
             setSelectedEmailId(item.emailMessageId);
             setSelectedEmailSubject(item.subject || '');
             setEmailViewerVisible(true);
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
           
           {/* NEW: Show status for optimistic emails */}
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
           
           {/* NEW: Status indicators for outbound messages */}
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
         
         {/* NEW: Retry button for failed messages */}
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

 // NEW: Handle load more
 const handleLoadMore = () => {
   if (!loadingMore && hasMore && messages.length > 0) {
     loadConversations(true);
   }
 };

 // NEW: Footer component for loading more
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
     {isConnected && (
       <View style={styles.connectionIndicator}>
         <View style={styles.connectedDot} />
         <Text style={styles.connectionText}>Live</Text>
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
       // NEW: Load more functionality
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
 connectionIndicator: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingHorizontal: 8,
   paddingVertical: 4,
   backgroundColor: COLORS.success + '20',
   borderRadius: 12,
   position: 'absolute',
   top: 10,
   right: 16,
   zIndex: 100,
 },
 connectedDot: {
   width: 6,
   height: 6,
   borderRadius: 3,
   backgroundColor: COLORS.success,
   marginRight: 6,
 },
 connectionText: {
   fontSize: 11,
   fontFamily: FONT.medium,
   color: COLORS.success,
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
 },
 emailHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   marginBottom: 4,
 },
 emailLabel: {
   fontSize: 11,
   fontFamily: FONT.medium,
   color: COLORS.textGray,
   marginLeft: 4,
   textTransform: 'uppercase',
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
   marginBottom: 4,
 },
 // NEW: Load more styles
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
 // NEW: Error colors
 error: '#DC2626',
 errorLight: '#FEE2E2',
 success: '#10B981',
});