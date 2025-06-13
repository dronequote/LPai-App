// services/userService.ts
import { BaseService } from './baseService';
import { User, UserPreferences } from '../../packages/types';
import { authService } from './authService';

// Updated to match new UserPreferences structure
interface UpdatePreferencesInput extends Partial<UserPreferences> {
  // All fields from UserPreferences are now available
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
  async list(locationId: string): Promise<User[]> {
    const endpoint = `/api/users?locationId=${locationId}`;
    
    if (__DEV__) {
      console.log('📋 [UserService] Fetching users for location:', locationId);
    }
    
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
    
    if (__DEV__) {
      console.log('👤 [UserService] Fetching user:', userId);
    }
    
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
   * Update user preferences (now supports all new preference fields)
   */
  async updatePreferences(
    userId: string,
    preferences: UpdatePreferencesInput
  ): Promise<User> {
    const endpoint = `/api/users/${userId}`;
    
    if (__DEV__) {
      console.log('⚙️ [UserService] Updating preferences:', { userId, preferences });
    }
    
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
    
    if (__DEV__) {
      console.log('✅ [UserService] Preferences updated successfully');
    }
    
    return updatedUser;
  }

  /**
   * Update user profile (NEW METHOD)
   */
  async updateProfile(
    userId: string,
    data: UpdateUserInput
  ): Promise<User> {
    const endpoint = `/api/users/${userId}`;
    
    if (__DEV__) {
      console.log('🔄 [UserService] Updating profile:', { userId, data });
    }
    
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
    
    if (__DEV__) {
      console.log('✅ [UserService] Profile updated:', updatedUser);
    }
    
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
    notifications: UserPreferences['notificationSettings']
  ): Promise<User> {
    return this.updatePreferences(userId, { 
      notificationSettings: notifications 
    });
  }

  /**
   * Update communication preferences
   */
  async updateCommunicationPreferences(
    userId: string,
    communication: UserPreferences['communication']
  ): Promise<User> {
    if (__DEV__) {
      console.log('📱 [UserService] Updating communication preferences:', communication);
    }
    
    return this.updatePreferences(userId, { communication });
  }

  /**
   * Update business settings
   */
  async updateBusinessSettings(
    userId: string,
    business: UserPreferences['business']
  ): Promise<User> {
    return this.updatePreferences(userId, { business });
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(
    userId: string,
    privacy: UserPreferences['privacy']
  ): Promise<User> {
    return this.updatePreferences(userId, { privacy });
  }

  /**
   * Update mobile settings
   */
  async updateMobileSettings(
    userId: string,
    mobile: UserPreferences['mobile']
  ): Promise<User> {
    return this.updatePreferences(userId, { mobile });
  }

  /**
   * Update timezone
   */
  async updateTimezone(
    userId: string,
    timezone: string
  ): Promise<User> {
    if (__DEV__) {
      console.log('🌍 [UserService] Updating timezone:', timezone);
    }
    
    return this.updatePreferences(userId, { timezone });
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(userId: string): Promise<User> {
    // Import default preferences from backend utils
    const defaultPreferences: UserPreferences = {
      // Display & UI
      notifications: true,
      defaultCalendarView: 'week',
      emailSignature: '',
      theme: 'system',
      
      // Localization
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      firstDayOfWeek: 0,
      language: 'en',
      
      // Add all other default fields...
      // (matching what's in your backend userPreferences.ts)
    };
    
    if (__DEV__) {
      console.log('🔄 [UserService] Resetting preferences to defaults');
    }
    
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

  /**
   * Quick toggle methods for common settings
   */
  async toggleNotifications(userId: string, enabled: boolean): Promise<User> {
    return this.updatePreferences(userId, { notifications: enabled });
  }

  async toggleOfflineMode(userId: string, enabled: boolean): Promise<User> {
    return this.updatePreferences(userId, { 
      mobile: { 
        ...(await this.getUser(userId)).preferences?.mobile,
        offlineMode: enabled 
      } 
    });
  }

  async toggleBiometricLogin(userId: string, enabled: boolean): Promise<User> {
    return this.updatePreferences(userId, { 
      mobile: { 
        ...(await this.getUser(userId)).preferences?.mobile,
        biometricLogin: enabled 
      } 
    });
  }
}

export const userService = new UserService();