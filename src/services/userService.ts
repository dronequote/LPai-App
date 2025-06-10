// services/userService.ts
import { BaseService } from './baseService';
import { User, UserPreferences } from '../../packages/types';
import { authService } from './authService';

interface UpdatePreferencesInput {
  dashboardType?: 'service' | 'sales' | 'operations' | 'custom';
  navigatorOrder?: string[];
  hiddenNavItems?: string[];
  showHomeLabel?: boolean;
  customDashboard?: {
    layout: Array<{
      id: string;
      type: string;
      size: 'full' | 'half' | 'quarter';
      position: number;
      config?: Record<string, any>;
    }>;
  };
  theme?: 'light' | 'dark' | 'system';
  notifications?: {
    push?: boolean;
    email?: boolean;
    sms?: boolean;
  };
}

interface UpdateUserInput {
  name?: string;
  phone?: string;
  avatar?: string;
}

class UserService extends BaseService {
  /**
   * Get all users for location
   */
  async listUsers(locationId: string): Promise<User[]> {
    const endpoint = `/api/users?locationId=${locationId}`;
    
    return this.get<User[]>(
      endpoint,
      {
        cache: { priority: 'medium', ttl: 30 * 60 * 1000 }, // 30 min
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );
  }

  /**
   * Get user details
   */
  async getUser(userId: string): Promise<User> {
    const endpoint = `/api/users/${userId}`;
    
    return this.get<User>(
      endpoint,
      {
        cache: { priority: 'high' },
      },
      {
        endpoint,
        method: 'GET',
        entity: 'contact',
      }
    );
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: UpdatePreferencesInput
  ): Promise<User> {
    const endpoint = `/api/users/${userId}`;
    
    const updatedUser = await this.patch<User>(
      endpoint,
      { preferences },
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'contact',
        priority: 'high',
      }
    );

    // Update stored preferences in auth service
    await authService.updateStoredPreferences(updatedUser.preferences);
    
    // Clear user cache
    await this.clearCache(`@lpai_cache_GET_/api/users/${userId}`);
    
    return updatedUser;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: UpdateUserInput
  ): Promise<User> {
    const endpoint = `/api/users/${userId}`;
    
    const updatedUser = await this.patch<User>(
      endpoint,
      data,
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'contact',
        priority: 'medium',
      }
    );

    // Clear caches
    await this.clearCache(`@lpai_cache_GET_/api/users/${userId}`);
    await this.clearCache(`@lpai_cache_GET_/api/users`);
    
    return updatedUser;
  }

  /**
   * Update dashboard layout
   */
  async updateDashboardLayout(
    userId: string,
    layout: UserPreferences['customDashboard']
  ): Promise<User> {
    return this.updatePreferences(userId, {
      customDashboard: layout,
    });
  }

  /**
   * Update navigation order
   */
  async updateNavigationOrder(
    userId: string,
    order: string[]
  ): Promise<User> {
    return this.updatePreferences(userId, {
      navigatorOrder: order,
    });
  }

  /**
   * Toggle navigation item visibility
   */
  async toggleNavItem(
    userId: string,
    itemId: string,
    hidden: boolean
  ): Promise<User> {
    // Get current preferences
    const user = await this.getUser(userId);
    const hiddenItems = user.preferences?.hiddenNavItems || [];
    
    let newHiddenItems: string[];
    if (hidden) {
      // Add to hidden
      newHiddenItems = [...new Set([...hiddenItems, itemId])];
    } else {
      // Remove from hidden
      newHiddenItems = hiddenItems.filter(id => id !== itemId);
    }
    
    return this.updatePreferences(userId, {
      hiddenNavItems: newHiddenItems,
    });
  }

  /**
   * Update theme preference
   */
  async updateTheme(
    userId: string,
    theme: 'light' | 'dark' | 'system'
  ): Promise<User> {
    return this.updatePreferences(userId, { theme });
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    notifications: UpdatePreferencesInput['notifications']
  ): Promise<User> {
    return this.updatePreferences(userId, { notifications });
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(userId: string): Promise<User> {
    const defaultPreferences: UserPreferences = {
      dashboardType: 'service',
      navigatorOrder: [],
      hiddenNavItems: [],
      showHomeLabel: true,
      theme: 'system',
      notifications: {
        push: true,
        email: true,
        sms: true,
      },
    };
    
    return this.updatePreferences(userId, defaultPreferences);
  }

  /**
   * Get current user's preferences
   */
  async getCurrentUserPreferences(): Promise<UserPreferences | null> {
    const user = await authService.getCurrentUser();
    return user?.preferences || null;
  }

  /**
   * Check if user has preference
   */
  async hasPreference(
    userId: string,
    key: keyof UserPreferences
  ): Promise<boolean> {
    const user = await this.getUser(userId);
    return user.preferences?.[key] !== undefined;
  }
}

export const userService = new UserService();