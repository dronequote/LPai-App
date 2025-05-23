import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';

// Screens
import AuthMethodScreen from '../screens/AuthMethodScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import CalendarScreen from '../screens/CalendarScreen';
import QuoteBuilderScreen from '../screens/QuoteBuilderScreen';
import ConversationScreen from '../screens/ConversationScreen';
import JobCompletionScreen from '../screens/JobCompletionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationScreen from '../screens/NotificationScreen';
import AddContactScreen from '../screens/AddContactScreen';
import EditContactScreen from '../screens/EditContactScreen'; // ✅ NEW

import { Contact } from '../../packages/types/dist'; // ✅ for type-safe route param

export type RootStackParamList = {
  AuthMethodScreen: undefined;
  Login: undefined;
  Home: undefined;
  Calendar: undefined;
  Contacts: undefined;
  Projects: undefined;
  QuoteBuilder: undefined;
  Conversations: undefined;
  JobCompletion: undefined;
  Profile: undefined;
  Notifications: undefined;
  AddContactScreen: undefined;
  EditContact: { contact: Contact }; // ✅ ADDED
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function StackNavigator() {
  const { token, loading } = useAuth();

  if (loading) return null;

  return (
    <Stack.Navigator
      initialRouteName={token ? 'Home' : 'AuthMethodScreen'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="AuthMethodScreen" component={AuthMethodScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="Contacts" component={ContactsScreen} />
      <Stack.Screen name="Projects" component={ProjectsScreen} />
      <Stack.Screen name="QuoteBuilder" component={QuoteBuilderScreen} />
      <Stack.Screen name="Conversations" component={ConversationScreen} />
      <Stack.Screen name="JobCompletion" component={JobCompletionScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="AddContactScreen" component={AddContactScreen} />
      <Stack.Screen name="EditContact" component={EditContactScreen} /> 
    </Stack.Navigator>
  );
}
