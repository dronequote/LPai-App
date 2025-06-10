// services/syncQueueService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '../utils/netinfo';
import { cacheService } from './cacheService';

interface QueuedAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'project' | 'contact' | 'appointment' | 'quote' | 'payment' | 'sms';
  endpoint: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  data?: any;
  params?: any;
  timestamp: number;
  retryCount: number;
  priority: 'high' | 'medium' | 'low';
  userId?: string;
  locationId?: string;
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt?: Date;
  failedCount: number;
}

type SyncListener = (status: SyncStatus) => void;

class SyncQueueService {
  private readonly QUEUE_KEY = '@lpai_sync_queue';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // Start with 1 second
  
  private isOnline = true;
  private isSyncing = false;
  private syncListeners: Set<SyncListener> = new Set();
  private syncInterval?: NodeJS.Timeout;
  private unsubscribeNetInfo?: () => void;

  constructor() {
    this.initializeNetworkListener();
    this.startAutoSync();
  }

  /**
   * Initialize network state monitoring
   */
  private initializeNetworkListener(): void {
    // Subscribe to network state updates
    this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (__DEV__) {
        console.log(`📡 Network: ${this.isOnline ? 'Online' : 'Offline'}`);
      }

      // If we just came online, trigger sync
      if (wasOffline && this.isOnline) {
        this.processQueue();
      }

      this.notifyListeners();
    });

    // Get initial state
    NetInfo.fetch().then(state => {
      this.isOnline = state.isConnected ?? false;
    });
  }

  /**
   * Add action to queue
   */
  async addToQueue(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      const queuedAction: QueuedAction = {
        ...action,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };

      const queue = await this.getQueue();
      queue.push(queuedAction);
      
      // Sort by priority and timestamp
      queue.sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityWeight[a.priority];
        const bPriority = priorityWeight[b.priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        return a.timestamp - b.timestamp; // Older first
      });

      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
      
      if (__DEV__) {
        console.log(`📥 Queued ${action.type} ${action.entity}: ${action.endpoint}`);
      }

      this.notifyListeners();

      // Try to process immediately if online
      if (this.isOnline && !this.isSyncing) {
        this.processQueue();
      }
    } catch (error) {
      console.error('❌ Failed to queue action:', error);
    }
  }

  /**
   * Process queued actions
   */
  async processQueue(): Promise<void> {
    if (!this.isOnline || this.isSyncing) return;

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const queue = await this.getQueue();
      if (queue.length === 0) {
        this.isSyncing = false;
        this.notifyListeners();
        return;
      }

      if (__DEV__) {
        console.log(`🔄 Processing ${queue.length} queued actions...`);
      }

      const processed: string[] = [];
      const failed: QueuedAction[] = [];

      // Process each action
      for (const action of queue) {
        try {
          await this.executeAction(action);
          processed.push(action.id);
          
          if (__DEV__) {
            console.log(`✅ Processed: ${action.type} ${action.entity}`);
          }
        } catch (error: any) {
          console.error(`❌ Failed to process action:`, error);
          
          action.retryCount++;
          
          if (action.retryCount < this.MAX_RETRIES) {
            // Add exponential backoff
            const delay = this.RETRY_DELAY * Math.pow(2, action.retryCount - 1);
            setTimeout(() => {
              failed.push(action);
            }, delay);
          } else {
            // Max retries reached, move to failed queue
            await this.moveToFailedQueue(action, error);
            if (__DEV__) {
              console.log(`🚫 Moved to failed queue: ${action.type} ${action.entity}`);
            }
          }
        }
      }

      // Update queue with remaining items
      const remainingQueue = queue.filter(
        action => !processed.includes(action.id) && 
                  !failed.find(f => f.id === action.id)
      ).concat(failed);

      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(remainingQueue));

      // Update last sync time
      await cacheService.set('@lpai_last_sync', new Date().toISOString(), {
        priority: 'high'
      });

      if (__DEV__) {
        console.log(`✅ Sync complete: ${processed.length} processed, ${failed.length} failed`);
      }
    } catch (error) {
      console.error('❌ Queue processing error:', error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Execute a single queued action
   */
  private async executeAction(action: QueuedAction): Promise<void> {
    // Import api dynamically to avoid circular dependency
    const { default: api } = await import('../lib/api');
    
    const config: any = {
      method: action.method,
      url: action.endpoint,
    };

    if (action.params) {
      config.params = action.params;
    }

    if (action.data) {
      config.data = action.data;
    }

    // Add location ID header if available
    if (action.locationId) {
      config.headers = {
        ...config.headers,
        'X-Location-ID': action.locationId,
      };
    }

    const response = await api.request(config);
    
    // Update cache with fresh data if applicable
    if (action.type === 'create' || action.type === 'update') {
      await this.updateCacheAfterSync(action, response.data);
    }
  }

  /**
   * Update cache after successful sync
   */
  private async updateCacheAfterSync(action: QueuedAction, responseData: any): Promise<void> {
    // Build cache key based on entity and action
    let cacheKey = '';
    
    switch (action.entity) {
      case 'project':
        if (action.type === 'create') {
          // Invalidate project list cache
          await cacheService.remove(`@lpai_projects_${action.locationId}`);
        }
        if (responseData._id) {
          cacheKey = `@lpai_projects_${responseData._id}`;
        }
        break;
        
      case 'contact':
        if (action.type === 'create') {
          await cacheService.remove(`@lpai_contacts_${action.locationId}`);
        }
        if (responseData._id) {
          cacheKey = `@lpai_contacts_${responseData._id}`;
        }
        break;
        
      case 'appointment':
        // Invalidate appointment list for the day
        const date = new Date().toISOString().split('T')[0];
        await cacheService.remove(`@lpai_appointments_${action.locationId}_${date}`);
        break;
    }

    // Cache the fresh data
    if (cacheKey && responseData) {
      await cacheService.set(cacheKey, responseData, { priority: 'high' });
    }
  }

  /**
   * Get current queue
   */
  async getQueue(): Promise<QueuedAction[]> {
    try {
      const queueData = await AsyncStorage.getItem(this.QUEUE_KEY);
      return queueData ? JSON.parse(queueData) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get failed queue
   */
  async getFailedQueue(): Promise<Array<QueuedAction & { error: any }>> {
    try {
      const failedData = await AsyncStorage.getItem(`${this.QUEUE_KEY}_failed`);
      return failedData ? JSON.parse(failedData) : [];
    } catch {
      return [];
    }
  }

  /**
   * Move action to failed queue
   */
  private async moveToFailedQueue(action: QueuedAction, error: any): Promise<void> {
    try {
      const failedQueue = await this.getFailedQueue();
      failedQueue.push({
        ...action,
        error: {
          message: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        },
      });
      
      // Keep only last 50 failed items
      const trimmedQueue = failedQueue.slice(-50);
      
      await AsyncStorage.setItem(
        `${this.QUEUE_KEY}_failed`,
        JSON.stringify(trimmedQueue)
      );
    } catch (err) {
      console.error('❌ Failed to update failed queue:', err);
    }
  }

  /**
   * Clear queue (with optional filter)
   */
  async clearQueue(filter?: { entity?: string; type?: string }): Promise<void> {
    try {
      if (filter) {
        const queue = await this.getQueue();
        const filtered = queue.filter(action => {
          if (filter.entity && action.entity !== filter.entity) return true;
          if (filter.type && action.type !== filter.type) return true;
          return false;
        });
        await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(filtered));
      } else {
        await AsyncStorage.removeItem(this.QUEUE_KEY);
      }
      
      this.notifyListeners();
    } catch (error) {
      console.error('❌ Failed to clear queue:', error);
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const queue = await this.getQueue();
    const failedQueue = await this.getFailedQueue();
    const lastSync = await cacheService.get<string>('@lpai_last_sync');
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: queue.length,
      failedCount: failedQueue.length,
      lastSyncAt: lastSync ? new Date(lastSync) : undefined,
    };
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    
    // Send initial status
    this.getSyncStatus().then(status => listener(status));
    
    // Return unsubscribe function
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private async notifyListeners(): Promise<void> {
    const status = await this.getSyncStatus();
    this.syncListeners.forEach(listener => listener(status));
  }

  /**
   * Start automatic sync interval
   */
  private startAutoSync(): void {
    // Clear any existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Process queue every 30 seconds if online
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.processQueue();
      }
    }, 30000);
  }

  /**
   * Force sync now
   */
  async syncNow(): Promise<void> {
    if (this.isOnline && !this.isSyncing) {
      await this.processQueue();
    }
  }

  /**
   * Cleanup (call on app unmount)
   */
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }
}

// Export singleton instance
export const syncQueueService = new SyncQueueService();

// Export types
export type { QueuedAction, SyncStatus, SyncListener };