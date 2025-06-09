GHL Real-Time Data Updates - Complete Documentation 6/9/2025
Overview
This system maintains real-time data consistency between GoHighLevel (GHL) and MongoDB through webhooks. When data changes in GHL, webhooks notify our system to update MongoDB accordingly.
Architecture
Entry Points
Native Webhooks (OAuth Marketplace App)

Endpoint: /api/webhooks/ghl/native.ts
Authentication: GHL signature verification using public key
Source: GHL marketplace app webhook subscriptions

Workflow Webhooks (Custom Automations)

Email Activity: /api/webhooks/workflow/email-activity.ts
Form Submissions: /api/webhooks/workflow/form-submission.ts
Contact Milestones: /api/webhooks/workflow/contact-milestones.ts
Source: Custom GHL workflows

Processing Flow
1. GHL Event Occurs
2. Webhook Received at Entry Point
3. Router Analyzes Webhook Type
4. QueueManager Adds to MongoDB Queue
5. Cron Job Picks Up from Queue
6. Processor Updates MongoDB
7. Retry on Failure (up to 3 attempts)
Queue System
Queue Types and Priorities
Based on router.ts analysis:
Queue TypePriorityWebhook TypesBatch SizeThroughputcritical1INSTALL, UNINSTALL, PLAN_CHANGE, EXTERNAL_AUTH_CONNECTED10600/hourmessages2InboundMessage, OutboundMessage, ConversationUnreadUpdate, LCEmailStats503,000/hourcontacts3ContactCreate/Update/Delete, ContactDndUpdate, ContactTagUpdate, NoteCreate/Update/Delete, TaskCreate/Complete/Delete503,000/hourappointments3AppointmentCreate/Update/Delete503,000/hourprojects3OpportunityCreate/Update/Delete, OpportunityStatusUpdate, OpportunityStageUpdate, OpportunityMonetaryValueUpdate, OpportunityAssignedToUpdate503,000/hourfinancial3InvoiceCreate/Update/Delete/Sent/Paid/PartiallyPaid/Void, OrderCreate/StatusUpdate, ProductCreate/Update/Delete, PriceCreate/Update/Delete301,800/hourgeneral5UserCreate, LocationCreate/Update, CampaignStatusUpdate, Custom Objects, Associations1006,000/hour
Queue Processing
Cron Jobs (Run every minute)

process-critical.ts → CriticalProcessor
process-messages.ts → MessagesProcessor
process-contacts.ts → ContactsProcessor
process-appointments.ts → AppointmentsProcessor
process-projects.ts → ProjectsProcessor
process-financial.ts → FinancialProcessor
process-general.ts → GeneralProcessor

Retry Logic

Max attempts: 3 (5 for critical)
Exponential backoff: 1 min → 5 min → 15 min → 1 hour → 24 hours
Failed webhooks marked as 'dead' after max attempts

System Capacity
Processing Throughput

7 cron jobs running every minute
50-second runtime limit per cron execution
Theoretical Maximum: ~300-400 webhooks/minute
Daily Capacity: ~432,000 webhooks/day

Client Capacity by Activity Level
Activity Estimates Per Client/Location
Client TypeDaily WebhooksBreakdownLow Activity30-402-5 contacts, 1-2 appointments/week, 2-3 messages/dayMedium Activity250-30020-30 contacts, 5-10 appointments, 50-100 messages/dayHigh Activity1,000-1,500100+ contacts, 20-30 appointments, 200-500 messages/day
Maximum Clients by Type
Client TypeMax ClientsComfortable (70%)Low Activity~10,000-14,0007,000-10,000Medium Activity~1,400-1,7001,000-1,200High Activity~280-430200-300
Realistic Mix (Typical SaaS)

70% Low activity = 5,000 clients
25% Medium activity = 300 clients
5% High activity = 30 clients
Total Capacity: ~5,300 clients

Scaling Milestones
Client CountStatusAction Required0-1,000✅ ExcellentNo action needed1,000-2,000✅ ComfortableMonitor metrics2,000-3,500⚠️ MonitorOptimize batch sizes3,500-5,000⚠️ Pushing limitsPlan architecture upgrade5,000-7,500❌ StrugglingImplement scaling solutions7,500+❌ Over capacityArchitecture redesign required
Bottlenecks

Cron Frequency - 1-minute intervals (main limiting factor)
MongoDB Operations - ~1,000-2,000 DB ops/minute
Vercel Limits - 60-second max function duration
Concurrent Executions - Depends on Vercel plan

Quick Scaling Options (Before Redesign)

Increase batch sizes - Process 100-200 items per run
Reduce cron intervals - 30 seconds = 2x capacity
Add parallel processors - Multiple crons per type
Upgrade Vercel plan - More concurrent functions

Processors
Base Processor
All processors extend BaseProcessor which provides:

Database connection management
Queue item processing
Error handling and retry logic
Metrics tracking
Processing limits (50 seconds max runtime)

