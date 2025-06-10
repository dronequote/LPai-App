// services/conversationService.ts
import { BaseService } from './baseService';
import { Conversation, Message } from '../../packages/types';

interface ConversationListOptions {
  contactId?: string;
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
    const params = new URLSearchParams({ locationId });
    
    if (options.contactId) params.append('contactId', options.contactId);
    if (options.type) params.append('type', options.type);
    if (options.includeEmail !== undefined) {
      params.append('includeEmail', options.includeEmail.toString());
    }
    
    const endpoint = `/api/conversations?${params}`;
    
    return this.get<Conversation[]>(
      endpoint,
      {
        cache: { priority: 'medium', ttl: 5 * 60 * 1000 }, // 5 min
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );
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
    const params = new URLSearchParams({
      locationId,
      limit: (options?.limit || 20).toString(),
      offset: (options?.offset || 0).toString(),
    });
    
    const endpoint = `/api/conversations/${conversationId}/messages?${params}`;
    
    const response = await this.get<MessageListResponse>(
      endpoint,
      {
        cache: { priority: 'medium', ttl: 2 * 60 * 1000 }, // 2 min
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );

    // Process messages to ensure email content is fetched
    const processedMessages = await this.processMessages(
      response.messages,
      locationId
    );

    return {
      ...response,
      messages: processedMessages,
    };
  }

  /**
   * Get email content
   */
  async getEmailContent(
    emailMessageId: string,
    locationId: string
  ): Promise<EmailContent> {
    const endpoint = `/api/messages/email/${emailMessageId}?locationId=${locationId}`;
    
    return this.get<EmailContent>(
      endpoint,
      {
        cache: { priority: 'high', ttl: 30 * 60 * 1000 }, // 30 min
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
    contactId?: string
  ): Promise<number> {
    const conversations = await this.list(locationId, { contactId });
    
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
      contactId?: string;
      type?: 'sms' | 'email';
      limit?: number;
    }
  ): Promise<ConversationMessage[]> {
    // This would need backend implementation
    // For now, search in cached conversations
    const conversations = await this.list(locationId, {
      contactId: options?.contactId,
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
    contactId: string,
    locationId: string,
    type: 'sms' | 'email' = 'sms'
  ): Promise<Conversation | null> {
    const conversations = await this.list(locationId, {
      contactId,
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
    return this.getMessages(conversationId, locationId, {
      limit,
      offset: currentOffset + limit,
    });
  }

  /**
   * Clear conversation cache
   */
  async clearConversationCache(locationId: string): Promise<void> {
    await this.clearCache(`@lpai_cache_GET_/api/conversations`);
  }
}

export const conversationService = new ConversationService();