// src/navigation/StackNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';

// Import BottomTabNavigator
import BottomTabNavigator from './BottomTabNavigator';

// Auth Screens
import AuthMethodScreen from '../screens/AuthMethodScreen';
import LoginScreen from '../screens/LoginScreen';

// All other screens that can be navigated to
import ContactDetailScreen from '../screens/ContactDetailScreen';
import AppointmentDetail from '../screens/AppointmentDetail';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import QuoteBuilderScreen from '../screens/QuoteBuilderScreen';
import QuoteEditorScreen from '../screens/QuoteEditorScreen';
import QuotePresentationScreen from '../screens/QuotePresentationScreen';
import SignatureScreen from '../screens/SignatureScreen';
import PaymentWebView from '../screens/PaymentWebView';
import AddContactScreen from '../screens/AddContactScreen';

// Screens that can be accessed from More menu
import ContactsScreen from '../screens/ContactsScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationScreen from '../screens/NotificationScreen';
import ProjectsScreen from '../screens/ProjectsScreen';

// Import placeholder for screens that don't exist yet
import PlaceholderScreen from '../screens/PlaceholderScreen';

// Check if these exist, otherwise use PlaceholderScreen
import ConversationScreen from '../screens/ConversationScreen';
import JobCompletionScreen from '../screens/JobCompletionScreen';

// Types
import { Contact, Project, Quote } from '../../packages/types/dist';