Processor Responsibilities
CriticalProcessor

Handles app installation/uninstallation
Processes plan changes
Triggers location setup on install
Manages install retry queue

MessagesProcessor

Processes inbound/outbound messages (SMS, Email, WhatsApp)
Updates conversation records
Handles email statistics (LCEmailStats)
Creates contact if not exists

ContactsProcessor

Creates/updates/deletes contacts
Processes contact tags and DND settings
Handles related notes and tasks
Updates contact activity timestamps

AppointmentsProcessor

Creates/updates/deletes appointments
Links appointments to contacts
Updates project timelines for appointments

ProjectsProcessor

Manages opportunities as projects
Tracks status, stage, and value changes
Maintains project timeline history
Links projects to contacts

FinancialProcessor

Processes invoices and payments
Handles orders and order status
Manages products and pricing
Updates project financials

GeneralProcessor

Handles all other webhook types
Processes user and location updates
Stores unrecognized webhook types for discovery

Database Operations
Collections Updated

webhook_queue - Processing queue
webhook_metrics - Performance tracking
contacts - Customer records
conversations - Message threads
messages - Individual messages
appointments - Calendar events
projects - Opportunities/jobs
invoices - Financial records
orders - Order records
notes - Contact notes
tasks - Contact tasks
locations - Company/location settings
users - System users

Key Patterns
Upsert Operations
javascriptawait db.collection('contacts').updateOne(
  { ghlContactId: contactId, locationId },
  { $set: updateData },
  { upsert: true }
);
Multi-tenant Isolation
Every query includes locationId to ensure data isolation between tenants.
Soft Deletes
Deletions set deleted: true rather than removing records.
Webhook Types Reference
Native Webhooks (OAuth App)
Installation/Setup

INSTALL - App installed
UNINSTALL - App removed
PLAN_CHANGE - Subscription changed

Contacts

ContactCreate
ContactUpdate
ContactDelete
ContactDndUpdate
ContactTagUpdate

Messaging

InboundMessage
OutboundMessage
ConversationUnreadUpdate
LCEmailStats

Calendar

AppointmentCreate
AppointmentUpdate
AppointmentDelete

Projects/Opportunities

OpportunityCreate
OpportunityUpdate
OpportunityDelete
OpportunityStatusUpdate
OpportunityStageUpdate
OpportunityMonetaryValueUpdate
OpportunityAssignedToUpdate

Financial

InvoiceCreate/Update/Delete
InvoiceSent/Paid/PartiallyPaid/Void
OrderCreate/StatusUpdate
ProductCreate/Update/Delete
PriceCreate/Update/Delete

Other

UserCreate
LocationCreate/Update
NoteCreate/Update/Delete
TaskCreate/Complete/Delete

Workflow Webhooks (Custom)
Email Activity (/api/webhooks/workflow/email-activity)

email_opened
email_clicked
email_bounced
email_unsubscribed
email_complained

Form Submissions (/api/webhooks/workflow/form-submission)

Various form types (quote_request, survey, etc.)

Contact Milestones (/api/webhooks/workflow/contact-milestones)

birthday_reminder
custom_date_reminder
engagement_score_changed
task_reminder/task_overdue
stale_opportunity

Monitoring
Health Check
Endpoint: /api/webhooks/status
Provides:

Queue depths by type
Recent processing statistics
Last processor run times

Metrics Tracking
Each webhook is tracked in webhook_metrics with:

Processing time
Queue wait time
Total latency
Success/failure status
Performance grade (A+ to F)

Error Handling
Common Issues
Webhook Verification Failed

Check GHL public key
Verify signature header presence

Processing Timeouts

Processors have 50-second runtime limit
Large batches may need size reduction

Duplicate Webhooks

Queue system prevents duplicate processing
Webhook ID used as unique identifier

Failed Webhook Recovery

Check webhook_queue for items with status: 'failed'
Review lastError field for failure reason
Items retry automatically with exponential backoff
After max attempts, status becomes 'dead'

Development
Adding New Webhook Types

Update Router (router.ts)

Add type to appropriate case in analyzeWebhook()
Set correct queue type and priority


Update Processor

Add case in relevant processor's processItem() method
Implement processing logic


Update Specialized Types (if needed)

Add to processor's handled types



Testing Webhooks
Monitor webhook processing:
javascript// Check pending webhooks
db.webhook_queue.find({ status: "pending" })

// Check failed webhooks
db.webhook_queue.find({ status: "failed" })

// View processing metrics
db.webhook_metrics.find().sort({ createdAt: -1 }).limit(10)
Notes

MongoDB is the source of truth, not GHL
All updates are one-way (GHL → MongoDB)
Workflow webhooks supplement native webhooks for additional event types
Install retry queue handles special cases for installation failures
System designed for growing SaaS (up to ~5,000 active clients)
Architecture redesign needed for enterprise scale (10,000+ clients)