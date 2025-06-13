// services/cacheService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheConfig {
  ttl?: number; // Time to live in milliseconds
  priority?: 'high' | 'medium' | 'low';
  compress?: boolean;
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  priority: string;
  size?: number;
}

class CacheService {
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB limit
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  // Cache key prefixes
  private readonly KEYS = {
    AUTH: '@lpai_auth',
    PROJECTS: '@lpai_projects',
    CONTACTS: '@lpai_contacts',
    APPOINTMENTS: '@lpai_appointments',
    QUOTES: '@lpai_quotes',
    SYNC_QUEUE: '@lpai_sync_queue',
    CACHE_META: '@lpai_cache_meta',
  };

  // Priority-based TTLs (for service industry use)
  private readonly TTL_CONFIG = {
    high: 7 * 24 * 60 * 60 * 1000,    // 7 days - critical data
    medium: 24 * 60 * 60 * 1000,      // 24 hours - daily data
    low: 60 * 60 * 1000,              // 1 hour - temporary data
  };

  /**
   * Store data with intelligent caching
   */
  async set<T>(
    key: string, 
    data: T, 
    config: CacheConfig = {}
  ): Promise<void> {
    try {
      const { 
        ttl = this.DEFAULT_TTL, 
        priority = 'medium',
        compress = false 
      } = config;

      // Check cache size before storing
      await this.ensureCacheSpace();

      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl: this.TTL_CONFIG[priority] || ttl,
        priority,
        size: JSON.stringify(data).length,
      };

      const value = compress 
        ? await this.compress(JSON.stringify(cacheItem))
        : JSON.stringify(cacheItem);

      await AsyncStorage.setItem(key, value);
      await this.updateCacheMetadata(key, cacheItem.size || 0);

      if (__DEV__) {
        console.log(`📦 Cached: ${key} (${this.formatBytes(cacheItem.size || 0)})`);
      }
    } catch (error) {
      console.error('❌ Cache set error:', error);
      // Don't throw - caching should never break the app
    }
  }

  /**
   * Get data with automatic expiry checking
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (!value) return null;

      const cacheItem: CacheItem<T> = JSON.parse(value);
      
      // Check if expired
      if (this.isExpired(cacheItem)) {
        await this.remove(key);
        return null;
      }

      if (__DEV__) {
        console.log(`📦 Cache hit: ${key}`);
      }

      return cacheItem.data;
    } catch (error) {
      console.error('❌ Cache get error:', error);
      return null;
    }
  }

  /**
   * Get expired data (useful for offline mode)
   */
  async getExpired<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (!value) return null;

      const cacheItem: CacheItem<T> = JSON.parse(value);
      
      // Return data even if expired
      if (__DEV__) {
        console.log(`📦 Returning expired cache for: ${key}`);
      }
      
      return cacheItem.data;
    } catch (error) {
      console.error('❌ Cache getExpired error:', error);
      return null;
    }
  }

  /**
   * Get with fallback - perfect for offline-first
   */
  async getWithFallback<T>(
    key: string,
    fetchFn: () => Promise<T>,
    config?: CacheConfig
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached) return cached;

    // If no cache, try to fetch
    try {
      const fresh = await fetchFn();
      await this.set(key, fresh, config);
      return fresh;
    } catch (error) {
      // If fetch fails and we have expired cache, return it
      const expired = await this.getExpired<T>(key);
      if (expired) {
        if (__DEV__) {
          console.log(`📦 Using expired cache for: ${key}`);
        }
        return expired;
      }
      throw error;
    }
  }

  /**
   * Get multiple items efficiently
   */
  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await AsyncStorage.multiGet(keys);
      return values.map(([key, value]) => {
        if (!value) return null;
        try {
          const cacheItem: CacheItem<T> = JSON.parse(value);
          return this.isExpired(cacheItem) ? null : cacheItem.data;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error('❌ Cache getMany error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Remove item from cache
   */
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
      await this.updateCacheMetadata(key, 0, true);
    } catch (error) {
      console.error('❌ Cache remove error:', error);
    }
  }

  /**
   * Clear all cache or by prefix
   */
  async clear(prefix?: string): Promise<void> {
    try {
      if (prefix) {
        const keys = await AsyncStorage.getAllKeys();
        const keysToRemove = keys.filter(key => key.startsWith(prefix));
        await AsyncStorage.multiRemove(keysToRemove);
        
        if (__DEV__) {
          console.log(`🧹 Cleared ${keysToRemove.length} cached items with prefix: ${prefix}`);
        }
      } else {
        await AsyncStorage.clear();
        if (__DEV__) {
          console.log('🧹 Cleared all cache');
        }
      }
    } catch (error) {
      console.error('❌ Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalSize: number;
    itemCount: number;
    breakdown: Record<string, number>;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      const breakdown: Record<string, number> = {};

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const size = value.length;
          totalSize += size;
          
          // Group by prefix
          const prefix = key.split('_')[0] || 'other';
          breakdown[prefix] = (breakdown[prefix] || 0) + size;
        }
      }

      return {
        totalSize,
        itemCount: keys.length,
        breakdown,
      };
    } catch (error) {
      console.error('❌ Cache stats error:', error);
      return { totalSize: 0, itemCount: 0, breakdown: {} };
    }
  }

  /**
   * Intelligent cache warming for offline support
   */
  async warmCache(locationId: string): Promise<void> {
    if (__DEV__) {
      console.log('🔥 Warming cache for offline support...');
    }
    
    // This would be implemented to pre-fetch critical data
    // Examples:
    // - Today's appointments
    // - Active projects
    // - Recent contacts
    // - Product catalog
  }

  // Private helper methods

  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp > item.ttl;
  }

  private async ensureCacheSpace(): Promise<void> {
    const stats = await this.getCacheStats();
    
    if (stats.totalSize > this.MAX_CACHE_SIZE * 0.9) {
      // Clear low priority items first
      await this.clearLowPriorityItems();
    }
  }

  private async clearLowPriorityItems(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const lowPriorityKeys: string[] = [];

    for (const key of keys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const item = JSON.parse(value);
          if (item.priority === 'low' || this.isExpired(item)) {
            lowPriorityKeys.push(key);
          }
        }
      } catch {
        // Skip invalid items
      }
    }

    if (lowPriorityKeys.length > 0) {
      await AsyncStorage.multiRemove(lowPriorityKeys);
      if (__DEV__) {
        console.log(`🧹 Cleared ${lowPriorityKeys.length} low priority cache items`);
      }
    }
  }

  private async updateCacheMetadata(key: string, size: number, remove = false): Promise<void> {
    // Track cache metadata for size management
    // Implementation depends on your needs
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576) + ' MB';
  }

  private async compress(data: string): Promise<string> {
    // Compression implementation if needed
    // For now, return as-is
    return data;
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export types
export type { CacheConfig, CacheItem };