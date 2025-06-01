# GHL (GoHighLevel) Integration Architecture

## Overview
LPai uses a dual-integration approach with GoHighLevel:
1. **Direct API Integration** - For CRUD operations (existing)
2. **Marketplace App Integration** - For webhooks and OAuth (new)

## Current Status (as of June 1, 2025)

### ✅ What's Working
- OAuth flow implemented and tested
- Native webhook endpoint receiving events
- Webhook signature verification working
- Webhook queue system operational
- Cron job processing webhooks every minute
- INSTALL/UNINSTALL webhooks processing correctly
- Company-level OAuth tokens stored

### 🚧 What's In Progress
- Converting company-level tokens to location-specific tokens
- Syncing all agency locations and details
- Processing other webhook types (contacts, appointments, etc.)

### ❌ What's Not Done Yet
- Individual location OAuth installations
- Token refresh logic
- Complete webhook processors for all event types
- Mobile app OAuth integration

## Authentication Types

### 1. Location API Keys (Legacy - Still Active)
- Stored in `locations` collection
- Used for API calls TO GHL
- Each location has unique key
- Example: `pit-3e69d6a2-c4f0-4445-84fa-043015551fbe`

### 2. OAuth App Credentials (New - Active)
- **Client ID**: `683aa5ce1a9647760b904986-mbc8v930`
- **Client Secret**: `a6ec6cdc-047d-41d0-bcc5-96de0acd37d3`
- **Shared Secret**: `aafa362b-0e65-48d8-8373-8277026090e6`
- **Public Key**: Used for webhook signature verification

### 3. OAuth Access Tokens (Implemented)
- Company-level tokens working
- Location-specific tokens pending
- Refresh token logic not yet implemented

## Current Database State

### Locations Collection
```javascript
{
  // Legacy location with API key
  locationId: "JMtlZzwrNOUmLpJk2eCE",
  name: "Fake Company",
  apiKey: "pit-3e69d6a2-c4f0-4445-84fa-043015551fbe",
  
  // New OAuth location (company-level)
  locationId: null,
  companyId: "xvoQk4MIRt1U9L3bWLcC",
  name: "Company-Level Install",
  ghlOAuth: {
    accessToken: "...",
    refreshToken: "...",
    expiresAt: Date,
    userType: "Company"
  },
  isCompanyLevel: true,
  appInstalled: true
}
Installation Flow
Current Process

Install at company/agency level ✅
Get company OAuth tokens ✅
Convert to location tokens 🚧
Store all location details 🚧

Install URL
https://marketplace.gohighlevel.com/oauth/chooselocation?
response_type=code&
redirect_uri=https://lpai-backend-omega.vercel.app/api/oauth/callback&
client_id=683aa5ce1a9647760b904986-mbc8v930&
scope=businesses.readonly+businesses.write+[...all scopes...]
Webhook Processing
Active Endpoints

/api/webhooks/ghl/native - Marketplace app webhooks ✅
/api/cron/process-webhooks - Queue processor ✅
/api/oauth/callback - OAuth callback ✅
/api/oauth/get-location-tokens - Location sync 🚧

Webhook Flow

GHL sends webhook to /api/webhooks/ghl/native
Signature verified using public key
Webhook queued in webhook_queue collection
Cron job processes queue every minute
Native webhook processor handles specific event types

Currently Supported Webhook Types

✅ INSTALL
✅ UNINSTALL
✅ LocationUpdate
🚧 ContactCreate/Update/Delete
🚧 AppointmentCreate/Update/Delete
❌ All other types (stub functions only)

API Endpoints Status
Authentication Utilities

✅ /src/utils/ghlAuth.ts - Handles both OAuth and API key auth
❌ Token refresh logic not implemented

Webhook Processors

✅ /src/utils/webhooks/nativeWebhookProcessor.ts - Main processor
🚧 Individual event handlers need implementation

Next Steps
Immediate (Do Now)

Push current changes to production
Run /api/oauth/get-location-tokens to sync all locations
Test with a location-specific installation

Short Term (This Week)

Implement token refresh logic
Complete webhook processors for contacts/appointments
Update mobile app to use OAuth tokens
Add monitoring endpoints

Medium Term (Next Sprint)

Migrate all API endpoints from API keys to OAuth
Implement webhook retry logic
Add webhook analytics
Create admin dashboard

Testing Checklist
OAuth Flow

 Company-level installation
 Location-level installation
 Token refresh
 Multiple location selection

Webhooks

 INSTALL webhook
 UNINSTALL webhook
 Contact webhooks
 Appointment webhooks
 Opportunity webhooks

API Endpoints

 All endpoints support OAuth
 Fallback to API key works
 Token refresh automatic

Useful Commands
Process webhooks manually
bashcurl https://lpai-backend-omega.vercel.app/api/cron/process-webhooks \
  -H "Authorization: Bearer lpai_cron_2024_xK9mN3pQ7rL5vB8wT6yH2jF4"
Sync agency locations
bashcurl -X POST https://lpai-backend-omega.vercel.app/api/oauth/get-location-tokens \
  -H "Content-Type: application/json" \
  -d '{"companyId": "xvoQk4MIRt1U9L3bWLcC"}'
Check system status
bashcurl https://lpai-backend-omega.vercel.app/api/status

## Architecture Flow
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│   Mobile App    │────────▶│    Backend      │────────▶│      GHL        │
│                 │         │   (Next.js)     │         │      API        │
└─────────────────┘         └─────────────────┘         └─────────────────┘
│                            │
│                            │
▼                            ▼
┌─────────────────┐          ┌─────────────────┐
│                 │          │                 │
│    MongoDB      │◀─────────│    Webhooks     │
│                 │          │                 │
└─────────────────┘          └─────────────────┘