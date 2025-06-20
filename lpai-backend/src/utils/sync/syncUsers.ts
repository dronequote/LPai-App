// src/utils/sync/syncUsers.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';
import bcrypt from 'bcryptjs';
import { generateSecureToken } from '../security/tokenGenerator';
import { sendWelcomeEmail } from '../email/welcomeEmail';

/**
* Generate a temporary password for new users
*/
function generateTempPassword(): string {
 return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
}

/**
* Map GHL role to our system role
*/
function mapGHLRole(ghlRole: string): string {
 const roleMap: Record<string, string> = {
   'admin': 'admin',
   'user': 'user',
   'agency': 'admin',
   'account': 'user'
 };
 
 return roleMap[ghlRole?.toLowerCase()] || 'user';
}

/**
* Map GHL permissions to our system
*/
function mapGHLPermissions(ghlPermissions: string[]): string[] {
 if (!ghlPermissions || !Array.isArray(ghlPermissions)) {
   return ['read'];
 }
 
 // Map GHL permissions to our simplified set
 const permissions = new Set<string>();
 
 ghlPermissions.forEach(perm => {
   if (perm.includes('write') || perm.includes('create') || perm.includes('update') || perm.includes('delete')) {
     permissions.add('write');
   }
   permissions.add('read');
 });
 
 return Array.from(permissions);
}

/**
* Get default user preferences
*/
function getDefaultPreferences() {
 return {
   notifications: true,
   defaultCalendarView: 'week',
   emailSignature: '',
   theme: 'system',
   timezone: 'America/Denver',
   dateFormat: 'MM/DD/YYYY',
   timeFormat: '12h',
   firstDayOfWeek: 0,
   language: 'en',
   workingHours: {
     enabled: true,
     start: '09:00',
     end: '17:00',
     days: [1, 2, 3, 4, 5]
   },
   appointmentReminders: {
     enabled: true,
     minutesBefore: 15
   },
   defaultAppointmentDuration: 60,
   navigatorOrder: ['home', 'calendar', 'contacts'],
   defaultHomeScreen: 'dashboard',
   hiddenNavItems: [],
   showHomeLabel: false,
   communication: {
     phoneProvider: 'ghl_twilio',
     defaultPhoneNumber: '',
     showCallButton: true,
     autoLogCalls: true,
     smsProvider: 'ghl_twilio',
     smsSignature: '',
     smsTemplatesEnabled: true,
     autoLogSms: true,
     emailProvider: 'default',
     emailTracking: false,
     emailTemplatesEnabled: true,
     autoLogEmails: false,
     videoProvider: 'googlemeet',
     defaultMeetingDuration: 30,
     preferredContactMethod: 'phone',
     communicationHours: {
       enabled: false,
       start: '09:00',
       end: '18:00',
       days: [1, 2, 3, 4, 5],
       timezone: 'America/Denver'
     }
   },
   business: {
     defaultProjectStatus: 'open',
     autoSaveQuotes: true,
     quoteExpirationDays: 30,
     signature: {
       type: 'text',
       value: ''
     },
     defaultTaxRate: 0,
     measurementUnit: 'imperial'
   },
   privacy: {
     showPhoneNumber: true,
     showEmail: true,
     activityTracking: true,
     dataRetentionDays: null
   },
   mobile: {
     offlineMode: true,
     syncOnWifiOnly: false,
     compressImages: true,
     biometricLogin: false,
     stayLoggedIn: true
   }
 };
}

