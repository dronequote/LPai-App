// src/services/noteService.ts
// Created: 2025-01-25
import { BaseService } from './baseService';

export interface Note {
  id: string;
  body: string;
  createdBy: string;
  createdAt: string;
  ghlNoteId?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CreateNoteInput {
  text: string;
  userId?: string;
}

export interface UpdateNoteInput {
  text: string;
}

class NoteService extends BaseService {
  protected serviceName = 'notes';

  /**
   * Get all notes for a contact
   */
  async getContactNotes(contactId: string, locationId: string): Promise<Note[]> {
    const endpoint = `/api/contacts/${contactId}/notes`;
    
    if (__DEV__) {
      console.log('[NoteService] Fetching notes for contact:', contactId);
    }

    try {
      const response = await this.get<any>(
        endpoint,
        { 
          params: { locationId },
          cache: { priority: 'high', ttl: 5 * 60 * 1000 }, // 5 minute cache
        }
      );

      // Handle response format
      if (response?.data?.notes) {
        return response.data.notes;
      } else if (response?.notes) {
        return response.notes;
      } else if (Array.isArray(response)) {
        return response;
      }
      
      return [];
    } catch (error) {
      console.error('[NoteService] Error fetching notes:', error);
      return [];
    }
  }

  /**
   * Create a new note
   */
  async createNote(
    contactId: string,
    locationId: string,
    data: CreateNoteInput
  ): Promise<Note | null> {
    const endpoint = `/api/contacts/${contactId}/notes`;

    if (__DEV__) {
      console.log('[NoteService] Creating note:', data);
    }

    try {
      const response = await this.post<any>(
        endpoint,
        {
          locationId,
          ...data,
        }
      );

      // Handle response format
      if (response?.data?.note) {
        // Clear cache after creating a note
        await this.clearCache(endpoint);
        return response.data.note;
      } else if (response?.note) {
        // Clear cache after creating a note
        await this.clearCache(endpoint);
        return response.note;
      }
      
      return null;
    } catch (error) {
      console.error('[NoteService] Error creating note:', error);
      throw error;
    }
  }

  /**
   * Update an existing note
   */
  async updateNote(
    contactId: string,
    noteId: string,
    locationId: string,
    data: UpdateNoteInput
  ): Promise<Note | null> {
    const endpoint = `/api/contacts/${contactId}/notes/${noteId}`;

    try {
      const response = await this.put<any>(
        endpoint,
        {
          locationId,
          ...data,
        }
      );

      // Handle response format
      if (response?.data?.note) {
        return response.data.note;
      } else if (response?.note) {
        return response.note;
      }
      
      return null;
    } catch (error) {
      console.error('[NoteService] Error updating note:', error);
      throw error;
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(
    contactId: string,
    noteId: string,
    locationId: string
  ): Promise<boolean> {
    const endpoint = `/api/contacts/${contactId}/notes/${noteId}`;

    try {
      await this.delete(
        endpoint,
        {
          data: { locationId },
        }
      );
      // Clear cache after deleting
      await this.clearCache(`/api/contacts/${contactId}/notes`);
      return true;
    } catch (error) {
      console.error('[NoteService] Error deleting note:', error);
      return false;
    }
  }

  /**
   * Clear cache for a contact's notes
   */
  async clearCache(endpoint?: string): Promise<void> {
    if (endpoint) {
      // Clear specific endpoint cache
      const cachePrefix = `@lpai_cache_GET_${endpoint}`;
      await this.clearServiceCache(cachePrefix);
    } else {
      // Clear all notes cache
      await super.clearCache();
    }
  }
}

export const noteService = new NoteService();
export default noteService;