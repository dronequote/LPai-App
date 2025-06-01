// src/utils/sync/syncUsers.ts
import axios from 'axios';
import { Db } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';
import bcrypt from 'bcryptjs';

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
          skip: 0,
          limit: 100  // Adjust if location has more users
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
          roles: ghlUser.roles || [],
          
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
          // Create new user
          // Generate a temporary password (they'll need to reset it)
          const tempPassword = generateTempPassword();
          const hashedPassword = await bcrypt.hash(tempPassword, 10);
          
          await db.collection('users').insertOne({
            ...userData,
            hashedPassword,
            needsPasswordReset: true,
            createdAt: new Date(),
            createdBySync: true,
            preferences: {
              notifications: true,
              defaultCalendarView: 'week',
              emailSignature: ''
            }
          });
          created++;
          console.log(`[Sync Users] Created user: ${userData.email} (needs password reset)`);
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
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied - check permissions for users');
    }
    
    throw error;
  }
}

// Helper function to map GHL roles to our system roles
function mapGHLRole(ghlRole: string): string {
  if (!ghlRole) return 'user';
  
  const roleLower = ghlRole.toLowerCase();
  
  if (roleLower.includes('admin') || roleLower.includes('agency')) {
    return 'admin';
  }
  if (roleLower.includes('user') || roleLower.includes('employee')) {
    return 'user';
  }
  if (roleLower.includes('viewer') || roleLower.includes('read')) {
    return 'viewer';
  }
  
  return 'user';  // Default role
}

// Helper function to map GHL permissions to our system
function mapGHLPermissions(ghlPermissions: any[]): string[] {
  const permissions: string[] = ['read'];  // Everyone can read by default
  
  if (!ghlPermissions || !Array.isArray(ghlPermissions)) {
    return permissions;
  }
  
  // Check for specific permissions
  const hasWrite = ghlPermissions.some((p: any) => 
    typeof p === 'string' ? p.includes('write') || p.includes('create') || p.includes('update') : false
  );
  
  const hasDelete = ghlPermissions.some((p: any) => 
    typeof p === 'string' ? p.includes('delete') || p.includes('remove') : false
  );
  
  const hasManage = ghlPermissions.some((p: any) => 
    typeof p === 'string' ? p.includes('manage') || p.includes('admin') : false
  );
  
  if (hasWrite) permissions.push('write');
  if (hasDelete) permissions.push('delete');
  if (hasManage) {
    permissions.push('manage_users', 'manage_settings');
  }
  
  return [...new Set(permissions)];  // Remove duplicates
}

// Helper function to generate temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}