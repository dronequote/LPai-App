## FILE: `/lpai-backend/docs/WEBHOOK_QUEUE_SYSTEM.md` (UPDATED)

```markdown
# Webhook Queue System Documentation

## Overview
The LPai webhook queue system provides scalable, reliable processing of GoHighLevel (GHL) webhooks with built-in deduplication, retry logic, and non-blocking responses.

## Current Implementation Status (June 1, 2025)

### ✅ Implemented
- Webhook queue collection and processing
- Cron job running every minute
- Signature verification using GHL public key
- Deduplication system with MD5 hashing
- Native webhook processor with event routing
- INSTALL/UNINSTALL/LocationUpdate handlers

### 🚧 In Progress
- Contact event handlers (stub functions exist)
- Appointment event handlers (stub functions exist)
- Complete webhook processor implementation

### ❌ Not Implemented
- Retry logic for failed webhooks
- Dead letter queue
- Webhook analytics
- Priority queue system

## Architecture

### Components

1. **Native Webhook Endpoint** (`/api/webhooks/ghl/native.ts`)
   - Receives marketplace app webhooks
   - Verifies signature with GHL public key
   - Queues for async processing
   - Returns 200 immediately

2. **Queue Processor** (`/api/cron/process-webhooks.ts`)
   - Runs every minute via Vercel cron
   - Protected by CRON_SECRET
   - Processes up to 50 webhooks per run
   - Cleans up old completed webhooks

3. **Native Webhook Processor** (`/src/utils/webhooks/nativeWebhookProcessor.ts`)
   - Routes events to specific handlers
   - Currently handles: INSTALL, UNINSTALL, LocationUpdate
   - Stub functions for all other event types

4. **Deduplication System** (`/src/utils/deduplication.ts`)
   - Creates MD5 hash of webhook payload
   - Prevents duplicate processing within 5 minutes
   - Auto-expires hashes

## Database Schema

### webhook_queue
```javascript
{
  _id: ObjectId,
  webhookId: string,              // Unique webhook ID
  type: string,                   // Event type (e.g., "INSTALL", "ContactCreate")
  payload: object,                // Full webhook payload
  locationId: string | null,      // Associated location
  source: "native",               // Webhook source
  status: "pending" | "processing" | "completed" | "failed" | "skipped",
  attempts: number,               // Retry counter
  createdAt: Date,
  processAfter: Date,             // For retry delays
  startedAt?: Date,               // Processing start time
  completedAt?: Date,             // Processing end time
  lastError?: string,             // Last error message
  skipReason?: string,            // Why webhook was skipped
  metadata: {                     // Quick reference fields
    contactId?: string,
    email?: string,
    appointmentId?: string,
    opportunityId?: string,
    invoiceId?: string,
    orderId?: string
  }
}
webhook_logs
javascript{
  _id: ObjectId,
  webhookId: string,
  type: string,
  locationId: string | null,
  payload: object,
  signature: string,              // x-wh-signature header
  verified: boolean,              // Signature verification result
  receivedAt: Date
}
webhook_hashes
javascript{
  hash: string,                   // MD5 hash of payload
  createdAt: Date,
  expireAt: Date                  // TTL index (5 minutes)
}
Current Webhook Types
Implemented ✅

INSTALL - App installation
UNINSTALL - App removal
LocationUpdate - Location details changed

Stub Functions Only 🚧
All other webhook types have stub functions that log but don't process:

ContactCreate/Update/Delete
AppointmentCreate/Update/Delete
OpportunityCreate/Update/Delete/StageUpdate/StatusUpdate
TaskCreate/Complete/Delete
NoteCreate/Delete
InvoiceCreate/Update/Delete/Void/Paid/PartiallyPaid
OrderCreate/StatusUpdate
And many more...

Environment Configuration
Required Variables
bash# MongoDB connection
MONGODB_URI=mongodb+srv://...

# Cron job authentication
CRON_SECRET=lpai_cron_2024_xK9mN3pQ7rL5vB8wT6yH2jF4

# GHL OAuth credentials
GHL_MARKETPLACE_CLIENT_ID=683aa5ce1a9647760b904986-mbc8v930
GHL_MARKETPLACE_CLIENT_SECRET=a6ec6cdc-047d-41d0-bcc5-96de0acd37d3
GHL_MARKETPLACE_SHARED_SECRET=aafa362b-0e65-48d8-8373-8277026090e6
Vercel Configuration
Current vercel.json:
json{
  "crons": [{
    "path": "/api/cron/process-webhooks",
    "schedule": "* * * * *"
  }]
}
Testing Current Implementation
1. Check Queue Status
javascript// In MongoDB console
db.webhook_queue.countDocuments({ status: "pending" })
db.webhook_queue.find({ status: "failed" }).limit(5)
2. Manually Process Queue
bashcurl https://lpai-backend-omega.vercel.app/api/cron/process-webhooks \
  -H "Authorization: Bearer lpai_cron_2024_xK9mN3pQ7rL5vB8wT6yH2jF4"
3. View Recent Webhooks
javascriptdb.webhook_logs.find().sort({ receivedAt: -1 }).limit(10)
Known Issues

No retry logic - Failed webhooks stay failed
Limited processing - Only 3 event types fully implemented
No pagination - Agency sync limited to 100 locations
No monitoring - Need better visibility into queue health

Implementation Priority
Phase 1 (Current)

 Basic queue system
 Signature verification
 App lifecycle webhooks

Phase 2 (Next)

 Contact webhooks
 Appointment webhooks
 Token refresh logic
 Retry mechanism

Phase 3 (Future)

 All remaining webhook types
 Webhook analytics dashboard
 Priority queue
 Dead letter queue

Debugging Tips
Check if webhooks are arriving
bashtail -f vercel.log | grep "Native Webhook"
Find stuck webhooks
javascriptdb.webhook_queue.find({
  status: "processing",
  startedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) }
})
Reset failed webhooks
javascriptdb.webhook_queue.updateMany(
  { status: "failed", attempts: { $lt: 3 } },
  { $set: { status: "pending", processAfter: new Date() } }
)
Performance Metrics
Current Settings

Batch size: 50 webhooks per minute
Max attempts: 3
Retry delay: 5 minutes
Queue retention: 24 hours
Hash expiry: 5 minutes

Observed Performance

Average processing time: ~2 seconds per webhook
Success rate: ~95% (mostly INSTALL/UNINSTALL)
Queue depth: Usually < 10 webhooks