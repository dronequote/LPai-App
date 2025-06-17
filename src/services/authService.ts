// src/services/authService.ts
import axios from 'axios';
import { LoginCredentials, LoginResponse, User } from '@lpai/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import BaseService to update its auth context
import { BaseService } from './baseService';

const API_BASE_URL = process.env.API_BASE_URL || 'https://lpai-backend-omega.vercel.app';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

class AuthService {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      if (__DEV__) {
        console.log('🔐 [authService] Login request:', {
          endpoint: '/api/login',
          credentials: { 
            email: credentials.email, 
            password: credentials.password 
          },
          baseURL: API_BASE_URL,
        });
      }

      const response = await api.post<LoginResponse>('/api/login', credentials);
      
      if (__DEV__) {
        console.log('🔐 [authService] Login response received:', {
          status: response.status,
          hasData: !!response.data,
          hasToken: !!response.data?.token,
        });
      }

      const loginData = response.data;

      if (!loginData.token) {
        throw new Error('No token received from server');
      }

      // Store token and user data
      await this.storeAuthData(loginData.token, loginData);
      
      // Set auth header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${loginData.token}`;
      
      // IMPORTANT: Update BaseService auth context for other services
      BaseService.setAuthContext({
        user: loginData,
        token: loginData.token
      });

      if (__DEV__) {
        console.log('🔐 [authService] Login successful:', {
          userId: loginData._id,
          name: loginData.name,
          role: loginData.role,
          locationId: loginData.locationId,
        });
      }

      return loginData;
    } catch (error: any) {
      console.error('❌ [authService] Login failed:', error);
      console.error('❌ [authService] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      // Re-throw with better error messages
      if (error.response?.status === 401) {
        throw new Error('Invalid email or password');
      } else if (error.response?.status === 404) {
        throw new Error('User not found');
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else if (error.message === 'Network Error') {
        throw new Error('Network error. Please check your connection.');
      } else {
        throw new Error('Login failed. Please try again.');
      }
    }
  }

  async logout(): Promise<void> {
    try {
      if (__DEV__) {
        console.log('🔐 [authService] Logout initiated');
      }
      
      // Clear auth header
      delete api.defaults.headers.common['Authorization'];
      
      // Clear BaseService auth context
      BaseService.setAuthContext(null);
      
      // Clear local storage
      await this.clearAuthData();
      
      if (__DEV__) {
        console.log('🔐 [authService] Logout complete');
      }
    } catch (error) {
      console.error('❌ [authService] Logout error:', error);
      throw error;
    }
  }

  async initialize(): Promise<boolean> {
    try {
      const token = await this.getToken();
      const user = await this.getCurrentUser();
      
      if (token && user) {
        // Set auth header
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Update BaseService auth context
        BaseService.setAuthContext({ user, token });
        
        if (__DEV__) {
          console.log('🔐 [authService] Initialized with existing token');
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ [authService] Initialize error:', error);
      return false;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const userString = await AsyncStorage.getItem('@lpai_user');
      return userString ? JSON.parse(userString) : null;
    } catch (error) {
      console.error('❌ [authService] Get current user error:', error);
      return null;
    }
  }

  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('@lpai_token');
    } catch (error) {
      console.error('❌ [authService] Get token error:', error);
      return null;
    }
  }

  async updateStoredUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem('@lpai_user', JSON.stringify(user));
    } catch (error) {
      console.error('❌ [authService] Update stored user error:', error);
      throw error;
    }
  }

  async updateStoredPreferences(preferences: any): Promise<void> {
    try {
      const user = await this.getCurrentUser();
      if (user) {
        user.preferences = preferences;
        await this.updateStoredUser(user);
      }
    } catch (error) {
      console.error('❌ [authService] Update stored preferences error:', error);
      throw error;
    }
  }

  private async storeAuthData(token: string, user: LoginResponse): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        ['@lpai_token', token],
        ['@lpai_user', JSON.stringify(user)],
      ]);
      
      if (__DEV__) {
        console.log('🔐 [authService] Auth data stored successfully');
      }
    } catch (error) {
      console.error('❌ [authService] Store auth data error:', error);
      throw error;
    }
  }

  private async clearAuthData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(['@lpai_token', '@lpai_user']);
      
      if (__DEV__) {
        console.log('🔐 [authService] Auth data cleared');
      }
    } catch (error) {
      console.error('❌ [authService] Clear auth data error:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();