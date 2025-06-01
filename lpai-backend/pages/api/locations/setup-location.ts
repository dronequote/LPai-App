// pages/api/locations/setup-location.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAuthHeader } from '../../../src/utils/ghlAuth';
import axios from 'axios';

// Individual sync functions (we'll implement these next)
import { syncLocationDetails } from '../../../src/utils/sync/syncLocationDetails';
import { syncPipelines } from '../../../src/utils/sync/syncPipelines';
import { syncCalendars } from '../../../src/utils/sync/syncCalendars';
import { syncUsers } from '../../../src/utils/sync/syncUsers';
import { syncCustomFields } from '../../../src/utils/sync/syncCustomFields';
import { syncContacts } from '../../../src/utils/sync/syncContacts';
import { syncOpportunities } from '../../../src/utils/sync/syncOpportunities';
import { syncAppointments } from '../../../src/utils/sync/syncAppointments';
import { syncConversations } from '../../../src/utils/sync/syncConversations';
import { syncInvoices } from '../../../src/utils/sync/syncInvoices';
import { setupDefaults } from '../../../src/utils/sync/setupDefaults';
import { syncCustomValues } from '../../../src/utils/sync/syncCustomValues';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { locationId, fullSync = true } = req.body;

  if (!locationId) {
    return res.status(400).json({ error: 'Location ID is required' });
  }

  console.log(`[Location Setup] Starting setup for location: ${locationId}`);

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get location record
    const location = await db.collection('locations').findOne({ locationId });
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Check if we have OAuth or API key
    if (!location.ghlOAuth?.accessToken && !location.apiKey) {
      return res.status(400).json({ 
        error: 'No authentication method available for location',
        details: 'Location needs OAuth token or API key'
      });
    }

    // Track setup progress
    const setupResults = {
      locationId,
      startedAt: new Date(),
      steps: {} as Record<string, any>
    };

    // 1. Sync Location Details
    try {
      console.log(`[Location Setup] Step 1: Syncing location details...`);
      const locationResult = await syncLocationDetails(db, location);
      setupResults.steps.locationDetails = { success: true, ...locationResult };
    } catch (error: any) {
      console.error(`[Location Setup] Location details sync failed:`, error);
      setupResults.steps.locationDetails = { success: false, error: error.message };
    }

    // 2. Sync Pipelines
    try {
      console.log(`[Location Setup] Step 2: Syncing pipelines...`);
      const pipelineResult = await syncPipelines(db, location);
      setupResults.steps.pipelines = { success: true, ...pipelineResult };
    } catch (error: any) {
      console.error(`[Location Setup] Pipeline sync failed:`, error);
      setupResults.steps.pipelines = { success: false, error: error.message };
    }

    // 3. Sync Calendars
    try {
      console.log(`[Location Setup] Step 3: Syncing calendars...`);
      const calendarResult = await syncCalendars(db, location);
      setupResults.steps.calendars = { success: true, ...calendarResult };
    } catch (error: any) {
      console.error(`[Location Setup] Calendar sync failed:`, error);
      setupResults.steps.calendars = { success: false, error: error.message };
    }

    // 4. Sync Users
    try {
      console.log(`[Location Setup] Step 4: Syncing users...`);
      const userResult = await syncUsers(db, location);
      setupResults.steps.users = { success: true, ...userResult };
    } catch (error: any) {
      console.error(`[Location Setup] User sync failed:`, error);
      setupResults.steps.users = { success: false, error: error.message };
    }

    // 5. Sync Custom Fields
    try {
      console.log(`[Location Setup] Step 5: Syncing custom fields...`);
      const customFieldResult = await syncCustomFields(db, location);
      setupResults.steps.customFields = { success: true, ...customFieldResult };
    } catch (error: any) {
      console.error(`[Location Setup] Custom field sync failed:`, error);
      setupResults.steps.customFields = { success: false, error: error.message };
    }

    // 5.5 Sync Custom Values
    try {
      console.log(`[Location Setup] Step 5.5: Syncing custom values...`);
      const customValuesResult = await syncCustomValues(db, location);
      setupResults.steps.customValues = { success: true, ...customValuesResult };
    } catch (error: any) {
      console.error(`[Location Setup] Custom values sync failed:`, error);
      setupResults.steps.customValues = { success: false, error: error.message };
    }

    // Only do full sync if requested (for initial setup)
    if (fullSync) {
      // 6. Sync Contacts (initial batch)
      try {
        console.log(`[Location Setup] Step 6: Syncing contacts (initial batch)...`);
        const contactResult = await syncContacts(db, location, { limit: 100 });
        setupResults.steps.contacts = { success: true, ...contactResult };
      } catch (error: any) {
        console.error(`[Location Setup] Contact sync failed:`, error);
        setupResults.steps.contacts = { success: false, error: error.message };
      }

      // 7. Sync Opportunities
      try {
        console.log(`[Location Setup] Step 7: Syncing opportunities...`);
        const opportunityResult = await syncOpportunities(db, location, { limit: 100 });
        setupResults.steps.opportunities = { success: true, ...opportunityResult };
      } catch (error: any) {
        console.error(`[Location Setup] Opportunity sync failed:`, error);
        setupResults.steps.opportunities = { success: false, error: error.message };
      }

      // 8. Sync Appointments
      try {
        console.log(`[Location Setup] Step 8: Syncing appointments...`);
        const appointmentResult = await syncAppointments(db, location, { limit: 100 });
        setupResults.steps.appointments = { success: true, ...appointmentResult };
      } catch (error: any) {
        console.error(`[Location Setup] Appointment sync failed:`, error);
        setupResults.steps.appointments = { success: false, error: error.message };
      }

      // 9. Sync Conversations (including messages)
      try {
        console.log(`[Location Setup] Step 9: Syncing conversations...`);
        const conversationResult = await syncConversations(db, location, { limit: 50, fullSync: true });
        setupResults.steps.conversations = { success: true, ...conversationResult };
      } catch (error: any) {
        console.error(`[Location Setup] Conversation sync failed:`, error);
        setupResults.steps.conversations = { success: false, error: error.message };
      }

      // 10. Sync Invoices (TODO: Implement when ready)
      try {
        console.log(`[Location Setup] Step 10: Syncing invoices...`);
        // const invoiceResult = await syncInvoices(db, location, { limit: 100 });
        // setupResults.steps.invoices = { success: true, ...invoiceResult };
        setupResults.steps.invoices = { success: false, error: 'Not implemented yet' };
      } catch (error: any) {
        console.error(`[Location Setup] Invoice sync failed:`, error);
        setupResults.steps.invoices = { success: false, error: error.message };
      }
    }

    // 11. Setup Defaults (terms, templates, etc.)
    try {
      console.log(`[Location Setup] Step 11: Setting up defaults...`);
      const defaultsResult = await setupDefaults(db, location);
      setupResults.steps.defaults = { success: true, ...defaultsResult };
    } catch (error: any) {
      console.error(`[Location Setup] Defaults setup failed:`, error);
      setupResults.steps.defaults = { success: false, error: error.message };
    }

    // Update location as setup complete
    await db.collection('locations').updateOne(
      { _id: location._id },
      {
        $set: {
          setupCompleted: true,
          setupCompletedAt: new Date(),
          lastSetupRun: new Date(),
          setupResults: setupResults
        }
      }
    );

    setupResults.completedAt = new Date();
    setupResults.duration = `${(setupResults.completedAt.getTime() - setupResults.startedAt.getTime()) / 1000}s`;

    // Count successes and failures
    const successCount = Object.values(setupResults.steps).filter((s: any) => s.success).length;
    const failureCount = Object.values(setupResults.steps).filter((s: any) => !s.success).length;

    console.log(`[Location Setup] Completed for ${locationId}: ${successCount} successful, ${failureCount} failed`);

    return res.status(200).json({
      success: true,
      message: `Location setup completed: ${successCount} successful, ${failureCount} failed`,
      locationId,
      results: setupResults
    });

  } catch (error: any) {
    console.error('[Location Setup] Fatal error:', error);
    return res.status(500).json({
      error: 'Location setup failed',
      message: error.message,
      locationId
    });
  }
}

// Extend timeout for Vercel (this process can take a while)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
    externalResolver: true,
  },
  maxDuration: 300 // 5 minutes max
};