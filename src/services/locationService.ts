// services/locationService.ts
import { BaseService } from './baseService';
import { Location, Pipeline, Calendar, Tag, User } from '../../packages/types';

interface LocationUpdateInput {
  termsAndConditions?: string;
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    companyName?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
  };
  emailTemplates?: {
    contractSigned?: string;
    quoteSent?: string;
    invoiceSent?: string;
  };
  companyInfo?: {
    establishedYear?: string;
    warrantyYears?: string;
    licenseNumber?: string;
    insuranceInfo?: string;
  };
}

interface SetupLocationOptions {
  fullSync?: boolean;
}

interface SyncResult {
  success: boolean;
  synced?: number;
  errors?: number;
  message?: string;
}

class LocationService extends BaseService {
  protected serviceName = 'locations';
  /**
   * Get location details with all settings
   */
  async getDetails(
    locationId: string
  ): Promise<{
    _id: string;
    locationId: string;
    name: string;
    branding?: any;
    pipelines: Pipeline[];
    calendars: Calendar[];
    termsAndConditions: string;
    emailTemplates: Record<string, string | null>;
    companyInfo?: any;
  }> {
    const endpoint = `/api/locations/byLocation?locationId=${locationId}`;
    
    return this.get(
      endpoint,
      {
        cache: { priority: 'high', ttl: 60 * 60 * 1000 }, // 1 hour cache
      },
      {
        endpoint,
        method: 'GET',
        entity: 'project', // Using project as generic entity
      }
    );
  }

  /**
   * Update location settings
   */
  async update(
    locationId: string,
    data: LocationUpdateInput
  ): Promise<{ success: boolean }> {
    const endpoint = `/api/locations/byLocation?locationId=${locationId}`;
    
    const result = await this.patch<any>(
      endpoint,
      data,
      {
        offline: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'project',
        priority: 'medium',
      }
    );
    
    // Clear location cache
    await this.clearCache(`@lpai_cache_GET_/api/locations/byLocation`);
    
    return result;
  }

  /**
   * Get pipelines (from cache or sync)
   */
  async getPipelines(
    locationId: string,
    forceSync = false
  ): Promise<Pipeline[]> {
    if (forceSync) {
      await this.syncPipelines(locationId);
    }
    
    const location = await this.getDetails(locationId);
    return location.pipelines || [];
  }

  /**
   * Get calendars (from cache or sync)
   */
  async getCalendars(
    locationId: string,
    forceSync = false
  ): Promise<Calendar[]> {
    if (forceSync) {
      await this.syncCalendars(locationId);
    }
    
    const location = await this.getDetails(locationId);
    return location.calendars || [];
  }

  /**
   * Sync pipelines from GHL
   */
  async syncPipelines(
    locationId: string
  ): Promise<SyncResult> {
    const endpoint = `/api/ghl/pipelines/${locationId}`;
    
    try {
      const result = await this.get<any>(
        endpoint,
        {
          cache: false, // Don't cache sync results
          showError: false,
        },
        {
          endpoint,
          method: 'GET',
          entity: 'project',
        }
      );
      
      // Clear location cache after sync
      await this.clearCache(`@lpai_cache_GET_/api/locations/byLocation`);
      
      return {
        success: result.success,
        synced: result.pipelines?.length || 0,
        message: result.updated ? 'Pipelines updated' : 'Pipelines already up to date',
      };
    } catch (error) {
      return {
        success: false,
        errors: 1,
        message: 'Failed to sync pipelines',
      };
    }
  }

  /**
   * Sync calendars from GHL
   */
  async syncCalendars(
    locationId: string
  ): Promise<SyncResult> {
    const endpoint = `/api/ghl/calendars/${locationId}`;
    
    try {
      const result = await this.get<any>(
        endpoint,
        {
          cache: false,
          showError: false,
        },
        {
          endpoint,
          method: 'GET',
          entity: 'appointment',
        }
      );
      
      // Clear location cache after sync
      await this.clearCache(`@lpai_cache_GET_/api/locations/byLocation`);
      
      return {
        success: result.success,
        synced: result.calendars?.length || 0,
        message: result.updated ? 'Calendars updated' : 'Calendars already up to date',
      };
    } catch (error) {
      return {
        success: false,
        errors: 1,
        message: 'Failed to sync calendars',
      };
    }
  }

