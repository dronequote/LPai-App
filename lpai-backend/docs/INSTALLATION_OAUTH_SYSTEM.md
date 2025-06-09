# LPai Installation & OAuth System Documentation 6/9/2025

## Overview

The LPai installation system handles OAuth authentication, location setup, and data synchronization when users install the app from the GoHighLevel (GHL) marketplace. It supports both company-level (agency) and location-level installations.

## Architecture Flow

```mermaid
graph TD
   A[User Installs from GHL Marketplace] --> B[OAuth Callback]
   B --> C{Install Type?}
   
   C -->|Company Level| D[Store Company OAuth]
   C -->|Location Level| E[Store Location OAuth]
   
   D --> F[Get Location Tokens API]
   E --> G[Check Install Lock]
   F --> G
   
   G --> H{Lock Acquired?}
   H -->|No| I[Show "In Progress" Page]
   H -->|Yes| J[Add to Install Queue]
   
   J --> K[Process Install Queue Cron]
   K --> L[Trigger Setup Location]
   
   L --> M[Setup Location Process]
   M --> N[Sync All Data]
   N --> O[Update Progress]
   
   O --> P[Progress UI Polling]
   P --> Q{Complete?}
   Q -->|No| P
   Q -->|Yes| R[Success Page]
   
   S[Token Refresh Cron] --> T[Check Token Expiry]
   T --> U[Refresh if Needed]
   
   V[Cleanup Cron] --> W[Remove Old Records]
Key Components
1. OAuth Flow (/api/oauth/callback)
Purpose: Handles OAuth callback from GHL, exchanges code for tokens
Process:

Receives authorization code from GHL
Exchanges code for access/refresh tokens
Determines if company or location install
Stores tokens appropriately
Clears any previous uninstall data
Adds to install queue for processing

Key Features:

Install lock prevents duplicate processing
Handles both company and location installs
Clears uninstall fields on reinstall

2. Setup Location (/api/locations/setup-location)
Purpose: Orchestrates the complete location setup process
Sync Order:

Location Details
Pipelines
Calendars
Users
Custom Fields
Tags
Custom Values
Contacts (can be batched)
Tasks
Opportunities/Projects
Appointments
Conversations
Invoices
Default Settings

Features:

Real-time progress tracking
Error handling per step
Continues even if individual steps fail

3. Progress Monitoring (/api/sync/progress/[id])
Purpose: Provides real-time installation progress
Features:

Beautiful UI with animations
Company view shows multiple locations
Individual location detailed progress
Filters to only show installed locations
Auto-refresh every 3 seconds

4. Authentication (/src/utils/ghlAuth)
Key Functions:

getAuthHeader(): Returns auth object with header and type
tokenNeedsRefresh(): Checks if token expires within 1 hour
refreshOAuthToken(): Refreshes expired tokens

Token Sources (in priority order):

OAuth tokens (ghlOAuth.accessToken)
API Key (apiKey)

5. Install Queue System
Collections:

webhook_queue: Main processing queue
install_locks: Prevents concurrent installs
install_retry_queue: Failed install retries

Lock System:

5-minute expiry on locks
Prevents duplicate installs
Auto-cleanup of expired locks

Installation Types
Company-Level Install

Agency owner installs at company level
Company OAuth tokens stored
Can generate tokens for all sub-accounts
No individual location setup triggered

Location-Level Install

User installs for specific location
Location OAuth tokens stored
Immediate setup process triggered
Full data sync initiated

Token Management
Token Refresh

Cron Job: /api/cron/refresh-tokens
Schedule: Every hour
Buffer: 1 hour before expiry
Process:

Find locations with expiring tokens
Use refresh token to get new access token
Update database with new tokens
Mark for re-auth if refresh fails



Token Storage
javascript{
  ghlOAuth: {
    accessToken: "eyJhb...",
    refreshToken: "eyJhb...",
    expiresAt: Date,
    tokenType: "Bearer",
    userType: "Location" | "Company",
    installedAt: Date,
    installedBy: "userId",
    derivedFromCompany: boolean
  }
}
Sync Functions
Each sync function follows the same pattern:

Get auth header
Fetch data from GHL API
Transform to our schema
Upsert into MongoDB
Update sync metadata

Available Sync Functions:

syncLocationDetails()
syncPipelines()
syncCalendars()
syncUsers()
syncCustomFields()
syncTags()
syncCustomValues()
syncContacts() - Supports full sync with pagination
syncTasks()
syncOpportunities()
syncAppointments()
syncConversations() - Includes message sync
syncInvoices()

Error Handling
Installation Failures

Added to install_retry_queue
Processed by install queue cron
Max 3 retry attempts
Exponential backoff

Token Failures

Marked with needsReauth: true
User must reinstall app
Clear error on successful reinstall

Sync Failures

Individual step failures don't stop process
Error details stored in setup results
Can manually retry individual syncs

Cron Jobs
1. Token Refresh (/api/cron/refresh-tokens)

Schedule: Hourly
Purpose: Refresh expiring OAuth tokens
Auth: Vercel Cron or Bearer token

2. Install Queue (/api/cron/process-install-queue)

Schedule: Every 5 minutes
Purpose: Process retry queue and sync jobs
Features: Cleans expired locks

3. Critical Processor (/api/cron/process-critical)

Schedule: Every minute
Purpose: Process critical webhooks
Includes: Install webhooks

4. Cleanup (/api/cron/cleanup-old-records)

Schedule: Daily at 3 AM UTC
Purpose: Remove old queue records
Cleans:

Webhook queue (7 days old)
Install locks (expired)
Retry queue (30 days old)



Database Schema
Locations Collection
javascript{
  _id: ObjectId,
  locationId: "GHL_LOCATION_ID",
  companyId: "GHL_COMPANY_ID",
  name: "Location Name",
  
  // Installation Status
  appInstalled: boolean,
  installedAt: Date,
  uninstalledAt: Date,
  uninstallReason: string,
  
  // OAuth
  ghlOAuth: { /* token object */ },
  apiKey: string, // Alternative auth
  
  // Setup Status
  setupCompleted: boolean,
  setupCompletedAt: Date,
  setupResults: { /* detailed results */ },
  syncProgress: { /* step progress */ },
  
  // Sync Metadata
  lastContactSync: Date,
  contactCount: number,
  // ... other sync timestamps
}
Best Practices
1. Always Use Install Queue

Never trigger setup directly
Use queue for reliability
Handles retries automatically

2. Token Management

Check tokenNeedsRefresh() before API calls
Handle 401 errors gracefully
Clear uninstall data on reinstall

3. Error Handling

Don't stop on individual failures
Log detailed error information
Provide clear user feedback

4. Performance

Batch API requests where possible
Use pagination for large datasets
Implement rate limiting

Troubleshooting
Common Issues

"No Authorization header found"

Check if location has valid tokens
Verify getAuthHeader() returns object format
Check token expiry


Install Not Starting

Check install locks collection
Verify queue processing is running
Check for errors in retry queue


Progress Stuck

Check specific step in syncProgress
Look for errors in setupResults
Verify cron jobs are running



Debugging Commands
javascript// Check location auth status
db.locations.findOne({ locationId: "XXX" }, { ghlOAuth: 1, apiKey: 1 })

// Check install progress
db.locations.findOne({ locationId: "XXX" }, { syncProgress: 1, setupResults: 1 })

// Check pending installs
db.install_retry_queue.find({ status: "pending" })

// Clear stuck locks
db.install_locks.deleteMany({ expiresAt: { $lt: new Date() } })
Security Considerations

Token Storage

Tokens encrypted at rest (MongoDB)
Never log tokens
Use environment variables


API Security

Verify webhook signatures
Rate limit endpoints
Validate locationId ownership


Queue Security

Authenticate cron endpoints
Prevent queue flooding
Validate payload data



Future Improvements

Resume Capability

Track completed steps
Skip already synced data
Checkpoint system


Selective Sync

Allow choosing what to sync
Incremental updates
Delta sync support


Better Monitoring

Installation metrics
Success/failure rates
Performance tracking


Enhanced UI

More detailed progress
Error recovery options
Sync history