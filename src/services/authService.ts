// services/authService.ts (COMPLETE VERSION)
import { BaseService } from './baseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../../packages/types';
import api from '../lib/api';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  userId: string;
  locationId: string;
  name: string;
  permissions: string[];
  role: string;
  _id: string;
  email: string;
  preferences?: any;
}

interface OAuthLoginResponse extends LoginResponse {
  noEmailFound?: boolean;
}

class AuthService extends BaseService {
  private currentUser: User | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  /**
   * Login with email/password
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const endpoint = '/api/login';
    
    try {
      const response = await this.post<LoginResponse>(
        endpoint,
        credentials,
        {
          cache: false,
          offline: false, // Login must be online
          showError: true,
        },
        {
          endpoint,
          method: 'POST',
          entity: 'contact', // Using contact as generic
          priority: 'high',
        }
      );

      // Save auth data
      await this.saveAuthData(response);
      
      // Set auth token on api instance
      api.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
      
      // Start token refresh timer
      this.startRefreshTimer();
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * OAuth login (Google)
   */
  async oauthLogin(email: string): Promise<OAuthLoginResponse> {
    const endpoint = '/api/login/oauth';
    
    try {
      const response = await this.post<OAuthLoginResponse>(
        endpoint,
        email, // Just email for OAuth
        {
          cache: false,
          offline: false,
          showError: true,
        },
        {
          endpoint,
          method: 'POST',
          entity: 'contact',
          priority: 'high',
        }
      );

      // Check if user not found
      if (response.noEmailFound) {
        return response;
      }

      // Save auth data
      await this.saveAuthData(response);
      
      // Set auth token
      api.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
      
      // Start token refresh timer
      this.startRefreshTimer();
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      // Stop refresh timer
      this.stopRefreshTimer();
      
      // Clear all stored data
      await AsyncStorage.multiRemove([
        '@lpai_auth_token',
        '@lpai_user_data',
        '@lpai_location_id',
        '@lpai_user_id',
      ]);

      // Clear API token
      delete api.defaults.headers.common['Authorization'];
      
      // Clear current user
      this.currentUser = null;

      // Clear all caches
      await this.clearCache();
      
      // Clear sync queue
      const { syncQueueService } = await import('./syncQueueService');
      await syncQueueService.clearQueue();
      
      // Clear sync data
      const { syncService } = await import('./syncService');
      await syncService.clearSyncData();
      
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const userData = await AsyncStorage.getItem('@lpai_user_data');
      if (userData) {
        this.currentUser = JSON.parse(userData);
        return this.currentUser;
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }

    return null;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('@lpai_auth_token');
      if (!token) return false;
      
      // Check if token is expired (basic check)
      const userData = await this.getCurrentUser();
      if (!userData) return false;
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get stored auth token
   */
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('@lpai_auth_token');
    } catch {
      return null;
    }
  }

  /**
   * Get stored location ID
   */
  async getLocationId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('@lpai_location_id');
    } catch {
      return null;
    }
  }

  /**
   * Get stored user ID
   */
  async getUserId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('@lpai_user_id');
    } catch {
      return null;
    }
  }

  /**
   * Initialize auth (on app start)
   */
  async initialize(): Promise<boolean> {
    try {
      const token = await this.getToken();
      
      if (token) {
        // Set token on API
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Load user data
        await this.getCurrentUser();
        
        // Start refresh timer
        this.startRefreshTimer();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Auth initialization error:', error);
      return false;
    }
  }

  /**
   * Refresh auth token (JWT refresh not implemented in backend yet)
   */
  async refreshToken(): Promise<boolean> {
    try {
      // For now, just validate the token is still there
      const token = await this.getToken();
      return !!token;
      
      // When backend implements refresh:
      // const endpoint = '/api/auth/refresh';
      // const response = await this.post(endpoint, { token });
      // await AsyncStorage.setItem('@lpai_auth_token', response.token);
      // api.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
      
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  /**
   * Update stored preferences (after user service updates)
   */
  async updateStoredPreferences(preferences: any): Promise<void> {
    try {
      const userData = await AsyncStorage.getItem('@lpai_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        user.preferences = preferences;
        
        await AsyncStorage.setItem('@lpai_user_data', JSON.stringify(user));
        this.currentUser = user;
      }
    } catch (error) {
      console.error('Error updating stored preferences:', error);
    }
  }

  /**
   * Save auth data to storage
   */
  private async saveAuthData(data: LoginResponse): Promise<void> {
    const user: User = {
      _id: data._id,
      userId: data.userId,
      name: data.name,
      email: data.email,
      role: data.role,
      locationId: data.locationId,
      permissions: data.permissions,
      preferences: data.preferences,
    };

    // Save all auth data
    await AsyncStorage.multiSet([
      ['@lpai_auth_token', data.token],
      ['@lpai_user_data', JSON.stringify(user)],
      ['@lpai_location_id', data.locationId],
      ['@lpai_user_id', data.userId],
    ]);

    this.currentUser = user;
  }

  /**
   * Handle session expiry
   */
  async handleSessionExpired(): Promise<void> {
    await this.logout();
    // The app should navigate to login screen
    // This would be handled by the auth context/provider
  }

  /**
   * Start token refresh timer
   */
  private startRefreshTimer(): void {
    // Refresh token every 6 hours
    this.refreshTimer = setInterval(() => {
      this.refreshToken();
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * Stop token refresh timer
   */
  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission: string): boolean {
    return this.currentUser?.permissions?.includes(permission) || false;
  }

  /**
   * Check if user has role
   */
  hasRole(role: string): boolean {
    return this.currentUser?.role === role;
  }

  /**
   * Is admin user
   */
  isAdmin(): boolean {
    return this.hasRole('admin');
  }
}

export const authService = new AuthService();