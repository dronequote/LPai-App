// src/utils/navigationPreferences.ts
import api from '../lib/api';
import { UserPreferences } from '@lpai/types';

export const updateNavigationOrder = async (
  userId: string,
  newOrder: string[]
): Promise<boolean> => {
  try {
    const response = await api.patch(`/api/users/${userId}`, {
      preferences: {
        navigatorOrder: newOrder,
      },
    });
    
    if (__DEV__) {
      console.log('✅ Navigation order updated:', newOrder);
    }
    
    return true;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to update navigation order:', error);
    }
    return false;
  }
};

export const toggleNavItemVisibility = async (
  userId: string,
  itemId: string,
  hidden: boolean,
  currentHiddenItems: string[] = []
): Promise<boolean> => {
  try {
    const newHiddenItems = hidden
      ? [...currentHiddenItems, itemId]
      : currentHiddenItems.filter(id => id !== itemId);
    
    const response = await api.patch(`/api/users/${userId}`, {
      preferences: {
        hiddenNavItems: newHiddenItems,
      },
    });
    
    return true;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to toggle nav item visibility:', error);
    }
    return false;
  }
};