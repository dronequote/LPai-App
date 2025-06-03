// src/utils/sync/syncContacts.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

interface SyncOptions {
  limit?: number;
  offset?: number;
  fullSync?: boolean;
}

export async function syncContacts(db: Db, location: any, options: SyncOptions = {}) {
  const startTime = Date.now();
  const { limit = 100, offset = 0, fullSync = false } = options;
  
  console.log(`[Sync Contacts] Starting for ${location.locationId} - Limit: ${limit}, Offset: ${offset}`);
  
  // If this is the initial call and we want a full sync, handle pagination automatically
  if (fullSync && offset === 0) {
    console.log(`[Sync Contacts] Full sync requested - will fetch all contacts in batches`);
    
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let currentOffset = 0;
    let hasMoreData = true;
    const allErrors: any[] = [];
    
    while (hasMoreData) {
      console.log(`[Sync Contacts] Fetching batch at offset ${currentOffset}...`);
      
      const batchResult = await syncContacts(db, location, {
        limit: 250, // Process 250 at a time for faster initial sync
        offset: currentOffset,
        fullSync: false // Prevent recursion
      });
      
      totalCreated += batchResult.created;
      totalUpdated += batchResult.updated;
      totalSkipped += batchResult.skipped;
      
      if (batchResult.errors) {
        allErrors.push(...batchResult.errors);
      }
      
      hasMoreData = batchResult.hasMore || false;
      currentOffset = batchResult.nextOffset || currentOffset + limit;
      
      // Add a small delay to avoid rate limiting (only wait if we have more than 1000 contacts)
      if (hasMoreData && currentOffset > 1000) {
        console.log(`[Sync Contacts] Large dataset detected, waiting 1 second before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const totalDuration = Date.now() - startTime;
    console.log(`[Sync Contacts] Full sync completed in ${totalDuration}ms`);
    
    return {
      success: true,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      processed: totalCreated + totalUpdated + totalSkipped,
      totalInGHL: totalCreated + totalUpdated + totalSkipped,
      hasMore: false,
      errors: allErrors.length > 0 ? allErrors : undefined,
      duration: `${totalDuration}ms`,
      fullSyncCompleted: true
    };
  }

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Fetch contacts from GHL
    const response = await axios.get(
      'https://services.leadconnectorhq.com/contacts/',
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        },
        params: {
          locationId: location.locationId,  // ✅ FIXED: Added locationId
          limit,
          skip: offset
        }
      }
    );

    const ghlContacts = response.data.contacts || [];
    const totalCount = response.data.total || response.data.count || ghlContacts.length;
    
    console.log(`[Sync Contacts] Found ${ghlContacts.length} contacts (Total: ${totalCount})`);

    // Process each contact
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const ghlContact of ghlContacts) {
      try {
        // Check if contact exists
        const existingContact = await db.collection('contacts').findOne({
          $or: [
            { ghlContactId: ghlContact.id },
            { 
              email: ghlContact.email, 
              locationId: location.locationId 
            }
          ]
        });

        // Prepare contact data
        const contactData = {
          // GHL Integration
          ghlContactId: ghlContact.id,
          locationId: location.locationId,
          
          // Basic Information
          firstName: ghlContact.firstName || '',
          lastName: ghlContact.lastName || '',
          fullName: ghlContact.fullName || `${ghlContact.firstName || ''} ${ghlContact.lastName || ''}`.trim(),
          email: ghlContact.email || '',
          phone: ghlContact.phone || '',
          
          // Additional Contact Info
          secondaryPhone: ghlContact.additionalPhones?.[0] || '',
          
          // Address Information
          address: ghlContact.address1 || '',
          city: ghlContact.city || '',
          state: ghlContact.state || '',
          country: ghlContact.country || 'US',
          postalCode: ghlContact.postalCode || '',
          
          // Business Information
          companyName: ghlContact.companyName || '',
          website: ghlContact.website || '',
          
          // Personal Information
          dateOfBirth: ghlContact.dateOfBirth ? new Date(ghlContact.dateOfBirth) : null,
          
          // Communication Preferences
          dnd: ghlContact.dnd || false,
          dndSettings: ghlContact.dndSettings || {},
          
          // Tags and Source
          tags: Array.isArray(ghlContact.tags) ? ghlContact.tags : [],
          source: ghlContact.source || ghlContact.contactSource || '',
          
          // Notes
          notes: ghlContact.notes || '',
          
          // Custom Fields (store all of them)
          customFields: ghlContact.customFields || [],
          
          // GHL Metadata
          ghlCreatedAt: ghlContact.dateAdded ? new Date(ghlContact.dateAdded) : null,
          ghlUpdatedAt: ghlContact.dateUpdated ? new Date(ghlContact.dateUpdated) : null,
          
          // Sync Metadata
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        };

        if (existingContact) {
          // Update existing contact
          await db.collection('contacts').updateOne(
            { _id: existingContact._id },
            { 
              $set: contactData,
              $setOnInsert: { createdAt: new Date() }
            }
          );
          updated++;
        } else {
          // Create new contact
          await db.collection('contacts').insertOne({
            _id: new ObjectId(),
            ...contactData,
            createdAt: new Date(),
            createdBySync: true
          });
          created++;
        }
        
      } catch (contactError: any) {
        console.error(`[Sync Contacts] Error processing contact ${ghlContact.email || ghlContact.id}:`, contactError.message);
        errors.push({
          contactId: ghlContact.id,
          email: ghlContact.email,
          error: contactError.message
        });
        skipped++;
      }
    }

    // Update sync status
    await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          lastContactSync: new Date(),
          contactSyncStatus: {
            lastSync: new Date(),
            totalContacts: totalCount,
            synced: offset + ghlContacts.length,
            errors: errors.length
          }
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Contacts] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    // Determine if more contacts need to be synced
    const hasMore = (offset + limit) < totalCount;

    return {
      success: true,
      created,
      updated,
      skipped,
      processed: ghlContacts.length,
      totalInGHL: totalCount,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Contacts] Error:`, error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.status === 404) {
      console.log(`[Sync Contacts] Contacts endpoint not found`);
      return {
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        processed: 0,
        totalInGHL: 0,
        error: 'Contacts endpoint not found'
      };
    }
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied - check permissions for contacts');
    }
    
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded - too many requests');
    }
    
    throw error;
  }
}