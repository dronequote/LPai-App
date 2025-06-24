// src/services/baseService.ts
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import api from '../lib/api';
import { cacheService, CacheConfig } from './cacheService';
import { syncQueueService } from './syncQueueService';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ServiceOptions {
  cache?: boolean | CacheConfig;
  offline?: boolean;
  showError?: boolean;
  requireAuth?: boolean; // Default true
  clearRelatedCache?: string[];
  retryCount?: number;
  timeout?: number;
}

interface OfflineConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  entity: 'project' | 'contact' | 'appointment' | 'quote' | 'payment' | 'sms';
  priority?: 'high' | 'medium' | 'low';
}

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

// Related entity mapping for automatic cache clearing
const RELATED_ENTITIES = {
  project: ['contact', 'appointment', 'quote', 'dashboard'],
  contact: ['project', 'appointment', 'quote', 'dashboard'],
  appointment: ['contact', 'project', 'calendar', 'dashboard'],
  quote: ['project', 'contact', 'dashboard'],
  payment: ['quote', 'project', 'dashboard'],
  location: ['calendar', 'user', 'dashboard'],
  sms: ['contact', 'conversation'],
};

// Service registry for dependency injection
const serviceRegistry = new Map<string, BaseService>();

export abstract class BaseService {
  protected abstract serviceName: string;
  private static authContext: { user?: any; token?: string } | null = null;
  private retryQueue = new Map<string, Promise<any>>();

  constructor() {
    // Register service instance
    serviceRegistry.set(this.constructor.name, this);
  }

