// App.js
import 'react-native-gesture-handler'; // <-- must be FIRST!
import 'react-native-reanimated';      // <-- must be SECOND!
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import StackNavigator from './src/navigation/StackNavigator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import { Provider as PaperProvider } from 'react-native-paper';
import { CalendarProvider } from './src/contexts/CalendarContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

// Full deep linking configuration
const linking = {
  prefixes: [
    Linking.createURL('/'),
    'lpai://',
  ],
  config: {
    screens: {
      // Auth Stack
      Login: 'login',
      SetupAccount: {
        path: 'setup-account',
        parse: {
          token: (token) => token,
        },
      },
      
      // Main App Stack (add these back for full navigation)
      Main: {
        screens: {
          Dashboard: 'dashboard',
          Calendar: 'calendar',
          Contacts: {
            path: 'contacts',
            screens: {
              ContactList: '',
              ContactDetail: ':id',
            },
          },
          Projects: {
            path: 'projects',
            screens: {
              ProjectList: '',
              ProjectDetail: ':id',
            },
          },
          Quotes: {
            path: 'quotes',
            screens: {
              QuoteList: '',
              QuoteDetail: ':id',
              QuoteSign: ':id/sign',
            },
          },
        },
      },
    },
  },
};

export default function App() {
  useEffect(() => {
    // Handle deep links while app is running
    const handleDeepLink = (url) => {
      console.log('Deep link received:', url);
    };

    const linkingListener = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('App opened with URL:', url);
      }
    });

    return () => {
      linkingListener.remove();
    };
  }, []);

  useEffect(() => {
    // Request notification permissions when app starts
    (async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Push notification permissions not granted');
      } else {
        console.log('✅ Push notification permissions granted');
        
        // Get the Expo push token (optional - for remote push notifications)
        try {
          const token = await Notifications.getExpoPushTokenAsync();
          console.log('📱 Expo Push Token:', token.data);
          // You can save this token to your backend if needed
        } catch (error) {
          console.log('Failed to get push token:', error);
        }
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <NavigationContainer linking={linking}>
            <AuthProvider>
              <CalendarProvider>
                <StackNavigator />
              </CalendarProvider>
            </AuthProvider>
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}