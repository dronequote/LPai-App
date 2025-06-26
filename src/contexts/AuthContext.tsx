// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@lpai/types';
import { authService } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import api from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  expoPushToken: string | null;
  login: (data: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updatePushToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  expoPushToken?: string;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, expoPushToken }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    // Update push token when it's received
    if (expoPushToken && user) {
      updatePushToken(expoPushToken);
    }
  }, [expoPushToken, user]);

  const initializeAuth = async () => {
    try {
      if (__DEV__) {
        console.log('🔐 [AuthContext] Initializing authentication...');
      }
      
      // Let authService handle all initialization
      const isAuthenticated = await authService.initialize();
      
      if (isAuthenticated) {
        const currentUser = await authService.getCurrentUser();
        const storedToken = await authService.getToken();
        
        if (currentUser && storedToken) {
          setUser(currentUser);
          setToken(storedToken);
          
          if (__DEV__) {
            console.log('🔐 [AuthContext] User restored from storage:', {
              id: currentUser._id,
              name: currentUser.name,
              role: currentUser.role,
            });
          }

          // Check for stored push token
          const storedPushToken = await AsyncStorage.getItem('expoPushToken');
          if (storedPushToken) {
            setPushToken(storedPushToken);
          }
        }
      }
    } catch (error) {
      console.error('❌ [AuthContext] Error initializing auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async ({ email, password }: { email: string; password: string }) => {
    try {
      if (__DEV__) {
        console.log('🔐 [AuthContext] Login attempt for:', email);
      }
      
      // Use authService for login
      const response = await authService.login({ email, password });
      
      // Extract user data from response
      const userData: User = {
        _id: response._id,
        userId: response.userId || response.ghlUserId, // Keep this for backwards compatibility
        ghlUserId: response.ghlUserId, // ADD THIS LINE - preserve the original ghlUserId
        name: response.name,
        email: response.email,
        role: response.role,
        locationId: response.locationId,
        permissions: response.permissions,
        preferences: response.preferences,
      };
      
      setToken(response.token);
      setUser(userData);
      
      if (__DEV__) {
        console.log('🔐 [AuthContext] Login successful:', {
          id: userData._id,
          name: userData.name,
          role: userData.role,
        });
      }

      // After successful login, update push token if available
      const storedPushToken = await AsyncStorage.getItem('expoPushToken');
      if (storedPushToken && userData._id) {
        try {
          await api.post('/users/push-token', {
            userId: userData._id,
            pushToken: storedPushToken,
            platform: Platform.OS,
            deviceInfo: {
              osVersion: Platform.Version,
              model: Platform.select({
                ios: 'iPhone',
                android: 'Android Device',
              }),
            },
          });
          setPushToken(storedPushToken);
          if (__DEV__) {
            console.log('📱 [AuthContext] Push token updated after login');
          }
        } catch (error) {
          console.log('⚠️ [AuthContext] Failed to update push token:', error);
          // Don't fail login if push token update fails
        }
      }
    } catch (error: any) {
      console.error('❌ [AuthContext] Login error:', error);
      
      // Re-throw with a user-friendly message
      if (error.response?.status === 401) {
        throw new Error('Invalid email or password');
      } else if (error.response?.status === 404) {
        throw new Error('User not found');
      } else if (error.message === 'Network Error') {
        throw new Error('No internet connection. Please check your network.');
      } else {
        throw new Error(error.response?.data?.error || 'Login failed. Please try again.');
      }
    }
  };

  const logout = async () => {
    try {
      if (__DEV__) {
        console.log('🔐 [AuthContext] Logout initiated');
      }

      // Clear push token on server before logout
      if (user?._id && pushToken) {
        try {
          await api.post('/users/push-token', {
            userId: user._id,
            pushToken: null, // Clear the token
            platform: Platform.OS,
          });
        } catch (error) {
          console.log('⚠️ [AuthContext] Failed to clear push token:', error);
          // Don't fail logout if push token clear fails
        }
      }
      
      // Let authService handle all cleanup
      await authService.logout();
      
      // Clear local state
      setToken(null);
      setUser(null);
      setPushToken(null);
      
      if (__DEV__) {
        console.log('🔐 [AuthContext] Logout complete');
      }
    } catch (error) {
      console.error('❌ [AuthContext] Error during logout:', error);
      // Even if logout fails, clear local state
      setToken(null);
      setUser(null);
      setPushToken(null);
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) {
      console.warn('⚠️ [AuthContext] Cannot update user - no user logged in');
      return;
    }
    
    try {
      const updatedUser: User = {
        ...user,
        ...updates,
        preferences: {
          ...user.preferences,
          ...updates.preferences,
        },
      };
      
      if (__DEV__) {
        console.log('🔐 [AuthContext] Updating user:', {
          updates,
          newNavigatorOrder: updatedUser.preferences?.navigatorOrder,
        });
      }
      
      // Update in authService (handles AsyncStorage)
      await authService.updateStoredPreferences(updatedUser.preferences);
      
      // Update local state
      setUser(updatedUser);
    } catch (error) {
      console.error('❌ [AuthContext] Error updating user:', error);
      throw error;
    }
  };

  const updatePushToken = async (token: string) => {
    if (!user?._id) {
      console.warn('⚠️ [AuthContext] Cannot update push token - no user logged in');
      return;
    }

    try {
      await api.post('/users/push-token', {
        userId: user._id,
        pushToken: token,
        platform: Platform.OS,
        deviceInfo: {
          osVersion: Platform.Version,
          model: Platform.select({
            ios: 'iPhone',
            android: 'Android Device',
          }),
        },
      });
      
      setPushToken(token);
      await AsyncStorage.setItem('expoPushToken', token);
      
      if (__DEV__) {
        console.log('📱 [AuthContext] Push token updated successfully');
      }
    } catch (error) {
      console.error('❌ [AuthContext] Failed to update push token:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token, 
        loading,
        expoPushToken: pushToken,
        login, 
        logout, 
        updateUser,
        updatePushToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};