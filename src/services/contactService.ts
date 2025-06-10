// services/contactService.ts
import { BaseService } from './baseService';
import { Contact, Project, Conversation, Note, Task } from '../../packages/types';

interface ContactListOptions {
  includeProjects?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}

interface CreateContactInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  notes?: string;
  locationId: string;
}

interface UpdateContactInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

class ContactService extends BaseService {
  /**
   * Get contacts from MongoDB (already synced from GHL)
   */
  async list(
    locationId: string,
    options: ContactListOptions = {}
  ): Promise<Contact[]> {
    // Using YOUR endpoint: /api/contacts/search/lpai
    const endpoint = '/api/contacts/search/lpai';
    
    return this.get<Contact[]>(
      endpoint,
      {
        cache: { priority: 'high', ttl: 10 * 60 * 1000 }, // 10 min
        locationId,
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );
  }

  /**
   * Get single contact - YOUR endpoint pattern
   */
  async getDetails(
    contactId: string
  ): Promise<Contact> {
    const endpoint = `/api/contacts/${contactId}`;
    
    return this.get<Contact>(
      endpoint,
      {
        cache: { priority: 'high' },
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );
  }

  /**
   * Create contact - Goes to MongoDB then GHL
   */
  async create(
    data: CreateContactInput
  ): Promise<Contact> {
    const endpoint = '/api/contacts';
    
    const newContact = await this.post<Contact>(
      endpoint,
      data,
      {
        offline: true,
        locationId: data.locationId,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'contact',
        priority: 'high',
      }
    );

    // Clear list cache
    await this.clearCache('@lpai_cache_GET_/api/contacts/search/lpai');
    
    return newContact;
  }

  /**
   * Update contact - Updates MongoDB & triggers GHL sync
   */
  async update(
    contactId: string,
    data: UpdateContactInput
  ): Promise<Contact> {
    const endpoint = `/api/contacts/${contactId}`;
    
    const updated = await this.patch<Contact>(
      endpoint,
      data,
      {
        offline: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'contact',
        priority: 'high',
      }
    );

    // Update cache
    const cacheKey = `@lpai_cache_GET_/api/contacts/${contactId}`;
    await this.cacheService.set(cacheKey, updated, { priority: 'high' });
    
    return updated;
  }

  /**
   * Get contact conversations - YOUR endpoint
   */
  async getConversations(
    contactId: string,
    locationId: string,
    options?: { limit?: number; offset?: number; type?: string }
  ): Promise<{
    conversations: Conversation[];
    pagination: { total: number; hasMore: boolean };
  }> {
    const params = new URLSearchParams({
      locationId,
      limit: (options?.limit || 10).toString(),
      offset: (options?.offset || 0).toString(),
    });
    
    if (options?.type) params.append('type', options.type);
    
    const endpoint = `/api/contacts/${contactId}/conversations?${params}`;
    
    return this.get(
      endpoint,
      {
        cache: { priority: 'medium', ttl: 5 * 60 * 1000 },
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );
  }

  /**
   * Get contacts with projects - YOUR endpoint
   */
  async getWithProjects(
    locationId: string
  ): Promise<Contact[]> {
    const endpoint = '/api/contacts/withProjects';
    
    return this.get<Contact[]>(
      endpoint,
      {
        cache: { priority: 'medium' },
        locationId,
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );
  }

  /**
   * Sync contact notes from GHL
   */
  async syncNotes(
    contactId: string,
    locationId: string
  ): Promise<Note[]> {
    const endpoint = `/api/contacts/${contactId}/sync-notes`;
    
    const result = await this.post<any>(
      endpoint,
      { locationId },
      {
        showError: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'contact',
        priority: 'low',
      }
    );
    
    return result.notes || [];
  }

  /**
   * Trigger full contact sync from GHL
   */
  async syncFromGHL(
    locationId: string
  ): Promise<{ synced: number; errors: number }> {
    const endpoint = '/api/ghl/syncContacts';
    
    const result = await this.post<any>(
      endpoint,
      { locationId },
      {
        showError: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'contact',
        priority: 'low',
      }
    );
    
    // Clear all contact caches after sync
    await this.clearCache('@lpai_cache_GET_/api/contacts');
    
    return {
      synced: result.count || 0,
      errors: 0,
    };
  }

  /**
   * Search contacts in GHL (if needed)
   */
  async searchInGHL(
    locationId: string,
    query: string
  ): Promise<Contact[]> {
    const endpoint = '/api/contacts/search/ghl';
    
    return this.post<Contact[]>(
      endpoint,
      { 
        locationId,
        query,
        limit: 20,
      },
      {
        cache: false, // Don't cache GHL searches
      },
      {
        endpoint,
        method: 'POST',
        entity: 'contact',
      }
    );
  }
}

export const contactService = new ContactService();