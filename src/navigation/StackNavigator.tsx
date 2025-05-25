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
import ConversationScreen from '../screens/ConversationScreen';
import JobCompletionScreen from '../screens/JobCompletionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationScreen from '../screens/NotificationScreen';
import AddContactScreen from '../screens/AddContactScreen';
import ContactDetailScreen from '../screens/ContactDetailScreen';
import AppointmentDetail from '../screens/AppointmentDetail';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import QuoteBuilderScreen from '../screens/QuoteBuilderScreen';
import QuoteEditorScreen from '../screens/QuoteEditorScreen';
import { Contact, Project, Quote } from '../../packages/types/dist'; // ✅ ADDED Quote import

export type RootStackParamList = {
  AuthMethodScreen: undefined;
  Login: undefined;
  Home: undefined;
  Calendar: undefined;
  Contacts: undefined;
  Projects: undefined;
  Conversations: undefined;
  JobCompletion: undefined;
  Profile: undefined;
  Notifications: undefined;
  AddContactScreen: undefined;
  ContactDetailScreen: { contact: Contact };
  AppointmentDetail: { appointmentId: string };
  ProjectDetailScreen: { project: Project };
  QuoteBuilder: undefined;
  QuoteEditor: { 
    mode: 'create' | 'edit'; 
    project?: Project; 
    quote?: Quote; // ✅ NOW Quote is imported
  };
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
      <Stack.Screen name="Conversations" component={ConversationScreen} />
      <Stack.Screen name="JobCompletion" component={JobCompletionScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="AddContactScreen" component={AddContactScreen} />
      <Stack.Screen name="ContactDetailScreen" component={ContactDetailScreen} /> 
      <Stack.Screen name="AppointmentDetail" component={AppointmentDetail} />
      <Stack.Screen name="ProjectDetailScreen" component={ProjectDetailScreen} />
      <Stack.Screen name="QuoteBuilder" component={QuoteBuilderScreen} />
      <Stack.Screen name="QuoteEditor" component={QuoteEditorScreen} />
    </Stack.Navigator>
  );
}