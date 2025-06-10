// services/projectService.ts
import { BaseService, ServiceOptions } from './baseService';
import { 
  Project, 
  Contact, 
  Appointment, 
  Quote,
  Milestone,
  ProjectPhoto,
  ProjectDocument,
  ProjectTimelineEntry 
} from '../../packages/types';

interface ProjectListOptions {
  includeRelated?: boolean;
  status?: string;
  limit?: number;
  offset?: number;
}

interface ProjectDetailsOptions {
  includeContact?: boolean;
  includeQuotes?: boolean;
  includeAppointments?: boolean;
  includePhotos?: boolean;
  includeDocuments?: boolean;
  includeTimeline?: boolean;
}

interface CreateProjectInput {
  title: string;
  contactId: string;
  userId: string;
  locationId: string;
  status?: string;
  notes?: string;
  scopeOfWork?: string;
  products?: string;
  pipelineId?: string;
}

interface UpdateProjectInput {
  title?: string;
  status?: string;
  notes?: string;
  scopeOfWork?: string;
  products?: string;
  milestones?: Milestone[];
  customFields?: Record<string, any>;
  signedDate?: string;
  monetaryValue?: number;
}

interface PhotoUploadInput {
  uri: string;
  caption?: string;
  location?: { lat: number; lng: number };
}

interface DocumentUploadInput {
  uri: string;
  name: string;
  type: string;
  size: number;
}

interface TimelineEventInput {
  event: string;
  description: string;
  metadata?: Record<string, any>;
}

class ProjectService extends BaseService {
  /**
   * List all projects with smart loading
   */
  async list(
    locationId: string,
    options: ProjectListOptions = {},
    serviceOptions?: ServiceOptions
  ): Promise<Project[]> {
    const { includeRelated = false, status, limit = 50, offset = 0 } = options;

    const endpoint = '/api/projects';
    const params: any = { locationId, limit, offset };
    if (status) params.status = status;

    const projects = await this.get<Project[]>(
      endpoint,
      {
        ...serviceOptions,
        cache: { priority: 'high', ttl: 5 * 60 * 1000 }, // 5 min cache
      },
      {
        endpoint,
        method: 'GET',
        entity: 'project',
      }
    );

    // If includeRelated, fetch additional data
    if (includeRelated && projects.length > 0) {
      // Batch fetch related data
      const enrichedProjects = await Promise.all(
        projects.map(async (project) => {
          try {
            const details = await this.getDetails(project._id, locationId, {
              includeContact: true,
              includeQuotes: false, // Don't fetch heavy data in list
            });
            return details;
          } catch {
            return project; // Return basic if detail fetch fails
          }
        })
      );
      return enrichedProjects;
    }

    return projects;
  }

  /**
   * Get project with all details
   */
  async getDetails(
    projectId: string,
    locationId: string,
    options: ProjectDetailsOptions = {},
    serviceOptions?: ServiceOptions
  ): Promise<Project> {
    const {
      includeContact = true,
      includeQuotes = true,
      includeAppointments = true,
      includePhotos = true,
      includeDocuments = true,
      includeTimeline = true,
    } = options;

    // Build query params based on options
    const params = new URLSearchParams({ locationId });
    if (includeContact) params.append('includeContact', 'true');
    if (includeQuotes) params.append('includeQuotes', 'true');
    if (includeAppointments) params.append('includeAppointments', 'true');

    const endpoint = `/api/projects/${projectId}?${params.toString()}`;

    const project = await this.get<Project>(
      endpoint,
      {
        ...serviceOptions,
        cache: { priority: 'high' },
      },
      {
        endpoint,
        method: 'GET',
        entity: 'project',
      }
    );

    // The backend already returns enhanced data, but we can add more if needed
    return project;
  }

  /**
   * Create new project
   */
  async create(
    data: CreateProjectInput,
    serviceOptions?: ServiceOptions
  ): Promise<Project> {
    const endpoint = '/api/projects';

    const newProject = await this.post<Project>(
      endpoint,
      data,
      {
        ...serviceOptions,
        offline: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'project',
        priority: 'high',
      }
    );

    // Invalidate project list cache
    await this.clearCache(`@lpai_cache_GET_/api/projects_`);

    return newProject;
  }

  /**
   * Update project
   */
  async update(
    projectId: string,
    locationId: string,
    data: UpdateProjectInput,
    serviceOptions?: ServiceOptions
  ): Promise<Project> {
    const endpoint = `/api/projects/${projectId}?locationId=${locationId}`;

    const updated = await this.patch<Project>(
      endpoint,
      data,
      {
        ...serviceOptions,
        offline: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'project',
        priority: 'high',
      }
    );

    // Update cache with new data
    const cacheKey = `@lpai_cache_GET_/api/projects/${projectId}`;
    await this.cacheService.set(cacheKey, updated, { priority: 'high' });

    return updated;
  }

  /**
   * Delete project (soft delete)
   */
  async delete(
    projectId: string,
    locationId: string,
    serviceOptions?: ServiceOptions
  ): Promise<void> {
    const endpoint = `/api/projects/${projectId}?locationId=${locationId}`;

    await this.delete<void>(
      endpoint,
      {
        ...serviceOptions,
        offline: true,
      },
      {
        endpoint,
        method: 'DELETE',
        entity: 'project',
        priority: 'medium',
      }
    );

    // Remove from cache
    await this.clearCache(`@lpai_cache_GET_/api/projects/${projectId}`);
    await this.clearCache(`@lpai_cache_GET_/api/projects_`);
  }

