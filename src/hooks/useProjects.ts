// src/hooks/useProjects.ts
// Create this new file

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../services/projectService';
import { Project } from '../../packages/types/dist';
import { useAuth } from '../contexts/AuthContext';

export const useProjects = (locationId: string, filters?: any) => {
  return useQuery({
    queryKey: ['projects', locationId, filters],
    queryFn: async () => {
      if (!locationId) return [];
      
      // If we have a contactId filter, use the getByContact method
      if (filters?.contactId && projectService.getByContact) {
        return await projectService.getByContact(filters.contactId, locationId);
      }
      
      // Otherwise use the list method with filters
      return await projectService.list(locationId, filters);
    },
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useProject = (projectId: string) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return await projectService.get(projectId);
    },
    enabled: !!projectId,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (projectData: Partial<Project>) => {
      if (!user?.locationId) throw new Error('No location ID');
      
      return await projectService.create({
        ...projectData,
        locationId: user.locationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Project> }) => {
      return await projectService.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return await projectService.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};