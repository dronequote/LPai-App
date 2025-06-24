// services/conversationService.ts
// Updated Date 06/24/2025
import { BaseService } from './baseService';
import { Conversation, Message } from '../../packages/types';

interface ConversationListOptions {
  contactObjectId?: string;  // Changed from contactId
  type?: 'sms' | 'email';
  includeEmail?: boolean;
  limit?: number;
  offset?: number;
}

interface ConversationMessage {
  id: string;
  type: number;
  messageType?: string;
  direction: 'inbound' | 'outbound';
  dateAdded: string;
  source?: string;
  read: boolean;
  body?: string;
  subject?: string;
  from?: string;
  to?: string;
  emailMessageId?: string;
  needsContentFetch?: boolean;
  preview?: string;
  activityType?: string;
  meta?: any;
}

interface MessageListResponse {
  success: boolean;
  conversationId: string;
  messages: ConversationMessage[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface EmailContent {
  success: boolean;
  email: {
    id: string;
    subject: string;
    body: string;
    from: string;
    to: string;
    cc?: string[];
    bcc?: string[];
    dateAdded: string;
    status: string;
    direction: string;
    provider: string;
    threadId?: string;
  };
}

class ConversationService extends BaseService {
  // Message type constants from your backend
  private readonly MESSAGE_TYPES = {
    SMS: 1,
    EMAIL: 3,
    ACTIVITY_CONTACT: 25,
    ACTIVITY_INVOICE: 26,
  };

  /**
   * Get conversations list
   */
  async list(
      locationId: string,
      options: ConversationListOptions = {}
    ): Promise<Conversation[]> {
      if (__DEV__) {
        console.log('[conversationService.list] Called with:', {
          locationId,
          options,
          locationIdType: typeof locationId,
          hasContactObjectId: !!options.contactObjectId,
          contactObjectId: options.contactObjectId
        });
      }

      const endpoint = '/api/conversations';
    
    // Build all params as an object
     const params: any = { locationId };
    
    // Map to what backend expects
    if (options.contactObjectId) {
      params.contactId = options.contactObjectId;  // Backend expects 'contactId'
    }
    
    if (options.type) params.type = options.type;
    if (options.includeEmail !== undefined) params.includeEmail = options.includeEmail;
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;
    
    if (__DEV__) {
      console.log('[conversationService.list] Calling with params:', params);
    }

    try {
      const result = await this.get<Conversation[]>(
        endpoint,
        {
          cache: {
            priority: 'network-first',
            ttl: 24 * 60 * 60 * 1000,
            staleWhileRevalidate: true
          },
          params
        },
        {
          endpoint,
          method: 'GET',
          entity: 'contact',
        }
      );

      if (__DEV__) {
        console.log('[conversationService.list] Response:', {
          isArray: Array.isArray(result),
          length: result?.length || 0,
          firstItem: result?.[0]
        });
      }

      return result;
    } catch (error: any) {
      // ... error handling stays the same ...
      throw error;
    }
  }


  /**
 * Get messages for a conversation
 */
async getMessages(
  conversationId: string,
  locationId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<MessageListResponse> {
  if (__DEV__) {
    console.log('[conversationService.getMessages] Called with:', {
      conversationId,
      locationId,
      options
    });
  }

  const endpoint = `/api/conversations/${conversationId}/messages`;
  
  // Build params object
  const params: any = {
    locationId,
    limit: options?.limit || 20,
    offset: options?.offset || 0
  };
  
  if (__DEV__) {
    console.log('[conversationService.getMessages] Endpoint:', endpoint);
    console.log('[conversationService.getMessages] Params:', params);
  }

  try {
    const response = await this.get<MessageListResponse>(
      endpoint,
      {
        cache: {
          priority: 'network-first',      // Always try network first
          ttl: 24 * 60 * 60 * 1000,      // Keep for 24 hours for offline
          staleWhileRevalidate: true      // Return stale while fetching
        },
        params
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );

    if (__DEV__) {
      console.log('[conversationService.getMessages] Response:', {
        success: response.success,
        messageCount: response.messages?.length || 0,
        pagination: response.pagination
      });
      // Log first message structure to see what we're working with
      if (response.messages && response.messages.length > 0) {
        console.log('[conversationService.getMessages] First message:', JSON.stringify(response.messages[0], null, 2));
      }
    }

    // Don't process messages - we'll fetch email content on click
    // const processedMessages = await this.processMessages(
    //   response.messages,
    //   locationId
    // );

    return response; // Return the raw response without processing
  } catch (error: any) {
    if (__DEV__) {
      console.log('[conversationService.getMessages] Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        isOffline: !navigator.onLine
      });
    }

    // If offline, try to return cached data
    if (!navigator.onLine) {
      try {
        const cachedKey = `@lpai_cache_GET_${endpoint}_${JSON.stringify(params)}`;
        const cached = await this.getCached(cachedKey);
        if (cached) {
          if (__DEV__) {
            console.log('[conversationService.getMessages] Returning cached data for offline use');
          }
          return cached;
        }
      } catch (cacheError) {
        if (__DEV__) {
          console.log('[conversationService.getMessages] Cache retrieval failed:', cacheError);
        }
      }
    }

    throw error;
  }
}

  /**
   * Force refresh conversations (for pull-to-refresh)
   */
 async refreshConversations(
    locationId: string,
    options: ConversationListOptions = {}
  ): Promise<Conversation[]> {
    if (__DEV__) {
      console.log('[conversationService.refreshConversations] Force refreshing...');
    }

    // Clear relevant cache first
    const endpoint = '/api/conversations';
    const params: any = { locationId };
    
    // Map to what backend expects for cache key
    if (options.contactObjectId) {
      params.contactId = options.contactObjectId;
    }
    
    const cacheKey = `@lpai_cache_GET_${endpoint}_${JSON.stringify(params)}`;
    await this.clearCache(cacheKey);

    // Now fetch fresh data
    return this.list(locationId, options);
  }


  /**
   * Force refresh messages (for pull-to-refresh)
   */
  async refreshMessages(
    conversationId: string,
    locationId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<MessageListResponse> {
    if (__DEV__) {
      console.log('[conversationService.refreshMessages] Force refreshing...');
    }

    // Clear relevant cache first
    const endpoint = `/api/conversations/${conversationId}/messages`;
    const params: any = {
      locationId,
      limit: options?.limit || 20,
      offset: options?.offset || 0
    };
    
    const cacheKey = `@lpai_cache_GET_${endpoint}_${JSON.stringify(params)}`;
    await this.clearCache(cacheKey);

    // Now fetch fresh data
    return this.getMessages(conversationId, locationId, options);
  }

  /**
   * Get email content
   */
  async getEmailContent(
    emailMessageId: string,
    locationId: string
  ): Promise<EmailContent> {
    if (__DEV__) {
      console.log('[conversationService.getEmailContent] Called with:', {
        emailMessageId,
        locationId
      });
    }

    const endpoint = `/api/messages/email/${emailMessageId}?locationId=${locationId}`;
    
    return this.get<EmailContent>(
      endpoint,
      {
        cache: { priority: 'high', ttl: 30 * 60 * 1000 }, // 30 min - emails don't change
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );
  }

  /**
   * Mark messages as read
   */
  async markAsRead(
    conversationId: string,
    messageIds: string[],
    locationId: string
  ): Promise<{ success: boolean }> {
    if (__DEV__) {
      console.log('[conversationService.markAsRead] Called with:', {
        conversationId,
        messageIds,
        locationId
      });
    }

    // This would need backend implementation
    // For now, just clear cache
    await this.clearCache(`@lpai_cache_GET_/api/conversations/${conversationId}/messages`);
    
    return { success: true };
  }

  /**
   * Get unread count
   */
 async getUnreadCount(
    locationId: string,
    contactObjectId?: string  // Changed from contactId
  ): Promise<number> {
    if (__DEV__) {
      console.log('[conversationService.getUnreadCount] Called with:', {
        locationId,
        contactObjectId
      });
    }

    const conversations = await this.list(locationId, { contactObjectId });
    
    return conversations.reduce((total, conv) => {
      return total + (conv.unreadCount || 0);
    }, 0);
  }

  /**
   * Search messages
   */
  async searchMessages(
    locationId: string,
    query: string,
    options?: {
      contactObjectId?: string;  // Changed from contactId
      type?: 'sms' | 'email';
      limit?: number;
    }
  ): Promise<ConversationMessage[]> {
    if (__DEV__) {
      console.log('[conversationService.searchMessages] Called with:', {
        locationId,
        query,
        options
      });
    }

    const conversations = await this.list(locationId, {
      contactObjectId: options?.contactObjectId,
      type: options?.type,
    });

    const results: ConversationMessage[] = [];
    const searchLower = query.toLowerCase();

    for (const conv of conversations) {
      if (conv.lastMessageBody?.toLowerCase().includes(searchLower)) {
        // Add a preview message
        results.push({
          id: conv._id,
          type: conv.type === 'email' ? this.MESSAGE_TYPES.EMAIL : this.MESSAGE_TYPES.SMS,
          direction: conv.lastMessageDirection as 'inbound' | 'outbound',
          dateAdded: conv.lastMessageDate,
          read: conv.unreadCount === 0,
          body: conv.lastMessageBody,
          preview: conv.lastMessageBody,
        });
      }
    }

    return results.slice(0, options?.limit || 20);
  }

  /**
   * Get conversation by contact
   */
  async getByContact(
    contactObjectId: string,  // Changed from contactId
    locationId: string,
    type: 'sms' | 'email' = 'sms'
  ): Promise<Conversation | null> {
    if (__DEV__) {
      console.log('[conversationService.getByContact] Called with:', {
        contactObjectId,
        locationId,
        type
      });
    }

    const conversations = await this.list(locationId, {
      contactObjectId,
      type,
    });

    return conversations[0] || null;
  }
  /**
   * Process messages to fetch email content if needed
   */
  private async processMessages(
    messages: ConversationMessage[],
    locationId: string
  ): Promise<ConversationMessage[]> {
    if (__DEV__) {
      console.log('[conversationService.processMessages] Processing', messages.length, 'messages');
    }

    const processed = await Promise.all(
      messages.map(async (msg) => {
        // If it's an email that needs content
        if (msg.type === this.MESSAGE_TYPES.EMAIL && msg.needsContentFetch && msg.emailMessageId) {
          try {
            const emailContent = await this.getEmailContent(msg.emailMessageId, locationId);
            
            return {
              ...msg,
              subject: emailContent.email.subject,
              body: emailContent.email.body,
              from: emailContent.email.from,
              to: emailContent.email.to,
              needsContentFetch: false,
            };
          } catch (error) {
            console.error('Failed to fetch email content:', error);
            return msg;
          }
        }
        
        return msg;
      })
    );

    return processed;
  }

  /**
   * Format message for display
   */
  formatMessage(message: ConversationMessage): {
    type: 'sms' | 'email' | 'activity';
    content: string;
    preview: string;
    timestamp: Date;
    isInbound: boolean;
  } {
    const timestamp = new Date(message.dateAdded);
    const isInbound = message.direction === 'inbound';

    // SMS
    if (message.type === this.MESSAGE_TYPES.SMS) {
      return {
        type: 'sms',
        content: message.body || '',
        preview: message.body?.substring(0, 100) || '',
        timestamp,
        isInbound,
      };
    }

    // Email
    if (message.type === this.MESSAGE_TYPES.EMAIL) {
      const content = message.body || message.preview || 'Email content not loaded';
      return {
        type: 'email',
        content,
        preview: message.subject || content.substring(0, 100),
        timestamp,
        isInbound,
      };
    }

    // Activity
    return {
      type: 'activity',
      content: message.body || '',
      preview: message.activityType || 'Activity',
      timestamp,
      isInbound: false,
    };
  }

  /**
   * Get conversation stats
   */
  async getStats(
    locationId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalConversations: number;
    totalMessages: number;
    unreadMessages: number;
    byType: {
      sms: number;
      email: number;
    };
  }> {
    if (__DEV__) {
      console.log('[conversationService.getStats] Called with:', {
        locationId,
        dateRange
      });
    }

    const conversations = await this.list(locationId);
    
    const stats = {
      totalConversations: conversations.length,
      totalMessages: 0,
      unreadMessages: 0,
      byType: {
        sms: 0,
        email: 0,
      },
    };

    conversations.forEach(conv => {
      stats.unreadMessages += conv.unreadCount || 0;
      
      if (conv.type === 'TYPE_PHONE' || conv.type === 'sms') {
        stats.byType.sms++;
      } else if (conv.type === 'email') {
        stats.byType.email++;
      }
    });

    return stats;
  }

  /**
   * Load more messages (pagination)
   */
  async loadMoreMessages(
    conversationId: string,
    locationId: string,
    currentOffset: number,
    limit: number = 20
  ): Promise<MessageListResponse> {
    if (__DEV__) {
      console.log('[conversationService.loadMoreMessages] Called with:', {
        conversationId,
        locationId,
        currentOffset,
        limit
      });
    }

    return this.getMessages(conversationId, locationId, {
      limit,
      offset: currentOffset + limit,
    });
  }

  /**
   * Clear conversation cache
   */
  async clearConversationCache(locationId: string): Promise<void> {
    if (__DEV__) {
      console.log('[conversationService.clearConversationCache] Called with:', {
        locationId
      });
    }

    await this.clearCache(`@lpai_cache_GET_/api/conversations`);
  }
}

export const conversationService = new ConversationService();