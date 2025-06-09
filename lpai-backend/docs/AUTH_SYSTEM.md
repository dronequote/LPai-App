# LPai Authentication System Documentation
**Date: June 9, 2025**

## Overview
The LPai Authentication System handles both OAuth 2.0 (primary) and API key (legacy) authentication for GoHighLevel integration, with automatic token refresh and multi-tenant support.

## Architecture

### Core Components

#### Auth Utility (`/src/utils/ghlAuth.ts`)
Primary authentication handler providing:
- `getAuthHeader()` - Returns auth header with type indicator
- `tokenNeedsRefresh()` - Checks if token expires within 1 hour
- `refreshOAuthToken()` - Refreshes expired OAuth tokens
- `getLocationToken()` - Obtains location-specific tokens from company tokens

#### Login Endpoints

1. **User Login** (`/pages/api/login.ts`)
   - Email/password authentication
   - Returns JWT token (7-day expiry)
   - Includes user preferences in response
   - Uses bcrypt for password verification

2. **OAuth Login** (`/pages/api/login/oauth.ts`)
   - Email-only authentication
   - For OAuth/Google login flows
   - Returns same JWT structure

### OAuth Flow

#### OAuth Callback (`/pages/api/oauth/callback.ts`)
1. Receives authorization code from GHL
2. Exchanges code for tokens via GHL API
3. Determines install type (Company vs Location)
4. Stores tokens in MongoDB
5. Clears any uninstall data
6. Adds to install queue for processing
7. Redirects to progress page

#### Location Token Generation (`/pages/api/oauth/get-location-tokens.ts`)
- Obtains location-specific tokens from company OAuth
- Rate limited: 10 requests/minute per company
- Supports single location or bulk agency operations
- Processes locations in batches of 5

### Token Management

#### Token Storage Structure
```javascript
{
  ghlOAuth: {
    accessToken: "eyJhb...",
    refreshToken: "eyJhb...", 
    expiresAt: Date,
    tokenType: "Bearer",
    userType: "Location" | "Company",
    installedAt: Date,
    installedBy: "userId",
    derivedFromCompany: boolean,
    needsReauth: boolean,  // Set on refresh failure
    lastRefreshError: string,
    refreshCount: number
  }
}
Token Refresh (/pages/api/cron/refresh-tokens.ts)

Schedule: Every hour (vercel.json)
Process:

Finds locations with OAuth tokens
Checks if token expires within 1 hour
Refreshes using refresh token
Updates database with new tokens
Marks for reauth if refresh fails



Authentication Priority
When calling GHL API, getAuthHeader() checks in order:

OAuth tokens (ghlOAuth.accessToken) - Primary
API Key (apiKey) - Legacy fallback

Security
JWT Configuration

Secret: JWT_SECRET environment variable (32+ chars)
Expiry: 7 days
Payload includes:

userId, locationId
name, email
permissions, role
User preferences



OAuth Security

Client ID/Secret stored in environment variables
Tokens encrypted at rest in MongoDB
Install locks prevent duplicate processing
Signature verification on webhooks

Database Schema
Locations Collection
javascript{
  locationId: string,
  companyId: string,
  
  // OAuth fields
  ghlOAuth: {
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
    // ... other fields
  },
  
  // Legacy auth
  apiKey: string,
  
  // Install tracking
  appInstalled: boolean,
  installedAt: Date,
  uninstalledAt: Date
}
Users Collection
javascript{
  email: string,
  hashedPassword: string,
  ghlUserId: string,
  locationId: string,
  permissions: array,
  role: string,
  preferences: object
}
Error Handling
Token Refresh Failures

Sets needsReauth: true on location
Stores error in lastRefreshError
User must reinstall app to fix

API Authentication Errors

401 responses trigger token refresh attempt
Falls back to API key if OAuth fails
Returns clear error messages

Monitoring
Check Token Status
javascript// Find locations needing reauth
db.locations.find({ 'ghlOAuth.needsReauth': true })

// Check token expiry
db.locations.find({
  'ghlOAuth.expiresAt': { $lt: new Date() }
})

// View refresh history
db.locations.find({}, {
  locationId: 1,
  'ghlOAuth.refreshCount': 1,
  'ghlOAuth.lastRefreshed': 1
})
Migration Status
Endpoints Using OAuth (✅)

All sync functions
Contact search
Project management
Most new endpoints

Endpoints Still Using API Keys (⚠️)

/pages/api/appointments/index.ts
/pages/api/contacts/[contactId].ts
/pages/api/ghl/[id].ts
Some legacy endpoints

Best Practices

Always use getAuthHeader()

Handles both OAuth and API key
Returns consistent format
Includes auth type


Handle Token Expiry

Check tokenNeedsRefresh() before long operations
Implement retry logic on 401 errors


Install Flow

Use install locks to prevent duplicates
Clear uninstall data on reinstall
Trigger full sync after install



Troubleshooting
"No Authorization header found"

Location missing OAuth tokens and API key
Check location auth configuration
May need to reinstall app

Token Refresh Failing

Check refresh token validity
Verify OAuth client credentials
Monitor refresh error logs

Install Not Completing

Check install_locks collection
Verify install queue processing
Review OAuth callback logs

- /src/utils/installQueue.ts
- /pages/api/oauth/callback.ts
- /pages/api/oauth/get-location-tokens.ts
- /pages/api/locations/setup-location.ts
- /pages/api/locations/manual-setup.ts
- /pages/api/sync/progress/[id].ts
- /pages/api/install-progress/[locationId].ts (BROKEN - missing imports)
- /pages/api/cron/process-install-queue.ts
- /pages/api/analytics/installs/[locationId].ts
- /pages/api/analytics/installs/[locationId]/ui.ts
ALL SYNC UTILITIES:
- /src/utils/sync/contacts-full.ts (MISPLACED - should be in pages/api)
- /src/utils/sync/setupDefaults.ts
- /src/utils/sync/syncAppointments.ts
- /src/utils/sync/syncCalendars.ts
- /src/utils/sync/syncContactNotes.ts
- /src/utils/sync/syncContacts.ts
- /src/utils/sync/syncConversations.ts
- /src/utils/sync/syncCustomFields.ts
- /src/utils/sync/syncCustomValues.ts
- /src/utils/sync/syncInvoices.ts
- /src/utils/sync/syncLocationDetails.ts
- /src/utils/sync/syncMessages.ts
- /src/utils/sync/syncOpportunities.ts
- /src/utils/sync/syncPipelines.ts
- /src/utils/sync/syncTags.ts
- /src/utils/sync/syncTasks.ts
- /src/utils/sync/syncUsers.ts

SYNC ENDPOINTS:
- /pages/api/sync/appointments.ts
- /pages/api/sync/calendars.ts
- /pages/api/sync/contacts.ts
- /pages/api/sync/conversations.ts
- /pages/api/sync/custom-fields.ts
- /pages/api/sync/custom-values.ts
- /pages/api/sync/location-details.ts
- /pages/api/sync/opportunities.ts
- /pages/api/sync/pipelines.ts
- /pages/api/sync/users.ts

GHL SYNC ENDPOINTS:
- /pages/api/ghl/syncContacts.ts
- /pages/api/ghl/calendars/[locationId].ts
- /pages/api/ghl/pipelines/[locationId].ts
- /pages/api/ghl/[id].ts