/**
* Sync users from GHL to MongoDB
*/
export async function syncUsers(db: Db, location: any) {
 const startTime = Date.now();
 console.log(`[Sync Users] Starting for ${location.locationId}`);

 try {
   // Get auth header (OAuth or API key)
   const auth = await getAuthHeader(location);
   
   // Fetch users from GHL
   const response = await axios.get(
     'https://services.leadconnectorhq.com/users/',
     {
       headers: {
         'Authorization': auth.header,
         'Version': '2021-07-28',
         'Accept': 'application/json'
       },
       params: {
         locationId: location.locationId
       }
     }
   );

   const ghlUsers = response.data.users || [];
   console.log(`[Sync Users] Found ${ghlUsers.length} users in GHL`);

   // Process each user
   let created = 0;
   let updated = 0;
   let skipped = 0;

   for (const ghlUser of ghlUsers) {
     try {
       // Check if user exists
       const existingUser = await db.collection('users').findOne({
         $or: [
           { ghlUserId: ghlUser.id },
           { email: ghlUser.email, locationId: location.locationId }
         ]
       });

       // Prepare user data
       const userData = {
         // GHL Fields
         ghlUserId: ghlUser.id,
         locationId: location.locationId,
         
         // Basic Info
         email: ghlUser.email,
         name: ghlUser.name || `${ghlUser.firstName || ''} ${ghlUser.lastName || ''}`.trim(),
         firstName: ghlUser.firstName || '',
         lastName: ghlUser.lastName || '',
         phone: ghlUser.phone || '',
         
         // Profile
         avatar: ghlUser.avatar || '',
         
         // Role & Permissions
         role: mapGHLRole(ghlUser.role || ghlUser.roles?.[0]),
         permissions: mapGHLPermissions(ghlUser.permissions || []),
         roles: ghlUser.roles || {
           type: 'account',
           role: mapGHLRole(ghlUser.role || ghlUser.roles?.[0]),
           locationIds: [location.locationId]
         },
         
         // Status
         isActive: ghlUser.deleted !== true && ghlUser.status !== 'inactive',
         
         // GHL Specific Fields
         extension: ghlUser.extension || '',
         dateAdded: ghlUser.dateAdded ? new Date(ghlUser.dateAdded) : null,
         lastLogin: ghlUser.lastLogin ? new Date(ghlUser.lastLogin) : null,
         
         // Sync Metadata
         lastSyncedAt: new Date(),
         updatedAt: new Date()
       };

       if (existingUser) {
         // Update existing user
         await db.collection('users').updateOne(
           { _id: existingUser._id },
           { 
             $set: userData,
             $setOnInsert: { createdAt: new Date() }
           }
         );
         updated++;
         console.log(`[Sync Users] Updated user: ${userData.email}`);
       } else {
         // Create new user with setup token approach
         const setupToken = generateSecureToken();
         const setupTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
         
         const newUser = {
           _id: new ObjectId(),
           ...userData,
           setupToken,
           setupTokenExpiry,
           needsSetup: true,
           hashedPassword: null, // No password yet
           needsPasswordReset: false,
           createdAt: new Date(),
           createdBySync: true,
           onboardingStatus: 'pending',
           preferences: getDefaultPreferences(),
           requiresReauth: false
         };

         await db.collection('users').insertOne(newUser);
         
         // Send welcome email with setup link
         try {
           await sendWelcomeEmail({
             email: ghlUser.email,
             firstName: ghlUser.firstName || 'User',
             locationName: location.name,
             setupToken,
             setupUrl: `${process.env.APP_URL || 'https://lpai.app'}/setup-account?token=${setupToken}`
           });
           console.log(`[Sync Users] Welcome email sent to: ${userData.email}`);
         } catch (emailError) {
           console.error(`[Sync Users] Failed to send welcome email to ${userData.email}:`, emailError);
           // Don't fail the user creation if email fails
         }
         
         created++;
         console.log(`[Sync Users] Created user with setup token: ${userData.email}`);
       }
     } catch (userError: any) {
       console.error(`[Sync Users] Error processing user ${ghlUser.email}:`, userError.message);
       skipped++;
     }
   }

   // Get final user count
   const totalUsers = await db.collection('users').countDocuments({ 
     locationId: location.locationId 
   });

   const duration = Date.now() - startTime;
   console.log(`[Sync Users] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

   return {
     success: true,
     created,
     updated,
     skipped,
     total: totalUsers,
     ghlUserCount: ghlUsers.length,
     duration: `${duration}ms`
   };

 } catch (error: any) {
   console.error(`[Sync Users] Error:`, error.response?.data || error.message);
   
   // Handle specific error cases
   if (error.response?.status === 404) {
     console.log(`[Sync Users] Users endpoint not found`);
     return {
       success: false,
       created: 0,
       updated: 0,
       skipped: 0,
       total: 0,
       error: 'Users endpoint not found'
     };
   }

   if (error.response?.status === 401) {
     console.log(`[Sync Users] Authentication failed`);
     return {
       success: false,
       created: 0,
       updated: 0,
       skipped: 0,
       total: 0,
       error: 'Authentication failed'
     };
   }

   throw error;
 }
}