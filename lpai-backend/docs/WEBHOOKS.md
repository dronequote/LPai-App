Excellent idea! Let's create a comprehensive documentation file that explains the entire GHL integration architecture. This will help you and your team understand the flow.
Create webhooks.md in your project root:
markdown# GHL (GoHighLevel) Integration Architecture

## Overview
LPai uses a dual-integration approach with GoHighLevel:
1. **Direct API Integration** - For CRUD operations (existing)
2. **Marketplace App Integration** - For webhooks and OAuth (new)

## Why Two Integration Methods?

### Direct API (What We Had)
- **Purpose**: Create, read, update, delete operations
- **Auth**: Location-specific API keys stored in MongoDB
- **Flow**: Mobile App → Backend → GHL API
- **Example**: Creating an appointment, updating a contact

### Marketplace App (What We Added)
- **Purpose**: Real-time event notifications via webhooks
- **Auth**: OAuth 2.0 flow with app credentials
- **Flow**: GHL → Webhooks → Backend → MongoDB
- **Example**: Get notified when appointment is booked, contact is updated

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

## Authentication Types

### 1. Location API Keys (Existing)
- Stored in `locations` collection
- Used for API calls TO GHL
- Each location has unique key
- Example: `ghl_api_key_xxx`

### 2. OAuth App Credentials (New)
- **Client ID**: `683aa5ce1a9647760b904986-mbc8v930`
- **Client Secret**: `a6ec6cdc-047d-41d0-bcc5-96de0acd37d3`
- **Shared Secret**: `aafa362b-0e65-48d8-8373-8277026090e6`
- Used for app installation and webhook verification

### 3. OAuth Access Tokens (Generated)
- Obtained during app installation
- Stored per location
- Used for API calls on behalf of installed app
- Includes refresh token for long-term access

## Installation Flow

1. **Agency/Location Admin** clicks install link:
https://marketplace.gohighlevel.com/oauth/chooselocation?
client_id=683aa5ce1a9647760b904986&
redirect_uri=https://lpai-backend-omega.vercel.app/api/oauth/callback

2. **User authorizes** permissions

3. **GHL redirects** to callback with code:
https://lpai-backend-omega.vercel.app/api/oauth/callback?
code=AUTH_CODE&
locationId=LOCATION_ID

4. **Backend exchanges** code for tokens:
POST https://services.leadconnectorhq.com/oauth/token
{
client_id: "...",
client_secret: "...",
grant_type: "authorization_code",
code: "AUTH_CODE"
}

5. **Tokens stored** in MongoDB `locations` collection

6. **Webhooks activated** automatically

## Webhook Flow

### Events We Listen For
- **Contacts**: Create, Update, Delete, Tag Update, DND Update
- **Appointments**: Create, Update, Delete
- **Opportunities**: Create, Update, Delete, Stage Change, Status Change
- **Tasks**: Create, Complete, Delete
- **Notes**: Create, Delete
- **Invoices**: Create, Update, Paid, Void
- **Orders**: Create, Status Update
- **Messages**: Inbound, Outbound

### Webhook Processing

1. **GHL sends** webhook to:
https://lpai-backend-omega.vercel.app/api/webhooks/ghl/native

2. **Verify signature** using shared secret

3. **Process based on type**:
```javascript
{
  "type": "ContactCreate",
  "locationId": "xxx",
  "id": "contact_id",
  "firstName": "John",
  ...
}

Update MongoDB accordingly
Return 200 to acknowledge

Security Considerations
Webhook Verification

All webhooks signed with shared secret
Verify signature before processing
Reject invalid signatures

Token Storage

Access tokens encrypted in database
Refresh tokens used before expiry
Location isolation maintained

API Key Management

Never expose client secret
Rotate tokens periodically
Audit webhook logs

Database Schema Updates
locations Collection
javascript{
  locationId: "xxx",
  apiKey: "existing_direct_api_key",
  
  // New OAuth fields
  ghlOAuth: {
    accessToken: "encrypted_token",
    refreshToken: "encrypted_token",
    expiresAt: Date,
    tokenType: "Bearer",
    installedAt: Date,
    installedBy: "user_id"
  }
}
webhook_logs Collection
javascript{
  _id: ObjectId,
  type: "ContactCreate",
  locationId: "xxx",
  payload: {},
  processedAt: Date,
  status: "success|failed",
  error: null
}
Endpoints to Implement
1. OAuth Callback
POST /api/oauth/callback

Receives authorization code
Exchanges for tokens
Stores in database
Redirects to success page

2. Webhook Handler
POST /api/webhooks/ghl/native

Receives all webhook events
Verifies signatures
Routes to appropriate processor
Updates MongoDB

3. Webhook Processors

/utils/webhooks/contactProcessor.ts
/utils/webhooks/appointmentProcessor.ts
/utils/webhooks/opportunityProcessor.ts
etc.

Testing Strategy

OAuth Flow

Install app to test location
Verify tokens stored
Test token refresh


Webhook Reception

Create contact in GHL
Verify webhook received
Check MongoDB update


Data Integrity

Ensure no duplicates
Verify all fields mapped
Test error scenarios



Monitoring

Log all webhook events
Track processing time
Alert on failures
Monitor token expiry

Future Considerations

Webhook Retry Logic

Queue failed webhooks
Exponential backoff
Dead letter queue


Scaling

Webhook queue system
Async processing
Rate limiting


Analytics

Webhook volume metrics
Processing time stats
Error rate monitoring