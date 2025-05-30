// src/navigation/SwipeableTabNavigator.tsx
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { 
  PanResponder, 
  Animated, 
  Dimensions, 
  View, 
  Platform,
  InteractionManager 
} from 'react-native';
import { useNavigation, useNavigationState, CommonActions } from '@react-navigation/native';
import { useNavigationConfig } from '../hooks/useNavigationConfig';

const { width: screenWidth } = Dimensions.get('window');
const SWIPE_THRESHOLD = screenWidth * 0.25; // 25% of screen width
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const ANIMATION_DURATION = 300;
const RESISTANCE_FACTOR = 0.3; // How much the screen moves relative to finger

// Feature flag to enable/disable swipe gestures
const ENABLE_SWIPE_GESTURES = false; // Set to true when testing on real devices

interface SwipeableTabNavigatorProps {
  children: React.ReactNode;
}

export default function SwipeableTabNavigator({ children }: SwipeableTabNavigatorProps) {
  const navigation = useNavigation<any>();
  const { bottomNavItems } = useNavigationConfig();
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [isAnimating, setIsAnimating] = useState(false);

  // Get the actual tab navigator state
  const navigationState = useNavigationState(state => state);
  
  // Find the tab navigator state (it's nested inside 'Main')
  const tabState = useMemo(() => {
    const mainRoute = navigationState.routes.find(r => r.name === 'Main');
    return mainRoute?.state;
  }, [navigationState]);

  const currentTabIndex = tabState?.index ?? 0;
  const tabRoutes = tabState?.routes || [];
  const currentTabName = tabRoutes[currentTabIndex]?.name;
  
  // Check if we're in a tab screen (not a modal/detail screen)
  const isInTabScreen = navigationState.routes[navigationState.index].name === 'Main';

  // Build tab order from actual tab routes
  const tabOrder = useMemo(() => {
    return tabRoutes.map(route => route.name);
  }, [tabRoutes]);

  if (__DEV__ && ENABLE_SWIPE_GESTURES) {
    console.log('📱 [SwipeNav] Tab state:', {
      tabOrder,
      currentTabName,
      currentTabIndex,
      isInTabScreen,
      tabRoutes: tabRoutes.map(r => r.name)
    });
  }

  // Smooth animation with native driver
  const animateTransition = (toValue: number, callback?: () => void) => {
    setIsAnimating(true);
    
    Animated.parallel([
      Animated.spring(translateX, {
        toValue,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      translateX.setValue(0);
      setIsAnimating(false);
      if (callback) {
        InteractionManager.runAfterInteractions(() => {
          callback();
        });
      }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Disable gesture handling if feature flag is off
        if (!ENABLE_SWIPE_GESTURES) return false;
        
        // Don't respond if animating or not in tab screen
        if (isAnimating || !isInTabScreen || !tabState) return false;
        
        const { dx, dy } = gestureState;
        
        // Platform-specific gesture detection
        if (Platform.OS === 'ios') {
          // iOS: More strict horizontal detection
          return Math.abs(dx) > Math.abs(dy * 1.5) && Math.abs(dx) > 10;
        } else {
          // Android: More lenient to account for different touch handling
          return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20;
        }
      },
      
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Disable gesture handling if feature flag is off
        if (!ENABLE_SWIPE_GESTURES) return false;
        
        // Capture gesture only for significant horizontal movement
        const { dx, dy } = gestureState;
        return Math.abs(dx) > Math.abs(dy * 2) && Math.abs(dx) > 30;
      },
      
      onPanResponderGrant: (evt) => {
        if (__DEV__ && ENABLE_SWIPE_GESTURES) {
          console.log('👆 [SwipeNav] Swipe started at index:', currentTabIndex, 'Tab:', currentTabName);
        }
      },
      
      onPanResponderMove: (evt, gestureState) => {
        const { dx } = gestureState;
        
        // Apply resistance at edges
        let resistedDx = dx * RESISTANCE_FACTOR;
        
        // Extra resistance at screen edges
        if ((currentTabIndex === 0 && dx > 0) || 
            (currentTabIndex === tabOrder.length - 1 && dx < 0)) {
          resistedDx = dx * 0.1; // Strong resistance at edges
        }
        
        translateX.setValue(resistedDx);
      },
      
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, vx } = gestureState;
        
        if (__DEV__ && ENABLE_SWIPE_GESTURES) {
          console.log('👉 [SwipeNav] Released:', { 
            dx: dx.toFixed(0),
            vx: vx.toFixed(2),
            threshold: SWIPE_THRESHOLD
          });
        }

        // Determine if it's a valid swipe
        const isValidSwipe = Math.abs(dx) > SWIPE_THRESHOLD || 
                            Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD;

        if (isValidSwipe) {
          // Skip QuickAdd when swiping
          const getNextValidIndex = (index: number, direction: number): number => {
            let nextIndex = index + direction;
            const nextTabName = tabOrder[nextIndex];
            
            // Skip QuickAdd tab
            if (nextTabName === 'QuickAdd') {
              nextIndex += direction;
            }
            
            // Ensure we're within bounds
            if (nextIndex < 0 || nextIndex >= tabOrder.length) {
              return -1;
            }
            
            return nextIndex;
          };

          if (dx > 0 && currentTabIndex > 0) {
            // Swipe right - go to previous tab
            const targetIndex = getNextValidIndex(currentTabIndex, -1);
            if (targetIndex >= 0) {
              if (__DEV__ && ENABLE_SWIPE_GESTURES) {
                console.log('◀️ [SwipeNav] Navigating to tab index:', targetIndex);
              }
              
              // Animate out to the right
              animateTransition(screenWidth * 0.5, () => {
                // Use jumpTo to navigate within tab navigator
                navigation.dispatch(
                  CommonActions.navigate({
                    name: 'Main',
                    params: {
                      screen: tabOrder[targetIndex]
                    }
                  })
                );
              });
            } else {
              // Bounce back
              animateTransition(0);
            }
          } else if (dx < 0 && currentTabIndex < tabOrder.length - 1) {
            // Swipe left - go to next tab
            const targetIndex = getNextValidIndex(currentTabIndex, 1);
            if (targetIndex >= 0 && targetIndex < tabOrder.length) {
              if (__DEV__ && ENABLE_SWIPE_GESTURES) {
                console.log('▶️ [SwipeNav] Navigating to tab index:', targetIndex);
              }
              
              // Animate out to the left
              animateTransition(-screenWidth * 0.5, () => {
                // Use jumpTo to navigate within tab navigator
                navigation.dispatch(
                  CommonActions.navigate({
                    name: 'Main',
                    params: {
                      screen: tabOrder[targetIndex]
                    }
                  })
                );
              });
            } else {
              // Bounce back
              animateTransition(0);
            }
          } else {
            // Edge bounce
            animateTransition(0);
          }
        } else {
          // Not a valid swipe - bounce back
          Animated.spring(translateX, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
      
      onPanResponderTerminate: () => {
        // Handle gesture interruption
        if (!isAnimating) {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Reset animation when tab changes
  useEffect(() => {
    translateX.setValue(0);
    opacity.setValue(1);
    setIsAnimating(false);
  }, [currentTabName]);

  // Only apply pan handlers when in tab screen and not animating AND feature flag is on
  const viewProps = isInTabScreen && !isAnimating && ENABLE_SWIPE_GESTURES ? panResponder.panHandlers : {};

  return (
    <View style={{ flex: 1 }} {...viewProps}>
      <Animated.View
        style={{
          flex: 1,
          transform: isInTabScreen && ENABLE_SWIPE_GESTURES ? [{ translateX }] : [],
          opacity: isInTabScreen && ENABLE_SWIPE_GESTURES ? opacity : 1,
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}