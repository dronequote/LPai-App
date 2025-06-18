// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@lpai/types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

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
        userId: response.userId || response.ghlUserId, // Handle both field names
        name: response.name,
        email: response.email,
        role: response.role,
        locationId: response.locationId,
        permissions: response.permissions,
        preferences: response.preferences, // This should now include timezone
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
      
      // Let authService handle all cleanup
      await authService.logout();
      
      // Clear local state
      setToken(null);
      setUser(null);
      
      if (__DEV__) {
        console.log('🔐 [AuthContext] Logout complete');
      }
    } catch (error) {
      console.error('❌ [AuthContext] Error during logout:', error);
      // Even if logout fails, clear local state
      setToken(null);
      setUser(null);
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

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token, 
        loading, 
        login, 
        logout, 
        updateUser 
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