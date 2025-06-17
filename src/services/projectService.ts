// services/projectService.ts
// Updated: 2025-06-17

import { BaseService, ServiceOptions } from './baseService';
import { cacheService } from './cacheService';
import api from '../lib/api';
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
  photos?: ProjectPhoto[];
  documents?: ProjectDocument[];
  timeline?: ProjectTimelineEntry[];
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
  protected serviceName = 'projects';
  
  /**
   * List all projects with smart loading
   * BaseService automatically includes locationId from auth context
   */
  async list(
    options: ProjectListOptions = {},
    serviceOptions: ServiceOptions = {}
  ): Promise<Project[]> {
    const { includeRelated = false, ...queryParams } = options;

    // Build params - BaseService adds locationId automatically
    const params: Record<string, any> = {
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

    if (__DEV__) {
      console.log('[ProjectService] Fetching projects with params:', params);
    }

    const projects = await this.get<Project[]>(
      '/api/projects',
      {
        params,
        cache: { priority: 'high', ttl: 5 * 60 * 1000 }, // 5 min cache
        ...serviceOptions,
      }
    );

    // If includeRelated, fetch additional data
    if (includeRelated && projects.length > 0) {
      // Batch fetch related data
      const enrichedProjects = await Promise.all(
        projects.map(async (project) => {
          try {
            const details = await this.getDetails(project._id, {
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
   * BaseService automatically includes locationId
   */
  async getDetails(
    projectId: string,
    options: ProjectDetailsOptions = {},
    serviceOptions: ServiceOptions = {}
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
    const params: Record<string, any> = {};
    if (includeContact) params.includeContact = true;
    if (includeQuotes) params.includeQuotes = true;
    if (includeAppointments) params.includeAppointments = true;

    const project = await this.get<Project>(
      `/api/projects/${projectId}`,
      {
        params,
        cache: { priority: 'high' },
        ...serviceOptions,
      }
    );

    // The backend already returns enhanced data
    return project;
  }

  /**
   * Create new project
   * BaseService automatically includes locationId in the body
   */
  async create(
    data: CreateProjectInput,
    serviceOptions: ServiceOptions = {}
  ): Promise<Project> {
    // Get userId from auth context if not provided
    const authContext = this.getAuthContext();
    const createData = {
      ...data,
      userId: data.userId || authContext.userId,
    };

    const newProject = await this.post<Project>(
      '/api/projects',
      createData,
      {
        offline: true,
        ...serviceOptions,
      }
    );

    // Invalidate project list cache
    await this.clearCache('@lpai_cache_GET_/api/projects');

    return newProject;
  }

  /**
   * Update project
   * BaseService automatically includes locationId
   */
  async update(
    projectId: string,
    data: UpdateProjectInput,
    serviceOptions: ServiceOptions = {}
  ): Promise<Project> {
    const updated = await this.patch<Project>(
      `/api/projects/${projectId}`,
      data,
      {
        offline: true,
        ...serviceOptions,
      }
    );

    // Update cache with new data
    const cacheKey = `@lpai_cache_GET_/api/projects/${projectId}`;
    await cacheService.set(cacheKey, updated, { priority: 'high' });

    // Clear list cache to refresh
    await this.clearCache('@lpai_cache_GET_/api/projects');

    return updated;
  }

  /**
   * Delete project (soft delete)
   * BaseService automatically includes locationId
   */
  async delete(
    projectId: string,
    serviceOptions: ServiceOptions = {}
  ): Promise<void> {
    await super.delete<void>(
      `/api/projects/${projectId}`,
      {
        offline: true,
        ...serviceOptions,
      }
    );

    // Remove from cache
    await this.clearCache(`@lpai_cache_GET_/api/projects/${projectId}`);
    await this.clearCache('@lpai_cache_GET_/api/projects');
  }

  /**
   * Upload photo to project
   */
  async uploadPhoto(
    projectId: string,
    photo: PhotoUploadInput,
    serviceOptions: ServiceOptions = {}
  ): Promise<ProjectPhoto> {
    // Get userId from auth context
    const authContext = this.getAuthContext();
    
    // First, upload to file service (implement later)
    // For now, simulate the upload
    const photoData: ProjectPhoto = {
      id: `photo_${Date.now()}`,
      uri: photo.uri,
      caption: photo.caption,
      timestamp: new Date().toISOString(),
      location: photo.location,
      uploadedBy: authContext.userId,
    };

    // Add to project
    await this.update(
      projectId,
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
    document: DocumentUploadInput,
    serviceOptions: ServiceOptions = {}
  ): Promise<ProjectDocument> {
    const authContext = this.getAuthContext();
    
    const docData: ProjectDocument = {
      id: `doc_${Date.now()}`,
      name: document.name,
      originalName: document.name,
      uri: document.uri,
      type: document.type,
      size: document.size,
      uploadDate: new Date().toISOString(),
      uploadedBy: authContext.userId,
    };

    await this.update(
      projectId,
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
    milestones: Milestone[],
    serviceOptions: ServiceOptions = {}
  ): Promise<void> {
    await this.update(
      projectId,
      { milestones },
      serviceOptions
    );
  }

  /**
   * Add timeline event
   */
  async addTimelineEvent(
    projectId: string,
    event: TimelineEventInput,
    serviceOptions: ServiceOptions = {}
  ): Promise<void> {
    const authContext = this.getAuthContext();
    
    const timelineEntry: ProjectTimelineEntry = {
      id: `timeline_${Date.now()}`,
      event: event.event,
      description: event.description,
      timestamp: new Date().toISOString(),
      userId: authContext.userId || 'system',
      metadata: event.metadata,
    };

    // The backend should append this to timeline array
    await this.update(
      projectId,
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
    serviceOptions: ServiceOptions = {}
  ): Promise<Project[]> {
    return this.get<Project[]>(
      '/api/projects/byContact',
      {
        params: { contactId },
        cache: { priority: 'medium' },
        ...serviceOptions,
      }
    );
  }

  /**
   * Search projects
   */
  async search(
    query: string,
    serviceOptions: ServiceOptions = {}
  ): Promise<Project[]> {
    return this.post<Project[]>(
      '/api/search/projects',
      { query },
      {
        cache: false, // Don't cache search results
        ...serviceOptions,
      }
    );
  }

  /**
   * Batch operations
   */
  async batch(
    operation: BatchOperationInput,
    serviceOptions: ServiceOptions = {}
  ): Promise<any> {
    return this.post<any>(
      '/api/projects/batch',
      operation,
      {
        offline: true,
        ...serviceOptions,
      }
    );
  }

  /**
   * Get project statistics
   */
  async getStats(
    serviceOptions: ServiceOptions = {}
  ): Promise<ProjectStats> {
    return this.get<ProjectStats>(
      '/api/stats/projects',
      {
        cache: { priority: 'medium', ttl: 10 * 60 * 1000 }, // 10 min
        ...serviceOptions,
      }
    );
  }

  /**
   * Duplicate project
   */
  async duplicate(
    projectId: string,
    serviceOptions: ServiceOptions = {}
  ): Promise<Project> {
    const authContext = this.getAuthContext();
    
    // Get original project
    const original = await this.getDetails(projectId);
    
    // Create new project with same data
    const newProject = await this.create({
      ...original,
      title: `${original.title} (Copy)`,
      userId: authContext.userId,
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
    serviceOptions: ServiceOptions = {}
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
    serviceOptions: ServiceOptions = {}
  ): Promise<Project> {
    // TODO: Implement when backend supports templates
    // For now, just create a regular project
    return this.create(data as CreateProjectInput, serviceOptions);
  }
}

// Create singleton instance
export const projectService = new ProjectService();