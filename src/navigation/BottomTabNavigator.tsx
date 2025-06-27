// src/navigation/BottomTabNavigator.tsx
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Platform,
  Text,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';
import { useNavigationConfig } from '../hooks/useNavigationConfig';
import SwipeableTabNavigator from './SwipeableTabNavigator';

// Import all your screens
import DashboardScreen from '../screens/DashboardScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import MoreScreen from '../screens/MoreScreen';
import QuoteBuilderScreen from '../screens/QuoteBuilderScreen';
import ConversationScreen from '../screens/ConversationScreen';
import JobCompletionScreen from '../screens/JobCompletionScreen';
import { contactService } from '../services/contactService';


// Import modals
import AddContactForm from '../components/AddContactForm';
import CreateAppointmentModal from '../components/CreateAppointmentModal';

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get('window');

// Map screen names to components
const SCREEN_COMPONENTS: Record<string, React.ComponentType<any>> = {
  Dashboard: DashboardScreen,
  Calendar: CalendarScreen,
  Contacts: ContactsScreen,
  Projects: ProjectsScreen,
  More: MoreScreen,
  QuoteBuilder: QuoteBuilderScreen,
  Conversation: ConversationScreen,
  JobCompletion: JobCompletionScreen,
  // Add these two missing mappings:
  ProjectsStack: ProjectsScreen,
  QuotesStack: QuoteBuilderScreen,
};

// Quick add options - removed project
const QUICK_ADD_OPTIONS = [
  { id: 'contact', label: 'Add Contact', icon: 'person-add-outline', type: 'modal' },
  { id: 'appointment', label: 'Schedule Appointment', icon: 'calendar-outline', type: 'modal' },
  { id: 'quote', label: 'Create Quote', icon: 'document-text-outline', type: 'navigation' },
];