  /**
   * Set auth context (called from AuthContext)
   */
  static setAuthContext(context: { user?: any; token?: string } | null) {
    BaseService.authContext = context;
    
    // Update API default headers
    if (context?.token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${context.token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }

  /**
   * Get current auth context with validation
   */
  protected getAuthContext(requireAuth: boolean = true) {
    const context = BaseService.authContext;
    
    if (requireAuth && (!context?.user?.locationId || !context?.token)) {
      throw new Error('Authentication required. Please login again.');
    }
    
    return {
      locationId: context?.user?.locationId,
      userId: context?.user?._id || context?.user?.id,
      token: context?.token,
      user: context?.user,
    };
  }

  /**
   * Make API request with all features
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
      requireAuth = true,
      clearRelatedCache = [],
      retryCount = 3,
      timeout = 30000,
    } = options;

    // Get auth context if required
    let authData: any = {};
    try {
      authData = this.getAuthContext(requireAuth);
    } catch (error) {
      if (requireAuth) {
        this.handleError(error as Error, showError);
        throw error;
      }
    }

    // Add locationId to params if not present
    if (authData.locationId && config.method === 'GET') {
      config.params = {
        ...config.params,
        locationId: config.params?.locationId || authData.locationId,
      };
    }

    // Add locationId to body for mutations if not present
    if (authData.locationId && config.method !== 'GET' && config.data) {
      config.data = {
        ...config.data,
        locationId: config.data.locationId || authData.locationId,
      };
    }

    // Set timeout
    config.timeout = timeout;

    // Build cache key
    const cacheKey = cache ? this.buildCacheKey(config) : null;
    
    // Check for existing retry promise
    const retryKey = `${config.method}_${config.url}_${JSON.stringify(config.params || {})}`;
    if (this.retryQueue.has(retryKey)) {
      return this.retryQueue.get(retryKey);
    }

    // Try cache first for GET requests
    if (cacheKey && config.method === 'GET') {
      const cached = await cacheService.get<T>(cacheKey);
      if (cached) {
        if (__DEV__) {
          console.log(`📦 [${this.serviceName}] Cache hit:`, config.url);
        }
        return cached;
      }
    }

    // Make request with retry logic
    const requestPromise = this.executeRequestWithRetry<T>(
      config,
      cacheKey,
      offlineConfig,
      authData,
      showError,
      retryCount,
      options // Pass the full options object
    );

    // Store in retry queue
    this.retryQueue.set(retryKey, requestPromise);

    try {
      const result = await requestPromise;
      
      // Clear related caches after mutations
      if (config.method !== 'GET' && offlineConfig) {
        await this.clearRelatedCaches(offlineConfig.entity, clearRelatedCache);
      }
      
      return result;
    } finally {
      // Clean up retry queue
      this.retryQueue.delete(retryKey);
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeRequestWithRetry<T>(
    config: AxiosRequestConfig,
    cacheKey: string | null,
    offlineConfig: OfflineConfig | undefined,
    authData: any,
    showError: boolean,
    maxRetries: number,
    options: ServiceOptions, // Add options parameter
    currentRetry = 0
  ): Promise<T> {
    try {
      if (__DEV__) {
        console.log(`🌐 [${this.serviceName}] ${config.method} ${config.url}`, {
          params: config.params,
          retry: currentRetry > 0 ? currentRetry : undefined,
        });
      }

      const response: AxiosResponse<ApiResponse<T>> = await api.request(config);
      
      // Extract data
      let responseData: T;
      if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
        if (!response.data.success) {
          throw new Error(response.data.error || 'Request failed');
        }
        responseData = response.data.data;
      } else {
        responseData = response.data as unknown as T;
      }

      // Cache successful GET requests
      if (cacheKey && config.method === 'GET' && responseData) {
        const cacheConfig = typeof options.cache === 'object' ? options.cache : undefined;
        await cacheService.set(cacheKey, responseData, cacheConfig);
      }

      return responseData;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // Check if we should retry
      if (
        currentRetry < maxRetries &&
        this.shouldRetry(axiosError) &&
        !this.isNetworkError(axiosError)
      ) {
        if (__DEV__) {
          console.log(`🔄 [${this.serviceName}] Retrying request (${currentRetry + 1}/${maxRetries})`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, currentRetry) * 1000));
        
        return this.executeRequestWithRetry(
          config,
          cacheKey,
          offlineConfig,
          authData,
          showError,
          maxRetries,
          options, // Pass options through
          currentRetry + 1
        );
      }

      // Handle offline scenario
      if (this.isNetworkError(axiosError) && options.offline && offlineConfig) {
        return this.handleOfflineRequest<T>(
          config,
          offlineConfig,
          cacheKey,
          authData
        );
      }
      if (config.url?.includes('/api/sms/send')) {
        // Don't retry SMS sends to avoid duplicate messages
        throw error;
      }

      // Handle token expiry
      if (axiosError.response?.status === 401) {
        await this.handleTokenExpiry();
      }

      this.handleError(axiosError, showError);
      throw error;
    }
    
  }

  /**
   * Should retry request based on error
   */
  private shouldRetry(error: AxiosError): boolean {
    if (!error.response) return true; // Network errors
    
    const status = error.response.status;
    // Retry on 5xx errors and specific 4xx errors
    return status >= 500 || status === 408 || status === 429;
  }

  /**
   * Handle token expiry
   */
  private async handleTokenExpiry(): Promise<void> {
    // Clear auth data
    await AsyncStorage.multiRemove(['@lpai_token', '@lpai_user']);
    BaseService.setAuthContext(null);
    
    // Emit logout event (you'd implement this)
    // EventEmitter.emit('auth:logout', 'Session expired');
  }

  /**
   * GET request
   */
  protected async get<T>(
    endpoint: string,
    options?: ServiceOptions & { params?: any },
    offlineConfig?: OfflineConfig
  ): Promise<T> {
    return this.request<T>(
      {
        method: 'GET',
        url: endpoint,
        params: options?.params,
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
    data?: any,
    options?: ServiceOptions,
    offlineConfig?: OfflineConfig
  ): Promise<T> {
    const result = await this.request<T>(
      {
        method: 'POST',
        url: endpoint,
        data,
      },
      options,
      offlineConfig
    );

    await this.clearCache();
    return result;
  }

  /**
   * PATCH request
   */
  protected async patch<T>(
    endpoint: string,
    data: any,
    options?: ServiceOptions,
    offlineConfig?: OfflineConfig
  ): Promise<T> {
    const result = await this.request<T>(
      {
        method: 'PATCH',
        url: endpoint,
        data,
      },
      options,
      offlineConfig
    );

    await this.clearCache();
    return result;
  }

  /**
   * PUT request
   */
  protected async put<T>(
    endpoint: string,
    data: any,
    options?: ServiceOptions,
    offlineConfig?: OfflineConfig
  ): Promise<T> {
    const result = await this.request<T>(
      {
        method: 'PUT',
        url: endpoint,
        data,
      },
      options,
      offlineConfig
    );

    await this.clearCache();
    return result;
  }

  /**
   * DELETE request
   */
  protected async delete<T>(
    endpoint: string,
    options?: ServiceOptions,
    offlineConfig?: OfflineConfig
  ): Promise<T> {
    const result = await this.request<T>(
      {
        method: 'DELETE',
        url: endpoint,
      },
      options,
      offlineConfig
    );

    await this.clearCache();
    return result;
  }

  /**
   * Build cache key
   */
  private buildCacheKey(config: AxiosRequestConfig): string {
    const { method = 'GET', url = '', params } = config;
    const queryString = params ? JSON.stringify(params) : '';
    return `@lpai_cache_${method}_${url}_${queryString}`;
  }

  /**
   * Check if network error
   */
  private isNetworkError(error: any): boolean {
    return (
      !error.response ||
      error.code === 'NETWORK_ERROR' ||
      error.code === 'ECONNABORTED' ||
      error.message === 'Network Error'
    );
  }

  /**
   * Handle offline request
   */
  private async handleOfflineRequest<T>(
    config: AxiosRequestConfig,
    offlineConfig: OfflineConfig,
    cacheKey: string | null,
    authData: any
  ): Promise<T> {
    if (config.method === 'GET' && cacheKey) {
      const staleData = await cacheService.get<T>(cacheKey, true);
      if (staleData) {
        if (__DEV__) {
          console.log(`📴 [${this.serviceName}] Offline: Using stale cache`);
        }
        return staleData;
      }
    } else if (config.method !== 'GET') {
      await syncQueueService.addToQueue({
        ...offlineConfig,
        data: config.data,
        params: config.params,
        locationId: authData.locationId,
        userId: authData.userId,
      });

      if (__DEV__) {
        console.log(`📴 [${this.serviceName}] Offline: Queued for sync`);
      }

      return {} as T;
    }

    throw new Error('No offline data available');
  }

  /**
   * Handle errors
   */
  private handleError(error: Error | AxiosError, showError: boolean): void {
    if (!showError) return;

    let message = 'An unexpected error occurred';
    
    if ('response' in error && error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 400:
          message = data?.message || 'Invalid request';
          break;
        case 401:
          message = 'Session expired. Please login again.';
          break;
        case 403:
          message = 'Permission denied';
          break;
        case 404:
          message = 'Resource not found';
          break;
        case 422:
          message = data?.message || 'Validation failed';
          break;
        case 429:
          message = 'Too many requests. Please try again later.';
          break;
        case 500:
          message = 'Server error. Please try again.';
          break;
        default:
          message = data?.message || message;
      }
    } else if ('message' in error) {
      message = error.message;
    }

    Alert.alert('Error', message);
  }

  /**
   * Clear related caches
   */
  protected async clearRelatedCaches(
    entity: string,
    additionalServices: string[] = []
  ): Promise<void> {
    const relatedEntities = RELATED_ENTITIES[entity] || [];
    const allServices = [...new Set([...relatedEntities, ...additionalServices])];
    
    if (__DEV__) {
      console.log(`🧹 [${this.serviceName}] Clearing related caches:`, allServices);
    }

    for (const service of allServices) {
      await this.clearServiceCache(service);
    }
  }

  /**
   * Clear service cache
   */
  protected async clearServiceCache(serviceName: string): Promise<void> {
    const cachePrefix = `@lpai_cache_GET_/api/${serviceName}`;
    await cacheService.clear(cachePrefix);
  }

  /**
   * Clear own cache
   */
  public async clearCache(prefix?: string): Promise<void> {
    const cachePrefix = prefix || `@lpai_cache_GET_/api/${this.serviceName}`;
    await cacheService.clear(cachePrefix);
  }

  /**
   * Get related service instance
   */
  protected getService<T extends BaseService>(serviceName: string): T | undefined {
    return serviceRegistry.get(serviceName) as T;
  }

  /**
   * Batch requests
   */
  protected async batch<T>(
    requests: Array<() => Promise<T>>
  ): Promise<PromiseSettledResult<T>[]> {
    return Promise.allSettled(requests.map(fn => fn()));
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.get('/api/health', { 
        cache: false, 
        showError: false,
        requireAuth: false,
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }
}

export type { ServiceOptions, OfflineConfig, ApiResponse };