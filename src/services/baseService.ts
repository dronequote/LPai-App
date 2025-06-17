// src/services/baseService.ts
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import api from '../lib/api';
import { cacheService, CacheConfig } from './cacheService';
import { syncQueueService } from './syncQueueService';
import { Alert } from 'react-native';

interface ServiceOptions {
  cache?: boolean | CacheConfig;
  offline?: boolean;
  showError?: boolean;
  locationId?: string;
  userId?: string;
}

interface OfflineConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  entity: 'project' | 'contact' | 'appointment' | 'quote' | 'payment' | 'sms';
  priority?: 'high' | 'medium' | 'low';
}

// Standard API response format from your backend
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export class BaseService {
  protected locationId?: string;
  protected userId?: string;
  protected cacheService = cacheService;

  constructor(context?: { locationId?: string; userId?: string }) {
    this.locationId = context?.locationId;
    this.userId = context?.userId;
  }

  /**
   * Make API request with caching and offline support
   */
  protected async request<T>(
    config: AxiosRequestConfig,
    options: ServiceOptions = {},
    offlineConfig?: OfflineConfig
  ): Promise<T> {
    const {
      cache = false,
      offline = true,
      showError = true,
      locationId = this.locationId,
      userId = this.userId,
    } = options;

    // Build cache key if caching is enabled
    const cacheKey = cache ? this.buildCacheKey(config) : null;

    // Try to get from cache first
    if (cacheKey && config.method === 'GET') {
      const cached = await cacheService.get<T>(cacheKey);
      if (cached) {
        if (__DEV__) {
          console.log(`📦 Cache hit: ${config.url}`);
        }
        return cached;
      }
    }

    try {
      // Log the request for debugging
      if (__DEV__) {
        console.log(`[BaseService] ${config.method} ${config.url}`, config.params);
      }

      // Make the API request
      const response: AxiosResponse<ApiResponse<T>> = await api.request(config);

      // Extract data from standard response format
      let responseData: T;
      
      // Check if response has our standard format
      if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
        // Standard format: { success: true, data: T }
        if (!response.data.success) {
          throw new Error(response.data.error || 'Request failed');
        }
        responseData = response.data.data;
      } else {
        // Non-standard format, use as-is
        responseData = response.data as unknown as T;
      }

      // Cache successful GET requests with extracted data
      if (cacheKey && config.method === 'GET' && responseData) {
        const cacheConfig = typeof cache === 'object' ? cache : undefined;
        await cacheService.set(cacheKey, responseData, cacheConfig);
      }

      return responseData;
    } catch (error) {
      // Handle offline scenario
      if (this.isNetworkError(error) && offline && offlineConfig) {
        return this.handleOfflineRequest<T>(
          config,
          offlineConfig,
          cacheKey,
          locationId,
          userId
        );
      }

      // Handle other errors
      this.handleError(error as AxiosError, showError);
      throw error;
    }
  }

  /**
   * GET request with caching
   */
  protected async get<T>(
    endpoint: string,
    config?: {
      params?: any;
      cache?: boolean | CacheConfig;
      offline?: boolean;
      showError?: boolean;
      locationId?: string;
      userId?: string;
    },
    offlineConfig?: OfflineConfig
  ): Promise<T> {
    const { params, ...options } = config || {};
    
    return this.request<T>(
      {
        method: 'GET',
        url: endpoint,
        params: params,
      },
      options,
      offlineConfig
    );
  }

  /**
   * POST request
   */
  protected async post<T>(
    endpoint: string,
    data: any,
    options: ServiceOptions = {},
    offlineConfig?: OfflineConfig
  ): Promise<T> {
    // Add locationId to data if available and not already present
    if (options.locationId && !data.locationId) {
      data.locationId = options.locationId;
    }

    return this.request<T>(
      {
        method: 'POST',
        url: endpoint,
        data,
      },
      options,
      offlineConfig
    );
  }

  /**
   * PATCH request
   */
  protected async patch<T>(
    endpoint: string,
    data: any,
    options: ServiceOptions = {},
    offlineConfig?: OfflineConfig
  ): Promise<T> {
    return this.request<T>(
      {
        method: 'PATCH',
        url: endpoint,
        data,
      },
      options,
      offlineConfig
    );
  }

  /**
   * PUT request
   */
  protected async put<T>(
    endpoint: string,
    data: any,
    options: ServiceOptions = {},
    offlineConfig?: OfflineConfig
  ): Promise<T> {
    return this.request<T>(
      {
        method: 'PUT',
        url: endpoint,
        data,
      },
      options,
      offlineConfig
    );
  }

  /**
   * DELETE request
   */
  protected async delete<T>(
    endpoint: string,
    options: ServiceOptions = {},
    offlineConfig?: OfflineConfig
  ): Promise<T> {
    return this.request<T>(
      {
        method: 'DELETE',
        url: endpoint,
      },
      options,
      offlineConfig
    );
  }

  /**
   * Handle offline requests
   */
  private async handleOfflineRequest<T>(
    config: AxiosRequestConfig,
    offlineConfig: OfflineConfig,
    cacheKey: string | null,
    locationId?: string,
    userId?: string
  ): Promise<T> {
    if (__DEV__) {
      console.log(`📴 Offline: Queueing ${config.method} ${config.url}`);
    }

    // For GET requests, try to return cached data
    if (config.method === 'GET' && cacheKey) {
      const cached = await cacheService.getExpired<T>(cacheKey);
      if (cached) {
        if (__DEV__) {
          console.log(`📦 Using expired cache for offline mode`);
        }
        return cached;
      }
    }

    // Queue the action for later sync
    await syncQueueService.addToQueue({
      action: config.method === 'POST' ? 'create' : 
              config.method === 'DELETE' ? 'delete' : 'update',
      entity: offlineConfig.entity,
      endpoint: config.url!,
      method: offlineConfig.method,
      data: config.data,
      params: config.params,
      priority: offlineConfig.priority || 'medium',
      locationId,
      userId,
    });

    // For mutations, return optimistic response
    if (config.method !== 'GET') {
      // Create optimistic response
      const optimisticResponse = {
        ...config.data,
        _id: `temp_${Date.now()}`,
        __optimistic: true,
        __pendingSync: true,
      } as T;

      // Cache optimistic response
      if (cacheKey) {
        await cacheService.set(cacheKey, optimisticResponse, {
          priority: 'high',
          ttl: 24 * 60 * 60 * 1000, // 24 hours
        });
      }

      return optimisticResponse;
    }

    // No data available
    throw new Error('No data available offline');
  }

  /**
   * Build cache key from request config
   */
  private buildCacheKey(config: AxiosRequestConfig): string {
    const method = config.method || 'GET';
    const url = config.url || '';
    const params = config.params ? JSON.stringify(config.params) : '';
    
    return `@lpai_cache_${method}_${url}_${params}`;
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    if (!error.response && error.code === 'NETWORK_ERROR') {
      return true;
    }
    
    if (error.message === 'Network Error') {
      return true;
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    return false;
  }

  /**
   * Handle API errors
   */
  private handleError(error: AxiosError<ApiResponse<any>>, showError: boolean): void {
    if (__DEV__) {
      console.error('❌ API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    if (!showError) return;

    let message = 'An error occurred';
    
    if (error.response) {
      // Server responded with error
      const data = error.response.data;
      message = data?.error || data?.message || `Error: ${error.response.status}`;
      
      // Handle specific status codes
      switch (error.response.status) {
        case 401:
          message = 'Session expired. Please login again.';
          // TODO: Trigger logout
          break;
        case 403:
          message = 'You do not have permission to perform this action.';
          break;
        case 404:
          message = 'The requested resource was not found.';
          break;
        case 422:
          // Extract validation details if available
          if (data?.details) {
            const details = Object.values(data.details).join(', ');
            message = `Validation failed: ${details}`;
          } else {
            message = 'Please check your input and try again.';
          }
          break;
        case 500:
          message = 'Server error. Please try again later.';
          break;
      }
    } else if (error.request) {
      // No response received
      message = 'Unable to connect to server. Please check your connection.';
    }

    Alert.alert('Error', message);
  }

  /**
   * Batch multiple requests
   */
  protected async batch<T>(
    requests: Array<() => Promise<T>>
  ): Promise<PromiseSettledResult<T>[]> {
    return Promise.allSettled(requests.map(fn => fn()));
  }

  /**
   * Clear cache for this service
   */
  protected async clearCache(prefix?: string): Promise<void> {
    const cachePrefix = prefix || '@lpai_cache_';
    await cacheService.clear(cachePrefix);
  }

  /**
   * Get cache stats
   */
  protected async getCacheStats() {
    return cacheService.getCacheStats();
  }

  /**
   * Force sync queued actions
   */
  protected async forceSync(): Promise<void> {
    await syncQueueService.syncNow();
  }
}

// Export types
export type { ServiceOptions, OfflineConfig, ApiResponse };