// lpai-backend/pages/api/users/[userId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Default preferences for all users
const DEFAULT_USER_PREFERENCES = {
  // Display & UI
  notifications: true,
  defaultCalendarView: 'week',
  emailSignature: '',
  theme: 'system',
  
  // Localization
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver',
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query;
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid userId' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return await getUser(db, userId, res);
    case 'PATCH':
      return await updateUser(db, userId, req.body, res);
    default:
      res.setHeader('Allow', ['GET', 'PATCH']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// 📋 GET: Fetch user details
async function getUser(db: any, userId: string, res: NextApiResponse) {
  try {
    let user;
    
    // Try to find by ObjectId first, then by userId field
    if (ObjectId.isValid(userId)) {
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    }
    
    if (!user) {
      user = await db.collection('users').findOne({ userId: userId });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Merge default preferences with user preferences
    if (!user.preferences) {
      user.preferences = DEFAULT_USER_PREFERENCES;
    } else {
      // Deep merge to ensure all new fields have defaults
      user.preferences = deepMergePreferences(DEFAULT_USER_PREFERENCES, user.preferences);
    }
    
    console.log(`[USERS API] Fetched user: ${user.name} (${user.email})`);
    return res.status(200).json(user);
    
  } catch (error) {
    console.error('[USERS API] Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
}

// ✏️ PATCH: Update user (mainly for preferences)
async function updateUser(db: any, userId: string, body: any, res: NextApiResponse) {
  try {
    console.log('[USERS API] Update request for userId:', userId);
    console.log('[USERS API] Update body:', JSON.stringify(body, null, 2));
    
    const { preferences, ...otherUpdates } = body;
    
    let updateData: any = {};
    
    // First, find the user to make sure they exist
    let currentUser;
    
    // Try multiple ways to find the user
    if (ObjectId.isValid(userId) && userId.length === 24) {
      console.log('[USERS API] Searching by ObjectId...');
      currentUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    }
    
    if (!currentUser) {
      console.log('[USERS API] Searching by userId field...');
      currentUser = await db.collection('users').findOne({ userId: userId });
    }
    
    if (!currentUser) {
      console.log('[USERS API] Searching by ghlUserId field...');
      currentUser = await db.collection('users').findOne({ ghlUserId: userId });
    }
    
    if (!currentUser) {
      console.log('[USERS API] User not found with any method');
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('[USERS API] Found user:', currentUser.email);
    
    // Handle preferences update with deep merge
    if (preferences) {
      // Deep merge existing preferences with new ones
      const existingPreferences = currentUser.preferences || DEFAULT_USER_PREFERENCES;
      updateData.preferences = deepMergePreferences(existingPreferences, preferences);
    }
    
    // Handle other field updates
    if (otherUpdates.name) updateData.name = otherUpdates.name;
    if (otherUpdates.phone) updateData.phone = otherUpdates.phone;
    if (otherUpdates.avatar) updateData.avatar = otherUpdates.avatar;
    if (otherUpdates.firstName) updateData.firstName = otherUpdates.firstName;
    if (otherUpdates.lastName) updateData.lastName = otherUpdates.lastName;
    if (otherUpdates.email) updateData.email = otherUpdates.email;
    
    // Add timestamp
    updateData.updatedAt = new Date().toISOString();
    
    // Update using the _id we found
    const result = await db.collection('users').updateOne(
      { _id: currentUser._id },
      { $set: updateData }
    );

    if (!result.modifiedCount && !result.matchedCount) {
      console.log('[USERS API] Update failed - no documents matched');
      return res.status(500).json({ error: 'Failed to update user' });
    }
    
    console.log(`[USERS API] Successfully updated user with matchedCount: ${result.matchedCount}, modifiedCount: ${result.modifiedCount}`);

    // Fetch the updated user
    const updatedUser = await db.collection('users').findOne({ _id: currentUser._id });

    if (!updatedUser) {
      console.log('[USERS API] Update succeeded but could not fetch updated user');
      return res.status(500).json({ error: 'Update succeeded but could not fetch updated user' });
    }

    console.log(`[USERS API] Successfully updated user: ${updatedUser.name}`);
    return res.status(200).json(updatedUser);
    
  } catch (error) {
    console.error('[USERS API] Error updating user:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
}

// Helper function to deep merge preferences
function deepMergePreferences(defaults: any, updates: any): any {
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