// Custom center button component with subtle press effect
const CustomCenterButton = React.memo(({ children, onPress }: any) => {
  const [isPressed, setIsPressed] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  return (
    <TouchableWithoutFeedback
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[
        styles.centerButton,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <View style={[
          styles.centerButtonBg,
          isPressed && styles.centerButtonPressed
        ]}>
          {children}
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
});

export default function BottomTabNavigator() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { bottomNavItems } = useNavigationConfig();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddAnimation] = useState(new Animated.Value(0));
  
  // Modal states
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);

  // Memoize toggle function
  const toggleQuickAdd = useCallback(() => {
    if (showQuickAdd) {
      Animated.timing(quickAddAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setShowQuickAdd(false));
    } else {
      setShowQuickAdd(true);
      Animated.timing(quickAddAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [showQuickAdd, quickAddAnimation]);

  // Memoize handler
  const handleQuickAddPress = useCallback((optionId: string) => {
    toggleQuickAdd();
    
    // Use requestAnimationFrame for smoother transition
    requestAnimationFrame(() => {
      switch (optionId) {
        case 'contact':
          setShowContactModal(true);
          break;
        case 'appointment':
          setShowAppointmentModal(true);
          break;
        case 'quote':
          // Navigate to quote builder with showContactPicker flag
          navigation.navigate('QuoteBuilder' as never, {
            showContactPicker: true
          } as never);
          break;
      }
    });
  }, [toggleQuickAdd, navigation]);

  // Handle contact creation - navigate to detail after creation
const handleContactCreated = useCallback((newContact: any) => {
  if (__DEV__) {
    console.log('[BottomTabNavigator] Contact created:', newContact);
  }
  
  setShowContactModal(false);
  
  // Use the MongoDB contact that's now being returned
  const mongoContact = newContact.mongoContact;
  if (mongoContact && mongoContact._id) {
    if (__DEV__) {
      console.log('[BottomTabNavigator] Navigating with MongoDB contact:', mongoContact._id);
    }
    
    navigation.navigate('ContactDetailScreen' as never, { 
      contact: mongoContact
    } as never);
  } else {
    // This shouldn't happen now, but keeping as fallback
    console.error('[BottomTabNavigator] No MongoDB contact returned!');
  }
}, [navigation]);

  // Handle appointment creation
  const handleAppointmentCreated = useCallback((appointmentData: any) => {
    if (__DEV__) {
      console.log('[BottomTabNavigator] Appointment created:', appointmentData);
    }
    
    // Close the modal
    setShowAppointmentModal(false);
    
    // Navigate to appointment detail if needed
    // navigation.navigate('AppointmentDetail', { appointmentId: appointmentData.id });
  }, [navigation]);

  // Memoize navigation items
  const leftNavItems = useMemo(() => bottomNavItems.slice(0, 2), [bottomNavItems]);
  const rightNavItems = useMemo(() => bottomNavItems.slice(2, 3), [bottomNavItems]);
  const initialRouteName = useMemo(() => 
    bottomNavItems.find(item => item.id === 'home')?.screen || bottomNavItems[0]?.screen || 'Dashboard',
    [bottomNavItems]
  );

  // Memoize screen options with custom tab bar button
  const screenOptions = useMemo(() => ({
    tabBarStyle: {
      backgroundColor: COLORS.card,
      borderTopWidth: 0,
      elevation: 8,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      height: 60,
      paddingBottom: 8,
      paddingTop: 8,
    },
    tabBarActiveTintColor: COLORS.accent,
    tabBarInactiveTintColor: COLORS.textGray,
    headerShown: false,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600',
    },
    tabBarButton: (props: any) => {
      // Custom button to remove ripple effect
      return (
        <TouchableOpacity
          {...props}
          activeOpacity={0.7}
          style={[props.style, { flex: 1 }]}
        />
      );
    },
  }), []);

  if (__DEV__) {
    console.log('🎯 [BottomNav] Bottom nav configuration:', {
      leftNavItems: leftNavItems.map(item => ({ id: item.id, screen: item.screen })),
      rightNavItems: rightNavItems.map(item => ({ id: item.id, screen: item.screen })),
      allScreens: Object.keys(SCREEN_COMPONENTS),
    });
  }

  return (
    <>
      <SwipeableTabNavigator>
        <Tab.Navigator
          screenOptions={screenOptions}
          initialRouteName={initialRouteName}
        >
          {/* First 2 navigation items */}
          {leftNavItems.map((item) => {
            const ScreenComponent = SCREEN_COMPONENTS[item.screen];
            
            if (!ScreenComponent) {
              if (__DEV__) {
                console.warn(`⚠️ [BottomNav] No component found for screen: ${item.screen}`);
              }
              return null;
            }

            return (
              <Tab.Screen
                key={item.id}
                name={item.screen}
                component={ScreenComponent}
                options={{
                  tabBarLabel: item.label,
                  tabBarIcon: ({ color, size }) => (
                    <Ionicons name={item.icon as any} size={size} color={color} />
                  ),
                }}
              />
            );
          })}

          {/* Center Quick Add Button - always in position 3 */}
          <Tab.Screen
            name="QuickAdd"
            component={View} // Dummy component
            options={{
              tabBarButton: (props) => (
                <CustomCenterButton {...props} onPress={toggleQuickAdd}>
                  <Ionicons name="add" size={28} color="white" />
                </CustomCenterButton>
              ),
            }}
          />

          {/* Third navigation item (if exists) */}
          {rightNavItems.map((item) => {
            const ScreenComponent = SCREEN_COMPONENTS[item.screen];
            
            if (!ScreenComponent) {
              if (__DEV__) {
                console.warn(`⚠️ [BottomNav] No component found for screen: ${item.screen}`);
              }
              return null;
            }

            return (
              <Tab.Screen
                key={item.id}
                name={item.screen}
                component={ScreenComponent}
                options={{
                  tabBarLabel: item.label,
                  tabBarIcon: ({ color, size }) => (
                    <Ionicons name={item.icon as any} size={size} color={color} />
                  ),
                }}
              />
            );
          })}

          {/* More tab - always last */}
          <Tab.Screen
            name="More"
            component={MoreScreen}
            options={{
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="menu" size={size} color={color} />
              ),
            }}
          />
        </Tab.Navigator>
      </SwipeableTabNavigator>

      {/* Quick Add Overlay - optimized */}
      {showQuickAdd && (
        <>
          <TouchableWithoutFeedback onPress={toggleQuickAdd}>
            <View style={styles.overlay} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.quickAddContainer,
              {
                opacity: quickAddAnimation,
                transform: [
                  {
                    translateY: quickAddAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                  {
                    scale: quickAddAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {QUICK_ADD_OPTIONS.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.quickAddOption,
                  { marginBottom: index === QUICK_ADD_OPTIONS.length - 1 ? 16 : 12 }
                ]}
                onPress={() => handleQuickAddPress(option.id)}
                activeOpacity={0.8}
              >
                <View style={styles.quickAddOptionContent}>
                  <View style={styles.quickAddOptionIcon}>
                    <Ionicons name={option.icon as any} size={22} color={COLORS.accent} />
                  </View>
                  <Text style={styles.quickAddOptionText}>{option.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </>
      )}

      {/* Modals - with proper handlers */}
      <AddContactForm
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
        onSubmit={handleContactCreated}
        isModal={true}
      />

      <CreateAppointmentModal
        visible={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        onSubmit={handleAppointmentCreated}
        contacts={[]}
        selectedDate={new Date()}
      />
    </>
  );
}

// Optimized styles
const styles = StyleSheet.create({
  centerButton: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerButtonBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'ios' ? {
      shadowColor: COLORS.shadow || '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3.84,
    } : {
      elevation: 5,
    }),
  },
  centerButtonPressed: {
    backgroundColor: COLORS.accentDark || '#1a5f7a', // Slightly darker when pressed
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  quickAddContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
    maxWidth: 200, // Limit width on mobile
  },
  quickAddOption: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    minWidth: 180, // Reduced from 200
    ...SHADOW.fab,
  },
  quickAddOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, // Reduced from 20
    paddingVertical: 14, // Reduced from 16
  },
  quickAddOptionIcon: {
    width: 36, // Reduced from 40
    height: 36, // Reduced from 40
    borderRadius: 18,
    backgroundColor: COLORS.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12, // Reduced from 16
  },
  quickAddOptionText: {
    fontSize: 15, // Reduced from FONT.input
    fontWeight: '600',
    color: COLORS.textDark,
    flex: 1,
  },
});