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
      } else {
        await AsyncStorage.clear();
      }
      
      if (__DEV__) {
        console.log(`🧹 Cache cleared: ${prefix || 'all'}`);
      }
    } catch (error) {
      console.error('❌ Cache clear error:', error);
    }
  }

  /**
   * Get cache size and stats
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
          const prefix = key.split('_')[1] || 'other';
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
   * Smart cache cleanup based on priority and age
   */
  async cleanup(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheItems: Array<{ key: string; item: CacheItem<any> }> = [];

      // Get all cache items
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          try {
            const item = JSON.parse(value);
            if (item.timestamp) {
              cacheItems.push({ key, item });
            }
          } catch {}
        }
      }

      // Remove expired items
      for (const { key, item } of cacheItems) {
        if (this.isExpired(item)) {
          await this.remove(key);
        }
      }

      // If still over size limit, remove by priority
      const stats = await this.getCacheStats();
      if (stats.totalSize > this.MAX_CACHE_SIZE) {
        // Sort by priority and age
        cacheItems.sort((a, b) => {
          const priorityOrder = { low: 0, medium: 1, high: 2 };
          const aPriority = priorityOrder[a.item.priority as keyof typeof priorityOrder] || 1;
          const bPriority = priorityOrder[b.item.priority as keyof typeof priorityOrder] || 1;
          
          if (aPriority !== bPriority) {
            return aPriority - bPriority; // Lower priority first
          }
          return a.item.timestamp - b.item.timestamp; // Older first
        });

        // Remove until under limit
        let currentSize = stats.totalSize;
        for (const { key, item } of cacheItems) {
          if (currentSize <= this.MAX_CACHE_SIZE * 0.8) break; // Keep 20% free
          
          await this.remove(key);
          currentSize -= item.size || 0;
        }
      }

      if (__DEV__) {
        console.log('🧹 Cache cleanup completed');
      }
    } catch (error) {
      console.error('❌ Cache cleanup error:', error);
    }
  }

  // Helper methods
  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp > item.ttl;
  }

  private async getExpired<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (!value) return null;
      
      const cacheItem: CacheItem<T> = JSON.parse(value);
      return cacheItem.data;
    } catch {
      return null;
    }
  }

  private async ensureCacheSpace(): Promise<void> {
    const stats = await this.getCacheStats();
    if (stats.totalSize > this.MAX_CACHE_SIZE * 0.9) {
      await this.cleanup();
    }
  }

  private async updateCacheMetadata(
    key: string, 
    size: number, 
    remove = false
  ): Promise<void> {
    // Track cache metadata for analytics
    try {
      const metaKey = `${this.KEYS.CACHE_META}_${new Date().toISOString().split('T')[0]}`;
      const meta = await this.get<Record<string, number>>(metaKey) || {};
      
      if (remove) {
        delete meta[key];
      } else {
        meta[key] = size;
      }
      
      await AsyncStorage.setItem(metaKey, JSON.stringify(meta));
    } catch {}
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async compress(data: string): Promise<string> {
    // TODO: Implement compression if needed
    // For now, return as-is
    return data;
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export types for use in other services
export type { CacheConfig, CacheItem };