interface QuoteTemplate {
  _id: string;
  name: string;
  description: string;
  category?: string;
  preview?: string;
  isDefault?: boolean;
  isGlobal: boolean;
  styling: {
    primaryColor: string;
    accentColor: string;
    fontFamily?: string;
    layout?: string;
  };
  companyOverrides: {
    name?: string;
    logo?: string;
    tagline?: string;
    phone?: string;
    email?: string;
    address?: string;
    establishedYear?: string;
    warrantyYears?: string;
  };
  tabs: Array<{
    id: string;
    title: string;
    icon: string;
    enabled: boolean;
    order: number;
    blocks: Array<{
      id: string;
      type: string;
      position: number;
      content: any;
    }>;
  }>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export type RootStackParamList = {
  // Auth screens
  AuthMethodScreen: undefined;
  Login: undefined;
  
  // Main app (with bottom tabs)
  Main: undefined;
  
  // Stack screens from navigation config
  ProjectsStack: undefined;
  QuotesStack: undefined;
  ConversationStack: undefined;
  JobCompletionStack: undefined;
  
  // Settings/Profile screens
  ProfileScreen: undefined;
  NotificationScreen: undefined;
  SettingsScreen: undefined;
  TeamScreen: undefined;
  ProductLibraryScreen: undefined;
  TemplatesScreen: undefined;
  HelpScreen: undefined;
  ContactSupportScreen: undefined;
  AboutScreen: undefined;
  ThemesScreen: undefined;
  
  // Detail screens (no bottom tabs)
  AddContactScreen: undefined;
  ContactDetailScreen: { contact: Contact };
  AppointmentDetail: { appointmentId: string };
  ProjectDetailScreen: { project: Project };
  QuoteBuilder: undefined;
  QuoteEditor: { 
    mode: 'create' | 'edit'; 
    project?: Project; 
    quote?: Quote;
  };
  QuotePresentation: {
    quoteId?: string;
    template: QuoteTemplate;
    quote?: Quote;
  };
  SignatureScreen: {
    quote: Quote;
    template: QuoteTemplate;
  };
  PaymentWebView: {
    paymentUrl: string;
    paymentId: string;
    amount: number;
    onSuccess?: () => void;
    onCancel?: () => void;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function StackNavigator() {
  const { token, loading } = useAuth();

  if (loading) return null;

  return (
    <Stack.Navigator
      initialRouteName={token ? 'Main' : 'AuthMethodScreen'}
      screenOptions={{ headerShown: false }}
    >
      {!token ? (
        // Auth Stack
        <>
          <Stack.Screen name="AuthMethodScreen" component={AuthMethodScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      ) : (
        // Main App Stack
        <>
          {/* Main app with bottom navigation */}
          <Stack.Screen 
            name="Main" 
            component={BottomTabNavigator}
            options={{ headerShown: false }}
          />
          
          {/* Stack screens that can be navigated from More menu or bottom nav */}
          <Stack.Screen 
            name="ProjectsStack" 
            component={ProjectsScreen}
            options={{ 
              headerShown: true,
              title: 'Projects',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="QuotesStack" 
            component={QuoteBuilderScreen}
            options={{ 
              headerShown: true,
              title: 'Quotes',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="ConversationStack" 
            component={ConversationScreen}
            options={{ 
              headerShown: true,
              title: 'Conversations',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="JobCompletionStack" 
            component={JobCompletionScreen}
            options={{ 
              headerShown: true,
              title: 'Job Completion',
              headerBackTitle: 'Back'
            }}
          />
          
          {/* Profile/Settings screens */}
          <Stack.Screen 
            name="ProfileScreen" 
            component={ProfileScreen}
            options={{ 
              headerShown: true,
              title: 'Profile',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="NotificationScreen" 
            component={NotificationScreen}
            options={{ 
              headerShown: true,
              title: 'Notifications',
              headerBackTitle: 'Back'
            }}
          />
          
          {/* Placeholder screens */}
          <Stack.Screen 
            name="SettingsScreen" 
            component={PlaceholderScreen}
            options={{ 
              headerShown: true,
              title: 'Settings',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="TeamScreen" 
            component={PlaceholderScreen}
            options={{ 
              headerShown: true,
              title: 'Team',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="ProductLibraryScreen" 
            component={PlaceholderScreen}
            options={{ 
              headerShown: true,
              title: 'Product Library',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="TemplatesScreen" 
            component={PlaceholderScreen}
            options={{ 
              headerShown: true,
              title: 'Templates',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="HelpScreen" 
            component={PlaceholderScreen}
            options={{ 
              headerShown: true,
              title: 'Help Center',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="ContactSupportScreen" 
            component={PlaceholderScreen}
            options={{ 
              headerShown: true,
              title: 'Contact Support',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="AboutScreen" 
            component={PlaceholderScreen}
            options={{ 
              headerShown: true,
              title: 'About',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="ThemesScreen" 
            component={PlaceholderScreen}
            options={{ 
              headerShown: true,
              title: 'Themes',
              headerBackTitle: 'Back'
            }}
          />
          
          {/* Detail screens - these show without bottom nav */}
          <Stack.Screen 
            name="AddContactScreen" 
            component={AddContactScreen}
            options={{ 
              headerShown: true,
              title: 'Add Contact',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="ContactDetailScreen" 
            component={ContactDetailScreen}
            options={{ 
              headerShown: true,
              title: 'Contact Details',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="AppointmentDetail" 
            component={AppointmentDetail}
            options={{ 
              headerShown: true,
              title: 'Appointment Details',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="ProjectDetailScreen" 
            component={ProjectDetailScreen}
            options={{ 
              headerShown: true,
              title: 'Project Details',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="QuoteBuilder" 
            component={QuoteBuilderScreen}
            options={{ 
              headerShown: true,
              title: 'Create Quote',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="QuoteEditor" 
            component={QuoteEditorScreen}
            options={{ 
              headerShown: true,
              title: 'Edit Quote',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="QuotePresentation" 
            component={QuotePresentationScreen}
            options={{ 
              headerShown: true,
              title: 'Quote',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="SignatureScreen" 
            component={SignatureScreen}
            options={{ 
              headerShown: true,
              title: 'Sign Quote',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="PaymentWebView" 
            component={PaymentWebView}
            options={{ 
              headerShown: true,
              title: 'Payment',
              headerBackTitle: 'Back'
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}