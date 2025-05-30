// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@lpai/types'; // Import from your types package

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (data: { token: string; user: User }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');
        
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          
          if (__DEV__) {
            console.log('🔐 [AuthContext] User loaded from storage:', {
              id: parsedUser._id,
              name: parsedUser.name,
              role: parsedUser.role,
              hasPreferences: !!parsedUser.preferences,
              navigatorOrder: parsedUser.preferences?.navigatorOrder,
              preferencesType: typeof parsedUser.preferences?.navigatorOrder,
            });
          }
          
          setToken(storedToken);
          setUser(parsedUser);
        }
      } catch (e) {
        console.error('❌ [AuthContext] Error loading auth state:', e);
      } finally {
        setLoading(false);
      }
    };

    loadFromStorage();
  }, []);

  const login = async ({ token, user }: { token: string; user: User }) => {
    try {
      if (__DEV__) {
        console.log('🔐 [AuthContext] Login called with user:', {
          id: user._id,
          name: user.name,
          role: user.role,
          hasPreferences: !!user.preferences,
          navigatorOrder: user.preferences?.navigatorOrder,
        });
      }
      
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);
    } catch (error) {
      console.error('❌ [AuthContext] Error during login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (__DEV__) {
        console.log('🔐 [AuthContext] Logout called');
      }
      
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('❌ [AuthContext] Error during logout:', error);
      throw error;
    }
  };

  // Add this new function to update user (useful for preference changes)
  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    
    try {
      const updatedUser = {
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
      
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('❌ [AuthContext] Error updating user:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
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