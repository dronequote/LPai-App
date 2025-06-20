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