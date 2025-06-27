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
  protected serviceName = 'contacts';
  
  /**
   * Get single contact by ID - FIXED to avoid recursion
   */
  async get(contactId: string): Promise<Contact> {
    const endpoint = `/api/contacts/${contactId}`;
    
    // Call the parent class's get method using super
    return super.get<Contact>(
      endpoint,
      {
        cache: { priority: 'high', ttl: 10 * 60 * 1000 },
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );
  }

  /**
   * Get contacts from MongoDB (already synced from GHL)
   */
  async list(
    locationId: string,
    options: ContactListOptions = {}
  ): Promise<Contact[]> {
    // Build params object
    const params: any = { locationId };
    
    if (options.limit) params.limit = options.limit;
    if (options.offset) params.offset = options.offset;
    if (options.search) params.search = options.search;
    if (options.includeProjects) params.includeProjects = options.includeProjects;
    
    const endpoint = '/api/contacts/search/lpai';
    
    return super.get<Contact[]>(
      endpoint,
      {
        params, // Pass params in the config object
        cache: { priority: 'high', ttl: 10 * 60 * 1000 }, // 10 min
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );
  }

  /**
   * Get single contact - Alias for get method
   */
  async getDetails(contactId: string): Promise<Contact> {
    return this.get(contactId);
  }

  /**
   * Create contact - Goes to MongoDB then GHL
   */
async create(
  data: CreateContactInput
): Promise<Contact> {
  // Extract locationId and address from data
  const { locationId, address, ...restData } = data;
  
  // Parse address into GHL format if provided
  let addressFields = {};
  if (address) {
    // Simple parsing - you might want to use a proper address parser
    const parts = address.split(',').map(p => p.trim());
    
    if (parts.length >= 3) {
      // Assume format: "street, city, state zip"
      addressFields = {
        address1: parts[0],
        city: parts[1],
        // Split state and zip
        state: parts[2].split(' ')[0],
        postalCode: parts[2].split(' ')[1] || '',
        country: 'US' // Default to US
      };
    } else {
      // If we can't parse it, just put it all in address1
      addressFields = {
        address1: address
      };
    }
  }
  
  // Format data for GHL
  const ghlFormattedData = {
    ...restData,
    ...addressFields,
    name: `${restData.firstName} ${restData.lastName}`, // GHL also wants full name
    // Notes should go in customFields if you want to keep them
  };
  
  // Add locationId as query parameter
  const endpoint = `/api/contacts${locationId ? `?locationId=${locationId}` : ''}`;
  
  const newContact = await super.post<Contact>(
    endpoint,
    ghlFormattedData,
    {
      offline: true,
    },
    {
      endpoint: '/api/contacts',
      method: 'POST',
      entity: 'contact',
      priority: 'high',
    }
  );
  
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
    
    const updated = await super.patch<Contact>(
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
   * Delete contact
   */
  async delete(contactId: string): Promise<void> {
    const endpoint = `/api/contacts/${contactId}`;
    
    await super.delete<void>(
      endpoint,
      {
        offline: true,
      },
      {
        endpoint,
        method: 'DELETE',
        entity: 'contact',
        priority: 'high',
      }
    );

    // Clear caches
    await this.clearCache(`@lpai_cache_GET_/api/contacts/${contactId}`);
    await this.clearCache('@lpai_cache_GET_/api/contacts/search/lpai');
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
    
    return super.get(
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
    // The endpoint expects locationId as a query parameter
    const params = { locationId };
    const endpoint = '/api/contacts/withProjects';
    
    return super.get<Contact[]>(
      endpoint,
      {
        params, // Pass params in the config object
        cache: { priority: 'medium', ttl: 10 * 60 * 1000 }, // 10 min
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
    
    const result = await super.post<any>(
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
    
    const result = await super.post<any>(
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
    
    return super.post<Contact[]>(
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