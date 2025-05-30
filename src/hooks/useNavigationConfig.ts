// src/hooks/useNavigationConfig.ts
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { NAVIGATION_ITEMS, DEFAULT_NAV_ORDER, MORE_TAB } from '../config/navigationConfig';

export const useNavigationConfig = () => {
  const { user } = useAuth();

  // Handle legacy string format migration
  const getUserNavOrder = () => {
    try {
      // Early return with defaults if no preferences
      if (!user?.preferences?.navigatorOrder) {
        if (__DEV__) {
          console.log('📱 [NavigationConfig] No navigatorOrder found, using defaults');
        }
        return DEFAULT_NAV_ORDER;
      }
      
      const navOrder = user.preferences.navigatorOrder;
      
      if (__DEV__) {
        console.log('📱 [NavigationConfig] Raw navigatorOrder:', navOrder);
        console.log('📱 [NavigationConfig] Type:', typeof navOrder);
      }
      
      // If it's already an array, use it
      if (Array.isArray(navOrder)) {
        return navOrder;
      }
      
      // If it's the old string format, parse it
      if (typeof navOrder === 'string' && navOrder.trim() !== '') {
        try {
          // Parse the string array format
          const parsed = JSON.parse(navOrder.replace(/'/g, '"'));
          
          if (__DEV__) {
            console.log('📱 [NavigationConfig] Parsed array:', parsed);
          }
          
          // Make sure it's an array
          if (!Array.isArray(parsed)) {
            if (__DEV__) {
              console.warn('📱 [NavigationConfig] Parsed value is not an array');
            }
            return DEFAULT_NAV_ORDER;
          }
          
          // Map old names to new IDs
          const nameToId: Record<string, string> = {
            'Home': 'home',
            'Calendar': 'calendar',
            'Projects': 'projects',
            'Contacts': 'contacts',
            'Quotes': 'quotes',
            'Conversations': 'conversations',
          };
          
          const mappedIds = parsed
            .map((name: string) => nameToId[name] || name.toLowerCase())
            .filter((id: string) => id !== 'more' && NAVIGATION_ITEMS[id]);
          
          if (__DEV__) {
            console.log('📱 [NavigationConfig] Mapped IDs:', mappedIds);
          }
          
          return mappedIds.length > 0 ? mappedIds : DEFAULT_NAV_ORDER;
        } catch (e) {
          if (__DEV__) {
            console.error('❌ [NavigationConfig] Failed to parse navigatorOrder:', e);
          }
          return DEFAULT_NAV_ORDER;
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [NavigationConfig] Error in getUserNavOrder:', error);
      }
    }
    
    return DEFAULT_NAV_ORDER;
  };

  const bottomNavItems = useMemo(() => {
    try {
      const userOrder = getUserNavOrder();
      
      // Make sure we have a valid array
      if (!Array.isArray(userOrder)) {
        if (__DEV__) {
          console.error('❌ [NavigationConfig] userOrder is not an array:', userOrder);
        }
        return DEFAULT_NAV_ORDER.map(id => NAVIGATION_ITEMS[id]).filter(Boolean);
      }
      
      if (__DEV__) {
        console.log('📱 [NavigationConfig] User order:', userOrder);
      }
      
      // Filter to only include valid items that can be in bottom nav
      const validItems = userOrder
        .filter(id => NAVIGATION_ITEMS[id]?.availableInBottomNav)
        .slice(0, 3) // Max 3 items + More = 4 total
        .map(id => NAVIGATION_ITEMS[id])
        .filter(Boolean); // Remove any undefined items
      
      // If we have less than 3 items, add from defaults
      if (validItems.length < 3) {
        const currentIds = validItems.map(item => item.id);
        const additionalItems = DEFAULT_NAV_ORDER
          .filter(id => !currentIds.includes(id) && NAVIGATION_ITEMS[id]?.availableInBottomNav)
          .slice(0, 3 - validItems.length)
          .map(id => NAVIGATION_ITEMS[id])
          .filter(Boolean);
        
        validItems.push(...additionalItems);
      }
      
      if (__DEV__) {
        console.log('📱 [NavigationConfig] Bottom nav items:', validItems.map(item => item.id));
      }
      
      return validItems;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [NavigationConfig] Error in bottomNavItems:', error);
      }
      // Return default items on error
      return DEFAULT_NAV_ORDER.map(id => NAVIGATION_ITEMS[id]).filter(Boolean);
    }
  }, [user?.preferences?.navigatorOrder]);

  const moreMenuItems = useMemo(() => {
    try {
      const bottomNavIds = bottomNavItems.map(item => item.id);
      const hiddenItems = user?.preferences?.hiddenNavItems || [];
      
      // Get all items not in bottom nav and not hidden
      const items = Object.values(NAVIGATION_ITEMS).filter(item => {
        // Skip if in bottom nav
        if (bottomNavIds.includes(item.id)) return false;
        
        // Skip if hidden by user
        if (hiddenItems.includes(item.id)) return false;
        
        // Check role requirements
        if (item.requiresRole && user?.role) {
          return item.requiresRole.includes(user.role);
        }
        
        return true;
      });
      
      if (__DEV__) {
        console.log('📱 [NavigationConfig] More menu items:', items.map(item => item.id));
      }
      
      return items;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [NavigationConfig] Error in moreMenuItems:', error);
      }
      return [];
    }
  }, [bottomNavItems, user?.preferences?.hiddenNavItems, user?.role]);

  return {
    bottomNavItems,
    moreMenuItems,
    allNavigationItems: NAVIGATION_ITEMS,
  };
};