// services/projectService.ts
// Updated: 2025-06-16

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
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  contactId?: string;
  hasQuote?: boolean;
  startDate?: string;
  endDate?: string;
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
  pipelineStageId?: string;
  monetaryValue?: number;
  customFields?: Record<string, any>;
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
  pipelineId?: string;
  pipelineStageId?: string;
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

interface BatchOperationInput {
  action: 'update' | 'delete' | 'tag';
  projectIds: string[];
  data?: any;
}

interface ProjectStats {
  total: number;
  byStatus: Record<string, number>;
  byPipeline: Record<string, number>;
  totalValue: number;
  averageValue: number;
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
    const { includeRelated = false, ...queryParams } = options;

    // Build query string manually to ensure proper encoding
    const params: Record<string, any> = {
      locationId,
      limit: queryParams.limit || 50,
      offset: queryParams.offset || 0,
    };
    
    // Add optional parameters
    if (queryParams.status) params.status = queryParams.status;
    if (queryParams.sortBy) params.sortBy = queryParams.sortBy;
    if (queryParams.sortOrder) params.sortOrder = queryParams.sortOrder;
    if (queryParams.search) params.search = queryParams.search;
    if (queryParams.pipelineId) params.pipelineId = queryParams.pipelineId;
    if (queryParams.pipelineStageId) params.pipelineStageId = queryParams.pipelineStageId;
    if (queryParams.contactId) params.contactId = queryParams.contactId;
    if (queryParams.hasQuote !== undefined) params.hasQuote = queryParams.hasQuote;
    if (queryParams.startDate) params.startDate = queryParams.startDate;
    if (queryParams.endDate) params.endDate = queryParams.endDate;

    // Build query string manually
    const queryString = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
      
    const endpoint = `/api/projects?${queryString}`;

    if (__DEV__) {
      console.log('[ProjectService] Fetching projects with URL:', endpoint);
    }

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
    await this.clearCache(`@lpai_cache_GET_/api/projects`);

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

    // Clear list cache to refresh
    await this.clearCache(`@lpai_cache_GET_/api/projects`);

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
    await this.clearCache(`@lpai_cache_GET_/api/projects`);
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
    const endpoint = '/api/search/projects';
    
    return this.post<Project[]>(
      endpoint,
      { locationId, query },
      {
        ...serviceOptions,
        cache: false, // Don't cache search results
      },
      {
        endpoint,
        method: 'POST',
        entity: 'project',
      }
    );
  }

  /**
   * Batch operations
   */
  async batch(
    locationId: string,
    operation: BatchOperationInput,
    serviceOptions?: ServiceOptions
  ): Promise<any> {
    const endpoint = '/api/projects/batch';
    
    return this.post<any>(
      endpoint,
      {
        locationId,
        ...operation,
      },
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
  }

  /**
   * Get project statistics
   */
  async getStats(
    locationId: string,
    serviceOptions?: ServiceOptions
  ): Promise<ProjectStats> {
    const endpoint = `/api/stats/projects?locationId=${locationId}`;

    return this.get<ProjectStats>(
      endpoint,
      {
        ...serviceOptions,
        cache: { priority: 'medium', ttl: 10 * 60 * 1000 }, // 10 min
      },
      {
        endpoint,
        method: 'GET',
        entity: 'project',
      }
    );
  }

  /**
   * Duplicate project
   */
  async duplicate(
    projectId: string,
    locationId: string,
    serviceOptions?: ServiceOptions
  ): Promise<Project> {
    // Get original project
    const original = await this.getDetails(projectId, locationId);
    
    // Create new project with same data
    const newProject = await this.create({
      ...original,
      title: `${original.title} (Copy)`,
      locationId,
      userId: this.userId!,
      contactId: original.contactId,
      // Reset some fields
      status: 'open',
      signedDate: undefined,
      // Keep custom fields and other data
      customFields: original.customFields,
    }, serviceOptions);

    return newProject;
  }

  /**
   * Get project templates
   */
  async getTemplates(
    locationId: string,
    serviceOptions?: ServiceOptions
  ): Promise<any[]> {
    // TODO: Implement when backend supports templates
    return [];
  }

  /**
   * Create project from template
   */
  async createFromTemplate(
    templateId: string,
    data: Partial<CreateProjectInput>,
    serviceOptions?: ServiceOptions
  ): Promise<Project> {
    // TODO: Implement when backend supports templates
    // For now, just create a regular project
    return this.create(data as CreateProjectInput, serviceOptions);
  }
}

// Create singleton instance
export const projectService = new ProjectService();