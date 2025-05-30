// src/config/navigationConfig.ts
export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  screen: string; // The actual screen name in navigation
  availableInBottomNav: boolean;
  requiresRole?: string[]; // Optional: restrict by role
  badge?: () => number; // Optional: for notification badges
  type?: 'tab' | 'stack'; // Add this to differentiate navigation types
}

export const NAVIGATION_ITEMS: Record<string, NavigationItem> = {
  home: {
    id: 'home',
    label: 'Home',
    icon: 'home',
    screen: 'Dashboard',
    availableInBottomNav: true,
    type: 'tab',
  },
  calendar: {
    id: 'calendar',
    label: 'Calendar',
    icon: 'calendar',
    screen: 'Calendar',
    availableInBottomNav: true,
    type: 'tab',
  },
  contacts: {
    id: 'contacts',
    label: 'Contacts',
    icon: 'people',
    screen: 'Contacts',
    availableInBottomNav: true,
    type: 'tab',
  },
  projects: {
    id: 'projects',
    label: 'Projects',
    icon: 'briefcase',
    screen: 'ProjectsStack', // Changed to stack screen name
    availableInBottomNav: true,
    type: 'stack',
  },
  quotes: {
    id: 'quotes',
    label: 'Quotes',
    icon: 'document-text',
    screen: 'QuotesStack', // Changed to stack screen name
    availableInBottomNav: true,
    type: 'stack',
  },
  conversation: {
    id: 'conversation',
    label: 'Conversation',
    icon: 'chatbubbles',
    screen: 'ConversationStack', // Changed to stack screen name
    availableInBottomNav: false,
    type: 'stack',
  },
  jobCompletion: {
    id: 'jobCompletion',
    label: 'Job Completion',
    icon: 'checkmark-done-circle',
    screen: 'JobCompletionStack', // Changed to stack screen name
    availableInBottomNav: false,
    type: 'stack',
  },
  team: {
    id: 'team',
    label: 'Team',
    icon: 'people-circle',
    screen: 'TeamScreen',
    availableInBottomNav: false,
    requiresRole: ['admin', 'manager'],
    type: 'stack',
  },
  productLibrary: {
    id: 'productLibrary',
    label: 'Product Library',
    icon: 'pricetag',
    screen: 'ProductLibraryScreen',
    availableInBottomNav: false,
    type: 'stack',
  },
  templates: {
    id: 'templates',
    label: 'Templates',
    icon: 'document-duplicate',
    screen: 'TemplatesScreen',
    availableInBottomNav: false,
    type: 'stack',
  },
};

// Default navigation order (excluding 'more' which is always last)
export const DEFAULT_NAV_ORDER = ['home', 'quotes', 'projects'];

// More menu always shows at the end
export const MORE_TAB = {
  id: 'more',
  label: 'More',
  icon: 'menu',
  screen: 'More',
};