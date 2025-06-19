// src/hooks/useContacts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactService } from '../services/contactService';
import { Contact } from '../../packages/types/dist';
import { useAuth } from '../contexts/AuthContext';

export const useContacts = (filters?: any) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['contacts', user?.locationId, filters],
    queryFn: async () => {
      if (!user?.locationId) return [];
      
      // Use getWithProjects if available, otherwise use list with includeProjects
      if (contactService.getWithProjects) {
        return await contactService.getWithProjects(user.locationId);
      }
      return await contactService.list(user.locationId, { 
        includeProjects: true,
        ...filters 
      });
    },
    enabled: !!user?.locationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useContact = (contactId: string, initialData?: Contact) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      
      try {
        // Try the single contact endpoint first
        if (contactService.get) {
          return await contactService.get(contactId);
        }
        
        // If get method doesn't exist, fall back to finding in list
        if (user?.locationId) {
          if (__DEV__) {
            console.log('Contact get method not found, falling back to list search');
          }
          const contacts = await contactService.list(user.locationId, { 
            includeProjects: true,
            limit: 1000 
          });
          const contact = Array.isArray(contacts) 
            ? contacts.find(c => c._id === contactId) 
            : null;
          
          if (!contact) {
            throw new Error('Contact not found');
          }
          
          return contact;
        }
        
        return null;
      } catch (error: any) {
        // If it's a 404 or method not allowed, try the fallback
        if (error.response?.status === 404 || error.response?.status === 405) {
          if (user?.locationId) {
            if (__DEV__) {
              console.log('Contact endpoint returned 404/405, using list fallback');
            }
            const contacts = await contactService.list(user.locationId, { 
              includeProjects: true,
              limit: 1000 
            });
            const contact = Array.isArray(contacts) 
              ? contacts.find(c => c._id === contactId) 
              : null;
            return contact || null;
          }
        }
        
        // If it's a real error, log it but don't throw
        if (__DEV__) {
          console.error('Error fetching contact:', error);
        }
        
        // Return null to use initialData
        return null;
      }
    },
    enabled: !!contactId && !!user?.locationId,
    initialData: initialData,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateContact = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (contactData: Partial<Contact>) => {
      if (!user?.locationId) throw new Error('No location ID');
      
      return await contactService.create({
        ...contactData,
        locationId: user.locationId,
      });
    },
    onSuccess: (newContact) => {
      // Invalidate and refetch contacts list
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      
      // Also set the individual contact in cache
      queryClient.setQueryData(['contact', newContact._id], newContact);
    },
  });
};

export const useUpdateContact = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Contact> }) => {
      return await contactService.update(id, data);
    },
    onSuccess: (updatedContact, variables) => {
      // Update the individual contact in cache
      queryClient.setQueryData(['contact', variables.id], updatedContact);
      
      // Invalidate contacts list to refetch
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
};

export const useDeleteContact = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return await contactService.delete(id);
    },
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['contact', deletedId] });
      
      // Invalidate contacts list
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
};