  /**
   * Update terms and conditions
   */
  async updateTerms(
    locationId: string,
    termsAndConditions: string
  ): Promise<{ success: boolean }> {
    return this.update(locationId, { termsAndConditions });
  }

  /**
   * Update branding
   */
  async updateBranding(
    locationId: string,
    branding: LocationUpdateInput['branding']
  ): Promise<{ success: boolean }> {
    return this.update(locationId, { branding });
  }

  /**
   * Update email templates
   */
  async updateEmailTemplates(
    locationId: string,
    templates: LocationUpdateInput['emailTemplates']
  ): Promise<{ success: boolean }> {
    return this.update(locationId, { emailTemplates: templates });
  }

  /**
   * Run full location setup (for new installs)
   */
  async setupLocation(
    locationId: string,
    options: SetupLocationOptions = {}
  ): Promise<{
    success: boolean;
    message: string;
    results?: any;
  }> {
    const endpoint = '/api/locations/setup-location';
    
    const result = await this.post<any>(
      endpoint,
      {
        locationId,
        fullSync: options.fullSync ?? true,
      },
      {
        offline: false, // Setup needs to be online
        showError: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'project',
        priority: 'high',
      }
    );
    
    // Clear all caches after setup
    await this.clearCache('@lpai_cache_');
    
    return result;
  }

  /**
   * Check setup progress
   */
  async checkSetupProgress(
    locationId: string
  ): Promise<any> {
    const endpoint = `/api/sync/progress/${locationId}`;
    
    return this.get(
      endpoint,
      {
        cache: false, // Always get fresh progress
      },
      {
        endpoint,
        method: 'GET',
        entity: 'project',
      }
    );
  }

  /**
   * Sync location details from GHL
   */
  async syncLocationDetails(
    locationId: string
  ): Promise<SyncResult> {
    const endpoint = '/api/sync/location-details';
    
    const result = await this.post<any>(
      endpoint,
      { locationId },
      {
        offline: false,
        showError: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'project',
        priority: 'low',
      }
    );
    
    // Clear location cache
    await this.clearCache(`@lpai_cache_GET_/api/locations/byLocation`);
    
    return {
      success: result.success ?? true,
      message: 'Location details synced',
    };
  }

  /**
   * Sync custom fields
   */
  async syncCustomFields(
    locationId: string
  ): Promise<SyncResult> {
    const endpoint = '/api/sync/custom-fields';
    
    const result = await this.post<any>(
      endpoint,
      { locationId },
      {
        offline: false,
        showError: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'project',
        priority: 'low',
      }
    );
    
    return {
      success: result.success ?? true,
      synced: result.result?.totalFields || 0,
      message: 'Custom fields synced',
    };
  }

  /**
   * Sync custom values
   */
  async syncCustomValues(
    locationId: string
  ): Promise<SyncResult> {
    const endpoint = '/api/sync/custom-values';
    
    const result = await this.post<any>(
      endpoint,
      { locationId },
      {
        offline: false,
        showError: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'project',
        priority: 'low',
      }
    );
    
    return {
      success: result.success ?? true,
      synced: result.count || 0,
      message: 'Custom values synced',
    };
  }

  /**
   * Sync users from GHL
   */
  async syncUsers(
    locationId: string
  ): Promise<SyncResult> {
    const endpoint = '/api/sync/users';
    
    const result = await this.post<any>(
      endpoint,
      { locationId },
      {
        offline: false,
        showError: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'project',
        priority: 'low',
      }
    );
    
    return {
      success: result.success ?? true,
      synced: result.result?.total || 0,
      message: 'Users synced',
    };
  }

  /**
   * Get location statistics
   */
  async getStats(
    locationId: string
  ): Promise<{
    userCount: number;
    contactCount: number;
    projectCount: number;
    appointmentCount: number;
    quoteCount: number;
    setupCompleted: boolean;
    lastSyncDate?: string;
  }> {
    // This would need backend implementation
    // For now, return from location data
    const location = await this.getDetails(locationId);
    
    return {
      userCount: 0,
      contactCount: 0,
      projectCount: 0,
      appointmentCount: 0,
      quoteCount: 0,
      setupCompleted: true,
      lastSyncDate: new Date().toISOString(),
    };
  }
}

export const locationService = new LocationService();