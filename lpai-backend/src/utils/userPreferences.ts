// lpai-backend/src/utils/userPreferences.ts
// Create this new file for shared preference utilities

// Default preferences for all users
export const DEFAULT_USER_PREFERENCES = {
  // Display & UI
  notifications: true,
  defaultCalendarView: 'week',
  emailSignature: '',
  theme: 'system',
  
  // Localization
  timezone: 'America/Denver', // Default timezone
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  firstDayOfWeek: 0, // Sunday
  language: 'en',
  
  // Calendar & Scheduling
  workingHours: {
    enabled: true,
    start: '09:00',
    end: '17:00',
    days: [1, 2, 3, 4, 5], // Mon-Fri
  },
  appointmentReminders: {
    enabled: true,
    minutesBefore: 15,
  },
  defaultAppointmentDuration: 60,
  
  // Navigation & Workflow
  navigatorOrder: ['home', 'calendar', 'contacts'],
  defaultHomeScreen: 'dashboard',
  hiddenNavItems: [],
  showHomeLabel: false,
  
  // Communication Settings
  communication: {
    // Phone
    phoneProvider: 'native',
    defaultPhoneNumber: '',
    showCallButton: true,
    autoLogCalls: false,
    
    // SMS
    smsProvider: 'native',
    smsSignature: '',
    smsTemplatesEnabled: true,
    autoLogSms: false,
    
    // Email
    emailProvider: 'default',
    emailTracking: false,
    emailTemplatesEnabled: true,
    autoLogEmails: false,
    
    // Video
    videoProvider: 'googlemeet',
    defaultMeetingDuration: 30,
    
    // General
    preferredContactMethod: 'phone',
    communicationHours: {
      enabled: false,
      start: '09:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5],
      timezone: 'America/Denver',
    },
  },
  
  // Business Settings
  business: {
    defaultProjectStatus: 'open',
    autoSaveQuotes: true,
    quoteExpirationDays: 30,
    signature: {
      type: 'text',
      value: '',
    },
    defaultTaxRate: 0,
    measurementUnit: 'imperial',
  },
  
  // Privacy & Security
  privacy: {
    showPhoneNumber: true,
    showEmail: true,
    activityTracking: true,
    dataRetentionDays: null,
  },
  
  // Mobile Settings
  mobile: {
    offlineMode: true,
    syncOnWifiOnly: false,
    compressImages: true,
    biometricLogin: false,
    stayLoggedIn: true,
  },
};

// Helper function to deep merge preferences
export function deepMergePreferences(defaults: any, updates: any): any {
  const result = { ...defaults };
  
  for (const key in updates) {
    if (updates[key] !== undefined) {
      if (typeof updates[key] === 'object' && !Array.isArray(updates[key]) && updates[key] !== null) {
        // If it's an object, recursively merge
        result[key] = deepMergePreferences(defaults[key] || {}, updates[key]);
      } else {
        // Otherwise, use the update value
        result[key] = updates[key];
      }
    }
  }
  
  return result;
}

// Function to ensure user has all preference fields
export function ensureUserPreferences(userPreferences?: any): any {
  if (!userPreferences) {
    return DEFAULT_USER_PREFERENCES;
  }
  return deepMergePreferences(DEFAULT_USER_PREFERENCES, userPreferences);
}