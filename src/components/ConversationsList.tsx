// src/components/ConversationsList.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { conversationService } from '../services/conversationService';
import { smsService } from '../services/smsService';
import { emailService } from '../services/emailService';
import { COLORS, FONT, SHADOW } from '../styles/theme';
// NEW: Import api for email fetching
import api from '../lib/api';
// NEW: Import EmailViewerModal
import EmailViewerModal from './EmailViewerModal';

type MessageFilter = 'all' | 'sms' | 'email' | 'call';

const messageFilters: { id: MessageFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'sms', label: 'SMS', icon: 'chatbubble' },
  { id: 'email', label: 'Email', icon: 'mail' },
  { id: 'call', label: 'Calls', icon: 'call' },
];

interface ConversationsListProps {
  contactId: string;
  contactPhone: string;
  contactEmail: string;
  locationId: string;
  userId: string;
  userName?: string;
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToAppointment?: (appointmentId: string) => void;
  style?: any;
}

export default function ConversationsList({
  contactId,
  contactPhone,
  contactEmail,
  locationId,
  userId,
  userName,
  onNavigateToProject,
  onNavigateToAppointment,
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

  // Load conversations
  const loadConversations = async (isLoadMore = false) => {
    if (!locationId || !contactId) return;
    
    if (!isLoadMore) {
      setLoadingMessages(true);
      setOffset(0); // Reset offset for fresh load
    } else {
      setLoadingMore(true);
    }
    
    try {
      const convs = await conversationService.list(locationId, {
        contactId: contactId
      });
      
      if (__DEV__) {
        console.log('Loading conversations for contact:', contactId);
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
              offset: isLoadMore ? offset : 0
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
            setMessages(newMessages);
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
          console.log('No conversations found for contact:', contactId);
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

  // Refresh handler for conversations
  const onRefreshConversations = useCallback(async () => {
    if (!locationId || !contactId) return;
    
    setRefreshingConversations(true);
    try {
      // Clear cache first to force fresh data
      await conversationService.clearConversationCache(locationId);
      
      // Now load fresh conversations
      const convs = await conversationService.list(locationId, {
        contactId: contactId
      });
      
      if (__DEV__) {
        console.log('Refreshing conversations for contact:', contactId);
        console.log('Fresh conversations response:', convs);
      }
      
      if (convs && convs.length > 0) {
        setConversations(convs);
        
        // Load messages from first conversation
        try {
          const messagesResponse = await conversationService.getMessages(
            convs[0]._id,
            locationId,
            { limit: 20, offset: 0 }
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
  }, [locationId, contactId, emailContentCache]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [contactId, locationId]);

  // Send message
  const handleSendMessage = async () => {
    if (!composeText.trim() || !userId || !locationId) return;
    
    setSendingMessage(true);
    try {
      if (composeMode === 'sms') {
        await smsService.send({
          contactId: contactId,
          locationId: locationId,
          customMessage: composeText,
          toNumber: contactPhone,
          userId: userId,
        });
        
        // Add the message to local state immediately
        const newMessage = {
          id: Date.now().toString(),
          type: 1, // SMS type
          direction: 'outbound',
          dateAdded: new Date().toISOString(),
          body: composeText,
          read: true,
        };
        setMessages([newMessage, ...messages]);
      } else {
        await emailService.send({
          contactId: contactId,
          locationId: locationId,
          subject: emailSubject || 'Message from ' + (userName || 'Team'),
          plainTextContent: composeText,
          userId: userId,
        });
        
        // Add the email to local state immediately
        const newMessage = {
          id: Date.now().toString(),
          type: 3, // Email type
          direction: 'outbound',
          dateAdded: new Date().toISOString(),
          subject: emailSubject || 'Message from ' + (userName || 'Team'),
          body: composeText,
          read: true,
        };
        setMessages([newMessage, ...messages]);
      }
      
      setComposeText('');
      setEmailSubject('');
      Alert.alert('Success', `${composeMode.toUpperCase()} sent successfully`);
      
      // Try to reload conversations
      try {
        await loadConversations();
      } catch (e) {
        // Ignore errors when reloading
      }
    } catch (error) {
      Alert.alert('Error', `Failed to send ${composeMode}`);
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
          </View>
        </TouchableOpacity>
      );
    }
    
    // Render SMS/regular message
    return (
      <View style={[styles.messageBubbleContainer, isInbound ? styles.inboundContainer : styles.outboundContainer]}>
        <View style={[styles.messageBubble, isInbound ? styles.inboundBubble : styles.outboundBubble]}>
          <Text style={[styles.messageText, !isInbound && styles.outboundText]}>
            {item.body || item.preview || 'No content'}
          </Text>
          <Text style={[styles.messageTime, !isInbound && styles.outboundText]}>
            {messageTime}
          </Text>
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
      
      {/* Messages list */}
      <FlatList
        data={filteredMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
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
  messageTime: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
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
});