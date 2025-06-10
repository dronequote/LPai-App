// services/syncService.ts
import { BaseService } from './baseService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyncResult {
 success: boolean;
 entity: string;
 created?: number;
 updated?: number;
 deleted?: number;
 errors?: number;
 message?: string;
 duration?: number;
 timestamp: string;
}

export interface SyncProgress {
 entity: string;
 status: 'pending' | 'syncing' | 'complete' | 'failed';
 current?: number;
 total?: number;
 percent?: number;
 message?: string;
}

export interface SyncOptions {
 fullSync?: boolean;
 limit?: number;
 startDate?: string;
 endDate?: string;
 daysBack?: number;
}

export interface FullSyncProgress {
 overall: {
   status: 'idle' | 'running' | 'complete' | 'failed';
   percent: number;
   currentEntity?: string;
   startedAt?: string;
   completedAt?: string;
   duration?: string;
 };
 entities: Record<string, SyncProgress>;
 results: SyncResult[];
}

class SyncService extends BaseService {
 private syncCallbacks: Map<string, (progress: FullSyncProgress) => void> = new Map();
 private currentSyncProgress: FullSyncProgress = {
   overall: { status: 'idle', percent: 0 },
   entities: {},
   results: [],
 };

 // Sync entities in priority order
 private syncOrder = [
   'location-details',
   'custom-fields',
   'custom-values',
   'pipelines',
   'calendars',
   'users',
   'tags',
   'contacts',
   'opportunities',
   'appointments',
   'conversations',
   'invoices',
 ];

 /**
  * Subscribe to sync progress updates
  */
 subscribeSyncProgress(
   id: string,
   callback: (progress: FullSyncProgress) => void
 ): void {
   this.syncCallbacks.set(id, callback);
 }

 /**
  * Unsubscribe from sync progress
  */
 unsubscribeSyncProgress(id: string): void {
   this.syncCallbacks.delete(id);
 }

 /**
  * Get current sync progress
  */
 getSyncProgress(): FullSyncProgress {
   return this.currentSyncProgress;
 }

 /**
  * Update and broadcast sync progress
  */
 private updateProgress(updates: Partial<FullSyncProgress>): void {
   this.currentSyncProgress = {
     ...this.currentSyncProgress,
     ...updates,
     entities: {
       ...this.currentSyncProgress.entities,
       ...(updates.entities || {}),
     },
   };

   // Broadcast to all listeners
   this.syncCallbacks.forEach(callback => {
     callback(this.currentSyncProgress);
   });
 }

