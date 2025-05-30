import 'react-native-gesture-handler'; // <-- must be FIRST!
import 'react-native-reanimated';      // <-- must be SECOND!
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import StackNavigator from './src/navigation/StackNavigator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import { Provider as PaperProvider } from 'react-native-paper';
import { CalendarProvider } from './src/contexts/CalendarContext'; 


export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <NavigationContainer>
          <AuthProvider>
            <CalendarProvider>
              <StackNavigator />
            </CalendarProvider>
          </AuthProvider>
        </NavigationContainer>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
