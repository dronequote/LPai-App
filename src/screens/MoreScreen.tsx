// src/screens/MoreScreen.tsx
// Updated: 2025-06-16
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigationConfig } from '../hooks/useNavigationConfig';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';

export default function MoreScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { moreMenuItems, bottomNavItems } = useNavigationConfig();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: logout 
        },
      ]
    );
  };

  const handleNavigate = (screen: string) => {
    if (__DEV__) {
      console.log('🔍 [MoreScreen] Attempting to navigate to:', screen);
    }
    
    try {
      // Check if this screen is in the current bottom nav
      const isInBottomNav = bottomNavItems.some(item => item.screen === screen);
      
      if (isInBottomNav) {
        // If it's in bottom nav, just jump to that tab
        if (__DEV__) {
          console.log('📱 [MoreScreen] Screen is in bottom nav, jumping to tab:', screen);
        }
        navigation.navigate(screen as never);
      } else {
        // Otherwise, push it as a new screen in the stack
        if (__DEV__) {
          console.log('📄 [MoreScreen] Pushing as stack screen:', screen);
        }
        navigation.navigate(screen as never);
      }
    } catch (error) {
      console.error(`❌ [MoreScreen] Failed to navigate to ${screen}:`, error);
      Alert.alert(
        'Coming Soon',
        `The ${screen} feature is not available yet.`,
        [{ text: 'OK' }]
      );
    }
  };

  // Static menu items (always shown)
  const accountItems = [
    {
      id: 'profile',
      label: 'Profile',
      icon: 'person-outline',
      onPress: () => handleNavigate('ProfileScreen'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings-outline',
      onPress: () => handleNavigate('SettingsScreen'),
    },
    {
      id: 'themes',
      label: 'Themes',
      icon: 'color-palette-outline',
      onPress: () => handleNavigate('ThemesScreen'),
    },
  ];

  const businessItems = [
    {
      id: 'team',
      label: 'Team',
      icon: 'people-outline',
      onPress: () => handleNavigate('TeamScreen'),
      requiresRole: ['admin', 'manager'],
    },
    {
    id: 'locationSettings',
    label: 'Location Settings',
    icon: 'business-outline',
    onPress: () => handleNavigate('LocationSettingsScreen'),
    requiresRole: ['admin'], // Only admin can see this
  },
    {
      id: 'productLibrary',
      label: 'Product Library',
      icon: 'pricetag-outline',
      onPress: () => handleNavigate('ProductLibraryScreen'),
    },
{
      id: 'templates',
      label: 'Templates',
      icon: 'copy-outline',
      onPress: () => handleNavigate('TemplatesScreen'),
    },
  ].filter(item => {
    // Filter by role if required
    if (item.requiresRole && user?.role) {
      return item.requiresRole.includes(user.role);
    }
    return true;
  });

  const supportItems = [
    {
      id: 'help',
      label: 'Help Center',
      icon: 'help-circle-outline',
      onPress: () => handleNavigate('HelpScreen'),
    },
    {
      id: 'contact',
      label: 'Contact Support',
      icon: 'chatbubble-outline',
      onPress: () => handleNavigate('ContactSupportScreen'),
    },
    {
      id: 'about',
      label: 'About',
      icon: 'information-circle-outline',
      onPress: () => handleNavigate('AboutScreen'),
    },
  ];

  if (__DEV__) {
    console.log('📱 [MoreScreen] Dynamic navigation items:', moreMenuItems.map(item => item.id));
    console.log('📱 [MoreScreen] Bottom nav items:', bottomNavItems.map(item => item.id));
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>More</Text>
        </View>

        {/* User Profile Card */}
        <TouchableOpacity 
          style={styles.profileCard}
          onPress={() => handleNavigate('ProfileScreen')}
          activeOpacity={0.7}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>
              {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textGray} />
        </TouchableOpacity>

        {/* Dynamic Navigation Items */}
        {moreMenuItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NAVIGATION</Text>
            {moreMenuItems.map((item) => {
              if (__DEV__) {
                console.log('🔧 [MoreScreen] Rendering menu item:', item);
              }
              
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItem}
                  onPress={() => {
                    if (__DEV__) {
                      console.log('👆 [MoreScreen] Pressed:', item.label, '-> Screen:', item.screen);
                    }
                    handleNavigate(item.screen);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons name={item.icon as any} size={24} color={COLORS.textDark} />
                    <Text style={styles.menuItemText}>{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textGray} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          {accountItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => {
                if (__DEV__) {
                  console.log('👆 [MoreScreen] Account item pressed:', item.label);
                }
                item.onPress();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon as any} size={24} color={COLORS.textDark} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textGray} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Business Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BUSINESS</Text>
          {businessItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => {
                if (__DEV__) {
                  console.log('👆 [MoreScreen] Business item pressed:', item.label);
                }
                item.onPress();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon as any} size={24} color={COLORS.textDark} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textGray} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>
          {supportItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => {
                if (__DEV__) {
                  console.log('👆 [MoreScreen] Support item pressed:', item.label);
                }
                item.onPress();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon as any} size={24} color={COLORS.textDark} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textGray} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={24} color="#FF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
          {user?.role === 'admin' && (
            <Text style={styles.versionText}>Location: {user?.locationId}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  profileCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: RADIUS.card,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOW.card,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileInitials: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  section: {
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  sectionTitle: {
    fontSize: FONT.meta,
    fontWeight: '600',
    color: COLORS.textGray,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    marginLeft: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 16,
    padding: 16,
    borderRadius: RADIUS.card,
    ...SHADOW.card,
  },
  logoutText: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: '#FF4444',
    marginLeft: 12,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: FONT.meta,
    color: COLORS.textLight,
    marginBottom: 4,
  },
});