 /**
  * Full location sync - syncs everything
  */
 async syncAll(
   locationId: string,
   options: SyncOptions = {}
 ): Promise<{
   success: boolean;
   results: SyncResult[];
   duration: string;
 }> {
   const startTime = Date.now();
   const results: SyncResult[] = [];

   // Reset progress
   this.currentSyncProgress = {
     overall: {
       status: 'running',
       percent: 0,
       startedAt: new Date().toISOString(),
     },
     entities: {},
     results: [],
   };

   // Initialize all entities as pending
   this.syncOrder.forEach(entity => {
     this.currentSyncProgress.entities[entity] = {
       entity,
       status: 'pending',
       percent: 0,
     };
   });

   this.updateProgress(this.currentSyncProgress);

   try {
     // Track overall progress
     let completedCount = 0;

     for (const entity of this.syncOrder) {
       this.updateProgress({
         overall: {
           ...this.currentSyncProgress.overall,
           currentEntity: entity,
           percent: Math.round((completedCount / this.syncOrder.length) * 100),
         },
         entities: {
           ...this.currentSyncProgress.entities,
           [entity]: {
             entity,
             status: 'syncing',
             percent: 0,
             message: 'Starting sync...',
           },
         },
       });

       try {
         let result: SyncResult;

         switch (entity) {
           case 'location-details':
             result = await this.syncLocationDetails(locationId);
             break;
           case 'custom-fields':
             result = await this.syncCustomFields(locationId);
             break;
           case 'custom-values':
             result = await this.syncCustomValues(locationId);
             break;
           case 'pipelines':
             result = await this.syncPipelines(locationId);
             break;
           case 'calendars':
             result = await this.syncCalendars(locationId);
             break;
           case 'users':
             result = await this.syncUsers(locationId);
             break;
           case 'tags':
             result = await this.syncTags(locationId);
             break;
           case 'contacts':
             result = await this.syncContacts(locationId, options);
             break;
           case 'opportunities':
             result = await this.syncOpportunities(locationId, options);
             break;
           case 'appointments':
             result = await this.syncAppointments(locationId, options);
             break;
           case 'conversations':
             result = await this.syncConversations(locationId, options);
             break;
           case 'invoices':
             result = await this.syncInvoices(locationId, options);
             break;
           default:
             result = {
               success: false,
               entity,
               message: 'Unknown entity',
               timestamp: new Date().toISOString(),
             };
         }

         results.push(result);
         completedCount++;

         this.updateProgress({
           entities: {
             ...this.currentSyncProgress.entities,
             [entity]: {
               entity,
               status: result.success ? 'complete' : 'failed',
               percent: 100,
               message: result.message,
             },
           },
           results: [...this.currentSyncProgress.results, result],
         });
       } catch (error) {
         const errorResult: SyncResult = {
           success: false,
           entity,
           errors: 1,
           message: error instanceof Error ? error.message : 'Sync failed',
           timestamp: new Date().toISOString(),
         };

         results.push(errorResult);
         completedCount++;

         this.updateProgress({
           entities: {
             ...this.currentSyncProgress.entities,
             [entity]: {
               entity,
               status: 'failed',
               percent: 100,
               message: errorResult.message,
             },
           },
           results: [...this.currentSyncProgress.results, errorResult],
         });
       }
     }

     // Calculate duration
     const duration = ((Date.now() - startTime) / 1000).toFixed(1) + 's';

     // Final update
     this.updateProgress({
       overall: {
         status: 'complete',
         percent: 100,
         completedAt: new Date().toISOString(),
         duration,
       },
     });

     // Save sync history
     await this.saveSyncHistory(locationId, results, duration);

     return {
       success: results.every(r => r.success),
       results,
       duration,
     };
   } catch (error) {
     const duration = ((Date.now() - startTime) / 1000).toFixed(1) + 's';

     this.updateProgress({
       overall: {
         status: 'failed',
         percent: this.currentSyncProgress.overall.percent,
         completedAt: new Date().toISOString(),
         duration,
       },
     });

     throw error;
   }
 }

 /**
  * Individual sync methods
  */
 async syncContacts(
   locationId: string,
   options: SyncOptions = {}
 ): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/contacts';

   try {
     const result = await this.post<any>(
       endpoint,
       {
         locationId,
         fullSync: options.fullSync ?? false,
         limit: options.limit ?? 100,
       },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'contact', priority: 'high' }
     );

