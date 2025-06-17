// src/services/dashboardService.ts
// Created: 2025-06-17

import { BaseService } from './baseService';

interface DashboardStats {
  projects: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
    recentProjects: any[];
  };
  quotes: {
    total: number;
    draft: number;
    signed: number;
    totalValue: number;
    conversionRate: number;
  };
  appointments: {
    today: number;
    thisWeek: number;
    upcoming: any[];
    completionRate: number;
  };
  revenue: {
    thisMonth: number;
    lastMonth: number;
    collected: number;
    pending: number;
    growth: number;
  };
}

interface ActivityItem {
  id: string;
  type: 'project' | 'quote' | 'appointment' | 'contact' | 'payment';
  action: string;
  description: string;
  timestamp: string;
  userId?: string;
  metadata?: any;
}

class DashboardService extends BaseService {
  protected serviceName = 'stats';
  /**
   * Get comprehensive dashboard statistics
   */
  async getStats(
    locationId: string,
    period: 'week' | 'month' | 'year' = 'month'
  ): Promise<DashboardStats> {
    const endpoint = `/api/stats/dashboard?locationId=${locationId}&period=${period}`;
    
    return this.get<DashboardStats>(
      endpoint,
      {
        cache: { priority: 'high', ttl: 5 * 60 * 1000 }, // 5 min cache
      },
      {
        endpoint,
        method: 'GET',
        entity: 'project',
      }
    );
  }

  /**
   * Get upcoming appointments for dashboard
   */
  async getUpcomingAppointments(
    locationId: string,
    days: number = 7
  ): Promise<any[]> {
    const endpoint = `/api/appointments?locationId=${locationId}&upcoming=${days}&limit=10`;
    
    return this.get<any[]>(
      endpoint,
      {
        cache: { priority: 'medium', ttl: 5 * 60 * 1000 },
      },
      {
        endpoint,
        method: 'GET',
        entity: 'appointment',
      }
    );
  }

  /**
   * Get recent activity feed
   */
  async getRecentActivity(
    locationId: string,
    limit: number = 20
  ): Promise<ActivityItem[]> {
    const endpoint = `/api/activity?locationId=${locationId}&limit=${limit}`;
    
    return this.get<ActivityItem[]>(
      endpoint,
      {
        cache: { priority: 'low', ttl: 2 * 60 * 1000 }, // 2 min cache
      },
      {
        endpoint,
        method: 'GET',
        entity: 'project',
      }
    );
  }

  /**
   * Get revenue metrics
   */
  async getRevenueMetrics(
    locationId: string,
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    const params = new URLSearchParams({ locationId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const endpoint = `/api/stats/revenue?${params.toString()}`;
    
    return this.get<any>(
      endpoint,
      {
        cache: { priority: 'high', ttl: 10 * 60 * 1000 }, // 10 min cache
      },
      {
        endpoint,
        method: 'GET',
        entity: 'payment',
      }
    );
  }

  /**
   * Get next appointment
   */
  async getNextAppointment(
    locationId: string,
    userId?: string
  ): Promise<any | null> {
    const params = new URLSearchParams({ locationId });
    if (userId) params.append('userId', userId);
    
    const endpoint = `/api/appointments/next?${params.toString()}`;
    
    try {
      return await this.get<any>(
        endpoint,
        {
          cache: { priority: 'high', ttl: 5 * 60 * 1000 },
        },
        {
          endpoint,
          method: 'GET',
          entity: 'appointment',
        }
      );
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear dashboard caches
   */
  async clearDashboardCache(): Promise<void> {
    await this.clearCache('@lpai_cache_GET_/api/stats/dashboard');
    await this.clearCache('@lpai_cache_GET_/api/appointments');
    await this.clearCache('@lpai_cache_GET_/api/activity');
    await this.clearCache('@lpai_cache_GET_/api/stats/revenue');
  }
}

// Create singleton instance
export const dashboardService = new DashboardService();