  /**
   * Upload photo to project
   */
  async uploadPhoto(
    projectId: string,
    locationId: string,
    photo: PhotoUploadInput,
    serviceOptions?: ServiceOptions
  ): Promise<ProjectPhoto> {
    // First, upload to file service (implement later)
    // For now, simulate the upload
    const photoData: ProjectPhoto = {
      id: `photo_${Date.now()}`,
      uri: photo.uri,
      caption: photo.caption,
      timestamp: new Date().toISOString(),
      location: photo.location,
      uploadedBy: this.userId,
    };

    // Add to project
    await this.update(
      projectId,
      locationId,
      {
        photos: [photoData], // Backend should append, not replace
      },
      serviceOptions
    );

    return photoData;
  }

  /**
   * Upload document to project
   */
  async uploadDocument(
    projectId: string,
    locationId: string,
    document: DocumentUploadInput,
    serviceOptions?: ServiceOptions
  ): Promise<ProjectDocument> {
    const docData: ProjectDocument = {
      id: `doc_${Date.now()}`,
      name: document.name,
      originalName: document.name,
      uri: document.uri,
      type: document.type,
      size: document.size,
      uploadDate: new Date().toISOString(),
      uploadedBy: this.userId,
    };

    await this.update(
      projectId,
      locationId,
      {
        documents: [docData], // Backend should append
      },
      serviceOptions
    );

    return docData;
  }

  /**
   * Update milestones
   */
  async updateMilestones(
    projectId: string,
    locationId: string,
    milestones: Milestone[],
    serviceOptions?: ServiceOptions
  ): Promise<void> {
    await this.update(
      projectId,
      locationId,
      { milestones },
      serviceOptions
    );
  }

  /**
   * Add timeline event
   */
  async addTimelineEvent(
    projectId: string,
    locationId: string,
    event: TimelineEventInput,
    serviceOptions?: ServiceOptions
  ): Promise<void> {
    const timelineEntry: ProjectTimelineEntry = {
      id: `timeline_${Date.now()}`,
      event: event.event,
      description: event.description,
      timestamp: new Date().toISOString(),
      userId: this.userId || 'system',
      metadata: event.metadata,
    };

    // The backend should append this to timeline array
    await this.update(
      projectId,
      locationId,
      {
        timeline: [timelineEntry], // Backend appends
      },
      serviceOptions
    );
  }

  /**
   * Get projects by contact
   */
  async getByContact(
    contactId: string,
    locationId: string,
    serviceOptions?: ServiceOptions
  ): Promise<Project[]> {
    const endpoint = `/api/projects/byContact?contactId=${contactId}&locationId=${locationId}`;

    return this.get<Project[]>(
      endpoint,
      {
        ...serviceOptions,
        cache: { priority: 'medium' },
      },
      {
        endpoint,
        method: 'GET',
        entity: 'project',
      }
    );
  }

  /**
   * Search projects
   */
  async search(
    locationId: string,
    query: string,
    serviceOptions?: ServiceOptions
  ): Promise<Project[]> {
    // For now, fetch all and filter client-side
    // TODO: Add backend search endpoint
    const allProjects = await this.list(locationId, { limit: 1000 }, serviceOptions);
    
    const searchLower = query.toLowerCase();
    return allProjects.filter(project => 
      project.title.toLowerCase().includes(searchLower) ||
      project.contactName?.toLowerCase().includes(searchLower) ||
      project.notes?.toLowerCase().includes(searchLower)
    );
  }

  /**
   * Get project statistics
   */
  async getStats(
    locationId: string,
    serviceOptions?: ServiceOptions
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    thisMonth: number;
    thisWeek: number;
  }> {
    const projects = await this.list(locationId, {}, serviceOptions);
    
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      total: projects.length,
      byStatus: {} as Record<string, number>,
      thisMonth: 0,
      thisWeek: 0,
    };

    projects.forEach(project => {
      // Count by status
      stats.byStatus[project.status] = (stats.byStatus[project.status] || 0) + 1;
      
      // Count recent
      const createdAt = new Date(project.createdAt);
      if (createdAt > monthAgo) stats.thisMonth++;
      if (createdAt > weekAgo) stats.thisWeek++;
    });

    return stats;
  }

  /**
   * Sync projects from GHL
   */
  async syncFromGHL(
    locationId: string,
    serviceOptions?: ServiceOptions
  ): Promise<{ synced: number; errors: number }> {
    const endpoint = '/api/sync/opportunities';

    const result = await this.post<any>(
      endpoint,
      { locationId, fullSync: true },
      {
        ...serviceOptions,
        showError: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'project',
        priority: 'low',
      }
    );

    // Clear cache after sync
    await this.clearCache('@lpai_cache_GET_/api/projects');

    return {
      synced: result.created + result.updated,
      errors: result.errors || 0,
    };
  }
}

// Export singleton instance
export const projectService = new ProjectService();