     return {
       success: result.success ?? true,
       entity: 'contacts',
       created: result.result?.created || 0,
       updated: result.result?.updated || 0,
       message: `Synced ${(result.result?.created || 0) + (result.result?.updated || 0)} contacts`,
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'contacts',
       errors: 1,
       message: 'Failed to sync contacts',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 async syncOpportunities(
   locationId: string,
   options: SyncOptions = {}
 ): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/opportunities';

   try {
     const result = await this.post<any>(
       endpoint,
       {
         locationId,
         fullSync: options.fullSync ?? false,
         limit: options.limit ?? 100,
       },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'project', priority: 'high' }
     );

     return {
       success: result.success ?? true,
       entity: 'opportunities',
       created: result.result?.created || 0,
       updated: result.result?.updated || 0,
       message: `Synced ${(result.result?.created || 0) + (result.result?.updated || 0)} projects`,
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'opportunities',
       errors: 1,
       message: 'Failed to sync projects',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 async syncAppointments(
   locationId: string,
   options: SyncOptions = {}
 ): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/appointments';

   try {
     const result = await this.post<any>(
       endpoint,
       {
         locationId,
         fullSync: options.fullSync ?? false,
         startDate: options.startDate,
         endDate: options.endDate,
       },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'appointment', priority: 'high' }
     );

     return {
       success: result.success ?? true,
       entity: 'appointments',
       created: result.result?.created || 0,
       updated: result.result?.updated || 0,
       message: `Synced ${(result.result?.created || 0) + (result.result?.updated || 0)} appointments`,
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'appointments',
       errors: 1,
       message: 'Failed to sync appointments',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 async syncConversations(
   locationId: string,
   options: SyncOptions = {}
 ): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/conversations';

   try {
     const result = await this.post<any>(
       endpoint,
       {
         locationId,
         fullSync: options.fullSync ?? false,
         limit: options.limit ?? 50,
       },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'contact', priority: 'low' }
     );

     return {
       success: result.success ?? true,
       entity: 'conversations',
       created: result.result?.created || 0,
       updated: result.result?.updated || 0,
       message: `Synced ${(result.result?.created || 0) + (result.result?.updated || 0)} conversations`,
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'conversations',
       errors: 1,
       message: 'Failed to sync conversations',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 async syncInvoices(
   locationId: string,
   options: SyncOptions = {}
 ): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/invoices';

   try {
     const result = await this.post<any>(
       endpoint,
       {
         locationId,
         limit: options.limit ?? 100,
       },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'payment', priority: 'medium' }
     );

     return {
       success: result.success ?? true,
       entity: 'invoices',
       created: result.result?.created || 0,
       updated: result.result?.updated || 0,
       message: `Synced ${(result.result?.created || 0) + (result.result?.updated || 0)} invoices`,
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'invoices',
       errors: 1,
       message: 'Failed to sync invoices',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 /**
  * Configuration sync methods
  */
 async syncLocationDetails(locationId: string): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/location-details';

   try {
     const result = await this.post<any>(
       endpoint,
       { locationId },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'project', priority: 'high' }
     );

     return {
       success: result.success ?? true,
       entity: 'location-details',
       message: 'Location details synced',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'location-details',
       errors: 1,
       message: 'Failed to sync location details',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 async syncPipelines(locationId: string): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/pipelines';

   try {
     const result = await this.post<any>(
       endpoint,
       { locationId },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'project', priority: 'high' }
     );

     return {
       success: result.success ?? true,
       entity: 'pipelines',
       updated: result.result?.pipelineCount || 0,
       message: `Synced ${result.result?.pipelineCount || 0} pipelines`,
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'pipelines',
       errors: 1,
       message: 'Failed to sync pipelines',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 async syncCalendars(locationId: string): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/calendars';

   try {
     const result = await this.post<any>(
       endpoint,
       { locationId },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'appointment', priority: 'high' }
     );

     return {
       success: result.success ?? true,
       entity: 'calendars',
       updated: result.result?.calendarCount || 0,
       message: `Synced ${result.result?.calendarCount || 0} calendars`,
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'calendars',
       errors: 1,
       message: 'Failed to sync calendars',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 async syncUsers(locationId: string): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/users';

   try {
     const result = await this.post<any>(
       endpoint,
       { locationId },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'project', priority: 'medium' }
     );

     return {
       success: result.success ?? true,
       entity: 'users',
       created: result.result?.created || 0,
       updated: result.result?.updated || 0,
       message: `Synced ${result.result?.total || 0} users`,
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'users',
       errors: 1,
       message: 'Failed to sync users',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 async syncCustomFields(locationId: string): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/custom-fields';

   try {
     const result = await this.post<any>(
       endpoint,
       { locationId },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'project', priority: 'high' }
     );

     return {
       success: result.success ?? true,
       entity: 'custom-fields',
       updated: result.result?.totalFields || 0,
       message: `Synced ${result.result?.totalFields || 0} custom fields`,
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'custom-fields',
       errors: 1,
       message: 'Failed to sync custom fields',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 async syncCustomValues(locationId: string): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/custom-values';

   try {
     const result = await this.post<any>(
       endpoint,
       { locationId },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'project', priority: 'low' }
     );

     return {
       success: result.success ?? true,
       entity: 'custom-values',
       updated: result.count || 0,
       message: `Synced ${result.count || 0} custom values`,
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'custom-values',
       errors: 1,
       message: 'Failed to sync custom values',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 async syncTags(locationId: string): Promise<SyncResult> {
   const startTime = Date.now();
   const endpoint = '/api/sync/tags';

   try {
     const result = await this.post<any>(
       endpoint,
       { locationId },
       { offline: false, showError: false },
       { endpoint, method: 'POST', entity: 'contact', priority: 'low' }
     );

     return {
       success: result.success ?? true,
       entity: 'tags',
       created: result.result?.created || 0,
       updated: result.result?.updated || 0,
       message: `Synced ${result.result?.totalTags || 0} tags`,
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   } catch (error) {
     return {
       success: false,
       entity: 'tags',
       errors: 1,
       message: 'Failed to sync tags',
       duration: Date.now() - startTime,
       timestamp: new Date().toISOString(),
     };
   }
 }

 /**
  * Check sync progress (for long-running syncs)
  */
 async checkSyncProgress(
   locationId: string
 ): Promise<any> {
   const endpoint = `/api/sync/progress/${locationId}`;

   try {
     return await this.get(
       endpoint,
       { cache: false },
       { endpoint, method: 'GET', entity: 'project' }
     );
   } catch (error) {
     return null;
   }
 }

 /**
  * Get last sync time for an entity
  */
 async getLastSyncTime(
   locationId: string,
   entity: string
 ): Promise<string | null> {
   try {
     const key = `@lpai_last_sync_${locationId}_${entity}`;
     return await AsyncStorage.getItem(key);
   } catch {
     return null;
   }
 }

 /**
  * Save sync history
  */
 private async saveSyncHistory(
   locationId: string,
   results: SyncResult[],
   duration: string
 ): Promise<void> {
   try {
     // Save overall last sync
     await AsyncStorage.setItem(
       `@lpai_last_sync_${locationId}_all`,
       new Date().toISOString()
     );

     // Save individual entity sync times
     for (const result of results) {
       if (result.success) {
         await AsyncStorage.setItem(
           `@lpai_last_sync_${locationId}_${result.entity}`,
           result.timestamp
         );
       }
     }

     // Save sync history (keep last 10)
     const historyKey = `@lpai_sync_history_${locationId}`;
     const existingHistory = await AsyncStorage.getItem(historyKey);
     const history = existingHistory ? JSON.parse(existingHistory) : [];

     history.unshift({
       timestamp: new Date().toISOString(),
       duration,
       success: results.every(r => r.success),
       summary: {
         total: results.length,
         successful: results.filter(r => r.success).length,
         failed: results.filter(r => !r.success).length,
       },
       results,
     });

     // Keep only last 10
     if (history.length > 10) {
       history.pop();
     }

     await AsyncStorage.setItem(historyKey, JSON.stringify(history));
   } catch (error) {
     console.error('Failed to save sync history:', error);
   }
 }

 /**
  * Get sync history
  */
 async getSyncHistory(
   locationId: string
 ): Promise<any[]> {
   try {
     const historyKey = `@lpai_sync_history_${locationId}`;
     const history = await AsyncStorage.getItem(historyKey);
     return history ? JSON.parse(history) : [];
   } catch {
     return [];
   }
 }

 /**
  * Clear all sync data (for logout)
  */
 async clearSyncData(): Promise<void> {
   try {
     const keys = await AsyncStorage.getAllKeys();
     const syncKeys = keys.filter(key => 
       key.startsWith('@lpai_last_sync_') || 
       key.startsWith('@lpai_sync_history_')
     );
     
     if (syncKeys.length > 0) {
       await AsyncStorage.multiRemove(syncKeys);
     }
   } catch (error) {
     console.error('Failed to clear sync data:', error);
   }
 }
}

export const syncService = new SyncService();