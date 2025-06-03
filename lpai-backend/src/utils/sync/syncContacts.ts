// src/utils/sync/syncContacts.ts
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

interface SyncOptions {
  limit?: number;
  startAfter?: number;
  startAfterId?: string;
  fullSync?: boolean;
}

export async function syncContacts(db: Db, location: any, options: SyncOptions = {}) {
  const startTime = Date.now();
  const { limit = 100, startAfter, startAfterId, fullSync = false } = options;
  
  console.log(`[Sync Contacts] Starting for ${location.locationId} - Limit: ${limit}`);
  
  // If fullSync requested, handle pagination automatically
  if (fullSync && !startAfter && !startAfterId) {
    console.log(`[Sync Contacts] Full sync requested - will fetch all contacts in batches`);
    
    // Rate limit configuration
    const BATCH_SIZE = 100; // Larger batches for efficiency
    const REQUESTS_PER_SECOND = 8; // Stay under 10/second limit
    const DELAY_BETWEEN_BATCHES = 1000 / REQUESTS_PER_SECOND; // 125ms
    const MAX_REQUESTS_PER_RUN = 50; // 50 requests = 25k contacts
    const MAX_SYNC_DURATION = 55000; // 55 seconds (safe for 60s timeout)
    
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let currentStartAfter: number | undefined;
    let currentStartAfterId: string | undefined;
    let hasMoreData = true;
    let requestCount = 0;
    const syncStartTime = Date.now();
    const allErrors: any[] = [];
    
    while (hasMoreData) {
      requestCount++;
      
      // Safety checks for Vercel timeout and rate limits
      if (requestCount >= MAX_REQUESTS_PER_RUN || 
          Date.now() - syncStartTime > MAX_SYNC_DURATION) {
        console.log(`[Sync Contacts] Stopping sync - limit reached (${requestCount} requests, ${Date.now() - syncStartTime}ms elapsed)`);
        
        const totalDuration = Date.now() - startTime;
        return {
          success: true,
          created: totalCreated,
          updated: totalUpdated,
          skipped: totalSkipped,
          processed: totalCreated + totalUpdated + totalSkipped,
          hasMore: true,
          partial: true,
          message: `Synced ${totalCreated + totalUpdated} contacts. More contacts available - run sync again to continue.`,
          resumeFrom: {
            startAfter: currentStartAfter,
            startAfterId: currentStartAfterId
          },
          errors: allErrors.length > 0 ? allErrors : undefined,
          duration: `${totalDuration}ms`
        };
      }
      
      console.log(`[Sync Contacts] Fetching batch ${requestCount}...`);
      
      const batchResult = await syncContacts(db, location, {
        limit: BATCH_SIZE,
        startAfter: currentStartAfter,
        startAfterId: currentStartAfterId,
        fullSync: false // Prevent recursion
      });
      
      totalCreated += batchResult.created;
      totalUpdated += batchResult.updated;
      totalSkipped += batchResult.skipped;
      
      if (batchResult.errors) {
        allErrors.push(...batchResult.errors);
      }
      
      // FIX: Check if no contacts were returned
      if (batchResult.processed === 0) {
        console.log(`[Sync Contacts] No more contacts found, ending sync`);
        hasMoreData = false;
        break;
      }
      
      // Check if there's more data
      hasMoreData = batchResult.hasMore || false;
      currentStartAfter = batchResult.nextStartAfter;
      currentStartAfterId = batchResult.nextStartAfterId;
      
      // Rate limit delay
      if (hasMoreData) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    const totalDuration = Date.now() - startTime;
    console.log(`[Sync Contacts] Full sync completed in ${totalDuration}ms - Total requests: ${requestCount}`);
    
    return {
      success: true,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      processed: totalCreated + totalUpdated + totalSkipped,
      hasMore: false,
      errors: allErrors.length > 0 ? allErrors : undefined,
      duration: `${totalDuration}ms`,
      fullSyncCompleted: true,
      totalRequests: requestCount
    };
  }

  try {
    // Get auth header
    const auth = await getAuthHeader(location);
    
    // Build params
    const params: any = {
      locationId: location.locationId,
      limit
    };
    
    // Add pagination params if provided
    if (startAfter) params.startAfter = startAfter;
    if (startAfterId) params.startAfterId = startAfterId;
    
    // Fetch contacts from GHL
    const response = await axios.get(
      'https://services.leadconnectorhq.com/contacts/',
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        },
        params
      }
    );

    const ghlContacts = response.data.contacts || [];
    const meta = response.data.meta || {};
    
    console.log(`[Sync Contacts] Found ${ghlContacts.length} contacts (Total: ${meta.total})`);

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
          fullName: ghlContact.contactName || `${ghlContact.firstName || ''} ${ghlContact.lastName || ''}`.trim(),
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
          source: ghlContact.source || '',
          type: ghlContact.type || 'lead',
          
          // Assignment
          assignedTo: ghlContact.assignedTo || null,
          
          // Custom Fields (store all of them)
          customFields: ghlContact.customFields || [],
          
          // Additional emails
          additionalEmails: ghlContact.additionalEmails || [],
          
          // Attribution
          attributions: ghlContact.attributions || [],
          
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
            totalContacts: meta.total,
            currentPage: meta.currentPage,
            errors: errors.length
          }
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Sync Contacts] Completed in ${duration}ms - Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

    // Determine if more contacts exist
    const hasMore = meta.nextPage !== null;

    return {
      success: true,
      created,
      updated,
      skipped,
      processed: ghlContacts.length,
      totalInGHL: meta.total,
      hasMore,
      nextStartAfter: meta.startAfter,
      nextStartAfterId: meta.startAfterId,
      currentPage: meta.currentPage,
      nextPage: meta.nextPage,
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