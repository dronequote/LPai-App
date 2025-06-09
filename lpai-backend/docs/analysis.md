📄 /src/utils/sync/syncPipelines.ts

Purpose: Syncs pipeline configurations from GHL to MongoDB
Status: Active
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely sync orchestration endpoints)
External Services: GHL API (opportunities/pipelines endpoint)
Key Exports/Functions: syncPipelines(db, location)
Database Collections: Writes to 'locations' (updates pipelines field)
Critical Notes: Uses GHL API version 2021-07-28, handles 401/403/404 errors

📄 /src/utils/sync/syncCalendars.ts

Purpose: Syncs calendar configurations from GHL to MongoDB
Status: Active
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely sync orchestration endpoints)
External Services: GHL API (calendars endpoint)
Key Exports/Functions: syncCalendars(db, location), getCalendarIcon(name)
Database Collections: Writes to 'locations' (updates calendars field)
Critical Notes: Uses older API version 2021-04-15, assigns icons based on calendar names

📄 /src/utils/sync/syncLocationDetails.ts

Purpose: Syncs detailed location information from GHL
Status: Active
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely sync orchestration endpoints)
External Services: GHL API (locations endpoint)
Key Exports/Functions: syncLocationDetails(db, location)
Database Collections: Writes to 'locations' (updates location details)
Critical Notes: Maps business details, settings, social links

📄 /src/utils/sync/setupDefaults.ts

Purpose: Creates default configuration for new locations
Status: Active
Dependencies: mongodb only
Used By: Unknown (likely during location setup)
External Services: None
Key Exports/Functions: setupDefaults(db, location)
Database Collections: Writes to 'locations', 'emailTemplates', 'libraries'
Critical Notes: Contains hardcoded terms & conditions and email templates

📄 /src/utils/sync/syncUsers.ts

Purpose: Syncs users from GHL and creates local accounts
Status: Active
Dependencies: axios, mongodb, bcryptjs, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely sync orchestration endpoints)
External Services: GHL API (users endpoint)
Key Exports/Functions: syncUsers(db, location), mapGHLRole(), mapGHLPermissions(), generateTempPassword()
Database Collections: Writes to 'users'
Critical Notes: Creates temporary passwords, sets needsPasswordReset flag

📄 /src/utils/sync/syncCustomValues.ts

Purpose: Syncs custom field values from GHL location
Status: Active
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely sync orchestration endpoints)
External Services: GHL API (locations/customValues endpoint)
Key Exports/Functions: syncCustomValues(db, location)
Database Collections: Writes to 'locations' (updates customValues field)
Critical Notes: Stores both raw and camelCase versions of field names

📄 /src/utils/sync/contacts-full.ts

Purpose: API endpoint for triggering full contact sync
Status: Active (but misplaced - should be in /pages/api/)
Dependencies: Next.js, mongodb, syncContacts from './syncContacts'
Used By: HTTP POST requests
External Services: None directly
Key Exports/Functions: Default Next.js API handler
Database Collections: Reads 'locations'
Critical Notes: 300 second timeout, processes 100 contacts at a time

📄 /src/utils/sync/syncOpportunities.ts

Purpose: Syncs GHL opportunities to MongoDB projects
Status: Active
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely sync orchestration endpoints)
External Services: GHL API (opportunities/search endpoint)
Key Exports/Functions: syncOpportunities(db, location, options), mapGHLStatusToProjectStatus()
Database Collections: Reads 'contacts', writes to 'projects'
Critical Notes: Requires contacts to exist first, maps custom fields for project_title, quote_number, signed_date

📄 /src/utils/sync/syncMessages.ts

Purpose: Syncs messages for a specific conversation
Status: Active
Dependencies: axios, mongodb
Used By: syncConversations.ts
External Services: GHL API (conversations/messages endpoint)
Key Exports/Functions: syncMessages(db, location, options)
Database Collections: Writes to 'messages'
Critical Notes: Uses API version 2021-04-15, stores email references only (not content)

📄 /src/utils/sync/syncAppointments.ts

Purpose: Syncs calendar appointments from GHL
Status: Active
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely sync orchestration endpoints)
External Services: GHL API (calendars/events endpoint)
Key Exports/Functions: syncAppointments(db, location, options), mapGHLAppointmentStatus()
Database Collections: Reads 'contacts', 'users', writes to 'appointments'
Critical Notes: Default date range -30 to +90 days, requires contacts to exist

📄 /src/lib/mongodb.ts

Purpose: MongoDB connection singleton for Next.js
Status: Active
Dependencies: mongodb driver
Used By: All API endpoints and sync functions
External Services: MongoDB Atlas
Key Exports/Functions: Default export clientPromise
Database Collections: N/A (connection only)
Critical Notes: Uses global variable in development to prevent connection issues

📄 /src/styles/globals.css

Purpose: Global CSS styles and variables
Status: Active
Dependencies: None
Used By: _app.tsx
External Services: None
Key Exports/Functions: CSS variables for light/dark mode
Database Collections: N/A
Critical Notes: Minimal styling for API backend

📄 /src/global.d.ts

Purpose: TypeScript global type definitions
Status: Active
Dependencies: mongodb types
Used By: TypeScript compiler
External Services: None
Key Exports/Functions: Global MongoDB client promise type
Database Collections: N/A
Critical Notes: Prevents TypeScript errors for global MongoDB variable

📄 /src/styles/Home.module.css

Purpose: Styles for default Next.js homepage
Status: Deprecated (not used in API backend)
Dependencies: None
Used By: index.tsx (which is also deprecated)
External Services: None
Key Exports/Functions: CSS module styles
Database Collections: N/A
Critical Notes: Can be deleted

📄 /src/utils/analytics/webhookAnalytics.ts

Purpose: Records and analyzes webhook processing performance metrics
Status: Active
Dependencies: mongodb
Used By: dailyReport.ts, enhancedDailyReport.ts
External Services: None
Key Exports/Functions: WebhookAnalytics class with methods: recordWebhookReceived(), recordProcessingStarted(), recordProcessingCompleted(), getAnalytics()
Database Collections: Reads/writes 'webhook_metrics'
Critical Notes: Tracks SLA compliance, processing durations

📄 /src/utils/email/emailService.ts

Purpose: Email delivery service wrapper
Status: Active
Dependencies: resend
Used By: All report generators
External Services: Resend API
Key Exports/Functions: EmailService class with sendReport() method
Database Collections: None
Critical Notes: Uses RESEND_API_KEY environment variable

📄 /src/utils/reports/dailyReport.ts

Purpose: Basic daily webhook performance report generator
Status: Likely deprecated (superseded by enhancedDailyReport.ts)
Dependencies: mongodb, WebhookAnalytics, EmailService
Used By: Unknown (cron job likely)
External Services: Resend (via EmailService)
Key Exports/Functions: DailyReportGenerator class
Database Collections: Reads 'webhook_queue', 'locations', writes to 'reports', 'settings'
Critical Notes: Generates HTML report, sends to configured recipients

📄 /src/utils/sync/syncInvoices.ts

Purpose: Syncs invoices from GHL to MongoDB
Status: Active
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely sync orchestration endpoints)
External Services: GHL API (invoices endpoint)
Key Exports/Functions: syncInvoices(db, location, options)
Database Collections: Writes to 'invoices', updates 'locations'
Critical Notes: Stores amounts in cents, handles line items

📄 /src/utils/sync/syncCustomFields.ts

Purpose: Creates and syncs custom field definitions from GHL
Status: Active
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely during setup)
External Services: GHL API (customFields endpoint)
Key Exports/Functions: syncCustomFields(db, location)
Database Collections: Writes to 'locations' (updates customFieldsByModel)
Critical Notes: Creates required fields if missing: project_title, quote_number, signed_date

📄 /src/utils/sync/syncTasks.ts

Purpose: Syncs tasks from GHL to MongoDB
Status: Active
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely sync orchestration endpoints)
External Services: GHL API (tasks/search endpoint)
Key Exports/Functions: syncTasks(db, location, options)
Database Collections: Writes to 'tasks'
Critical Notes: Uses POST for search endpoint, local date filtering

📄 /src/utils/sync/syncContactNotes.ts

Purpose: Syncs notes for a specific contact
Status: Active
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely contact detail endpoints)
External Services: GHL API (contacts/notes endpoint)
Key Exports/Functions: syncContactNotes(db, location, contactId)
Database Collections: Reads 'contacts', writes to 'notes'
Critical Notes: Requires MongoDB contact ID, maps to GHL contact ID

📄 /src/utils/sync/syncTags.ts

Purpose: Syncs all tags from GHL location
Status: Active
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: Unknown (likely sync orchestration endpoints)
External Services: GHL API (locations/tags endpoint)
Key Exports/Functions: syncTags(db, location), generateTagColor(tag)
Database Collections: Writes to 'tags'
Critical Notes: Deletes all existing tags before sync, auto-generates colors

📄 /src/utils/sync/syncContacts.ts

Purpose: Syncs contacts from GHL with advanced pagination
Status: Active (1066 lines)
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth'
Used By: contacts-full.ts endpoint
External Services: GHL API (contacts endpoint)
Key Exports/Functions: syncContacts(db, location, options)
Database Collections: Writes to 'contacts', updates 'locations'
Critical Notes: Rate limiting (8 req/sec), max 50 requests per run, handles full sync with automatic pagination

📄 /src/utils/sync/syncConversations.ts

Purpose: Syncs conversations with circuit breaker pattern
Status: Active (611 lines)
Dependencies: axios, mongodb, getAuthHeader from '../ghlAuth', syncMessages
Used By: Unknown (likely sync orchestration endpoints)
External Services: GHL API (conversations/search endpoint)
Key Exports/Functions: syncConversations(db, location, options)
Database Collections: Reads 'contacts', 'projects', writes to 'conversations', updates 'locations'
Critical Notes: Circuit breaker after 3 consecutive failures, syncs messages for each conversation

📄 /src/utils/reports/enhancedDailyReport.ts

Purpose: Advanced daily report with rich analytics and HTML formatting
Status: Active (1141 lines)
Dependencies: mongodb, EmailService
Used By: Unknown (cron job likely)
External Services: Resend (via EmailService)
Key Exports/Functions: EnhancedDailyReportGenerator class
Database Collections: Reads 'webhook_queue', 'locations', 'webhook_metrics', writes to 'reports'
Critical Notes: Calculates system health score, provides actionable insights

📄 /src/utils/reports/enhancedWeeklyReport.ts

Purpose: Comprehensive weekly report with trend analysis
Status: Active (943 lines)
Dependencies: mongodb, EmailService
Used By: Unknown (cron job likely)
External Services: Resend (via EmailService)
Key Exports/Functions: EnhancedWeeklyReportGenerator class
Database Collections: Reads 'webhook_queue', 'locations', 'webhook_metrics', writes to 'reports'
Critical Notes: Week-over-week comparisons, financial impact analysis

📄 /src/utils/reports/weeklyReport.ts

Purpose: Basic weekly report generator
Status: Likely deprecated (superseded by enhancedWeeklyReport.ts)
Dependencies: mongodb, WebhookAnalytics, EmailService
Used By: Unknown (cron job likely)
External Services: Resend (via EmailService)
Key Exports/Functions: WeeklyReportGenerator class
Database Collections: Multiple collections for analytics
Critical Notes: Simpler implementation than enhanced version

📄 /src/pages/_app.tsx

Purpose: Next.js app wrapper component
Status: Active
Dependencies: Next.js, globals.css
Used By: All Next.js pages
External Services: None
Key Exports/Functions: Default Next.js App component
Database Collections: N/A
Critical Notes: Standard Next.js setup

📄 /src/pages/api/appointments.ts

Purpose: Basic API endpoint to fetch all appointments
Status: Active (needs improvement)
Dependencies: Next.js, mongodb
Used By: Unknown
External Services: MongoDB
Key Exports/Functions: GET handler
Database Collections: Reads 'appointments'
Critical Notes: No pagination, no locationId filtering, security issue

📄 /src/pages/api/hello.ts

Purpose: Example Next.js API route
Status: Deprecated (should be removed)
Dependencies: Next.js
Used By: None
External Services: None
Key Exports/Functions: GET handler returning "John Doe"
Database Collections: N/A
Critical Notes: Default Next.js example file

📄 /src/pages/index.tsx

Purpose: Default Next.js homepage
Status: Deprecated (not needed for API backend)
Dependencies: Next.js components, Home.module.css
Used By: Root URL visitors
External Services: None
Key Exports/Functions: Home component
Database Collections: N/A
Critical Notes: Should be replaced with API documentation

📄 /src/pages/_document.tsx

Purpose: Custom Next.js document structure
Status: Active
Dependencies: Next.js document components
Used By: All pages (Next.js framework)
External Services: None
Key Exports/Functions: Document component
Database Collections: N/A
Critical Notes: Sets HTML lang attribute

📄 /src/pages/api/reports/settings.ts

Purpose: API endpoint for managing report email recipients
Status: Active
Dependencies: Next.js, mongodb
Used By: Unknown (admin interface likely)
External Services: MongoDB
Key Exports/Functions: GET/POST handlers
Database Collections: Reads/writes 'settings'
Critical Notes: Uses type: 'reportRecipients' in settings collection

📄 /src/lib/init-middleware.ts

Purpose: Middleware initialization helper for Next.js
Status: Active
Dependencies: None
Used By: cors.ts
External Services: None
Key Exports/Functions: initMiddleware() function
Database Collections: N/A
Critical Notes: Converts Express-style middleware to Next.js

📄 /src/lib/cors.ts

Purpose: CORS configuration for API endpoints
Status: Active
Dependencies: cors package, init-middleware
Used By: API endpoints that need CORS
External Services: None
Key Exports/Functions: Configured CORS middleware
Database Collections: N/A
Critical Notes: Allows localhost:3000 only

📄 lpai-backend/src/utils/smsTemplates.ts

Purpose: Process SMS templates with variable replacement for dynamic messaging
Status: Active
Dependencies: None
Used By: SMS sending functionality (specific files not shown)
External Services: None
Key Exports/Functions: processTemplate(template, data) - replaces {variables} with actual values
Database Collections: None (utility function)
Critical Notes: Handles user, location, contact, appointment, project variables. Removes unmatched variables to prevent template errors

📄 lpai-backend/src/utils/webhookProcessor.ts

Purpose: Legacy webhook processor for custom webhook format (not native GHL webhooks)
Status: Deprecated (replaced by native webhook system)
Dependencies: mongodb
Used By: Legacy webhook endpoints
External Services: None
Key Exports/Functions: processWebhook - processes different webhook types including contact_changed, appointment events, opportunity events, message_received
Database Collections: webhook_queue, contacts, appointments, projects, messages
Critical Notes: DEPRECATED - Use nativeWebhookProcessor.ts instead. Contains deduplication logic and handles contact/appointment/opportunity sync

📄 lpai-backend/src/utils/deduplication.ts

Purpose: Prevent duplicate webhook processing using hash-based deduplication
Status: Active
Dependencies: crypto
Used By: Webhook processing system
External Services: None
Key Exports/Functions: isDuplicateWebhook, createWebhookHash, shouldProcessWebhook
Database Collections: webhook_hashes, locations
Critical Notes: Uses MD5 hashing with 1-minute window for duplicate detection. Checks location existence for multi-tenant security

📄 lpai-backend/src/utils/sync/syncPipelines.ts

Purpose: Sync sales pipelines and stages from GoHighLevel to MongoDB
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Location setup and sync endpoints
External Services: GoHighLevel API
Key Exports/Functions: syncPipelines(db, location)
Database Collections: locations (updates pipelines field)
Critical Notes: Uses GHL API version 2021-07-28. Sorts stages by position. Handles auth errors gracefully

📄 lpai-backend/src/utils/sync/syncCalendars.ts

Purpose: Sync calendar configurations from GoHighLevel to MongoDB
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Location setup and sync endpoints
External Services: GoHighLevel API
Key Exports/Functions: syncCalendars(db, location)
Database Collections: locations (updates calendars field)
Critical Notes: Uses older API version 2021-04-15 for calendar endpoints. Assigns icons based on calendar names. Stores complete calendar settings including scheduling rules

📄 lpai-backend/src/utils/sync/syncLocationDetails.ts

Purpose: Sync location business details and settings from GoHighLevel
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Location setup and sync endpoints
External Services: GoHighLevel API
Key Exports/Functions: syncLocationDetails(db, location)
Database Collections: locations (updates business info, settings, social)
Critical Notes: Fetches complete location profile including timezone, contact settings, social links. Critical for multi-tenant configuration

📄 lpai-backend/src/utils/sync/setupDefaults.ts

Purpose: Initialize default settings for new locations (terms, email templates, product library)
Status: Active
Dependencies: mongodb
Used By: Location setup process
External Services: None
Key Exports/Functions: setupDefaults(db, location)
Database Collections: locations, emailTemplates, libraries
Critical Notes: Creates default terms & conditions, contract signed email template, and starter product library. Over 500 lines

📄 lpai-backend/src/utils/refreshGHLToken.ts

Purpose: Refresh expired GoHighLevel OAuth tokens
Status: Active
Dependencies: axios, mongodb
Used By: GHL API authentication system
External Services: GoHighLevel OAuth
Key Exports/Functions: refreshGHLToken, tokenNeedsRefresh
Database Collections: locations (updates ghlOAuth tokens)
Critical Notes: Refreshes tokens within 1 hour of expiry. Marks location for reauth if refresh fails. Critical for OAuth-based integrations

📄 lpai-backend/src/utils/sync/syncUsers.ts

Purpose: Sync users from GoHighLevel location to MongoDB
Status: Active
Dependencies: axios, mongodb, ghlAuth, bcryptjs
Used By: Location setup and sync endpoints
External Services: GoHighLevel API
Key Exports/Functions: syncUsers(db, location)
Database Collections: users
Critical Notes: Creates users with temporary passwords requiring reset. Maps GHL roles to system roles (admin/user/viewer). Handles permissions mapping

📄 lpai-backend/src/utils/sync/syncCustomValues.ts

Purpose: Sync location-specific custom values from GoHighLevel
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Location setup process
External Services: GoHighLevel API
Key Exports/Functions: syncCustomValues(db, location)
Database Collections: locations (updates customValues field)
Critical Notes: Converts custom value names to camelCase for easier access. Stores both raw and processed formats

📄 lpai-backend/src/utils/sync/contacts-full.ts

Purpose: API endpoint handler for full contact sync operation
Status: Active
Dependencies: Next.js API, mongodb, syncContacts
Used By: Manual sync triggers
External Services: None (calls syncContacts)
Key Exports/Functions: Default Next.js API handler
Database Collections: None (calls syncContacts)
Critical Notes: 5-minute timeout configured. Processes 100 contacts at a time for full sync

📄 lpai-backend/src/utils/messageHandlers.ts

Purpose: Process different message types (SMS, Email, WhatsApp) for storage
Status: Active
Dependencies: mongodb
Used By: Message sync and webhook processors
External Services: None
Key Exports/Functions: handleSMSMessage, handleEmailMessage, handleActivityMessage, processMessage
Database Collections: None (returns formatted data)
Critical Notes: Email messages store reference only for lazy loading. Handles activity messages for appointments/contacts/invoices

📄 lpai-backend/src/utils/sync/syncOpportunities.ts

Purpose: Sync opportunities from GoHighLevel and convert to projects
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Sync endpoints
External Services: GoHighLevel API
Key Exports/Functions: syncOpportunities(db, location, options)
Database Collections: projects, contacts
Critical Notes: Maps GHL opportunities to projects. Handles custom fields mapping. Supports pagination for large datasets

📄 lpai-backend/src/utils/sync/syncMessages.ts

Purpose: Sync conversation messages from GoHighLevel
Status: Active
Dependencies: axios, mongodb
Used By: syncConversations
External Services: GoHighLevel API
Key Exports/Functions: syncMessages(db, location, options)
Database Collections: messages
Critical Notes: Email content fetched on-demand to save space. Stores SMS/Activity messages immediately. Links messages to projects if active

📄 lpai-backend/src/utils/sync/syncAppointments.ts

Purpose: Sync calendar appointments from GoHighLevel
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Sync endpoints, location setup
External Services: GoHighLevel API
Key Exports/Functions: syncAppointments(db, location, options)
Database Collections: appointments, contacts, projects
Critical Notes: Syncs last 30 days to next 90 days by default. Uses older API version 2021-04-15. Updates project timelines. Over 500 lines

📄 lpai-backend/src/utils/webhooks/nativeWebhookProcessor.ts

Purpose: Process native GoHighLevel webhooks for all event types
Status: Active
Dependencies: mongodb
Used By: Webhook queue processor
External Services: None
Key Exports/Functions: processNativeWebhook
Database Collections: webhook_queue, contacts, appointments, projects, messages, conversations, locations, app_events
Critical Notes: Main webhook processor - handles 40+ event types. INSTALL/UNINSTALL fully implemented. Many events have stub implementations. Over 500 lines

📄 lpai-backend/src/utils/installQueue.ts

Purpose: Manage app installation queue with locking mechanism
Status: Active
Dependencies: mongodb
Used By: nativeWebhookProcessor (INSTALL events)
External Services: None
Key Exports/Functions: acquireInstallLock, releaseInstallLock, queueInstallForRetry, checkInstallState, cleanupExpiredLocks
Database Collections: install_locks, install_retry_queue, locations
Critical Notes: Prevents duplicate installations with distributed locking. 5-minute lock timeout. Handles installation state tracking

📄 lpai-backend/src/utils/webhooks/queueManager.ts

Purpose: Core webhook queue management system with priority routing
Status: Active
Dependencies: mongodb
Used By: Webhook router and processors
External Services: None
Key Exports/Functions: QueueManager class - addToQueue, getNextBatch, markComplete, markFailed
Database Collections: webhook_queue, webhook_metrics
Critical Notes: Handles queue prioritization, retry logic with exponential backoff, performance metrics. Implements dead letter queue for failed webhooks

📄 lpai-backend/src/utils/webhooks/directProcessor.ts

Purpose: Bypass queue for ultra-low latency message processing
Status: Active
Dependencies: mongodb
Used By: Webhook router (for critical messages)
External Services: None
Key Exports/Functions: processMessageDirect, processInboundMessageDirect, processOutboundMessageDirect, processPaymentDirect
Database Collections: messages, conversations, contacts, payments, invoices
Critical Notes: Designed for <500ms processing. Uses MongoDB sessions for atomic operations. Currently not used - all webhooks go through queue

📄 lpai-backend/src/utils/webhooks/processors/critical.ts

Purpose: Process critical webhooks (INSTALL, UNINSTALL, PLAN_CHANGE)
Status: Active
Dependencies: mongodb, base processor
Used By: Webhook processing system
External Services: Location setup API
Key Exports/Functions: CriticalProcessor class
Database Collections: locations, app_events, sync_queue
Critical Notes: Handles app lifecycle events. Triggers location setup after install. Uses MongoDB sessions for atomic operations

📄 lpai-backend/src/utils/webhooks/processors/base.ts

Purpose: Base class for all webhook processors with common functionality
Status: Active
Dependencies: mongodb, QueueManager
Used By: All webhook processor classes
External Services: None
Key Exports/Functions: BaseProcessor abstract class
Database Collections: processor_logs, webhook_errors
Critical Notes: Implements retry logic, error handling, performance tracking. 50-second max runtime for Vercel. Abstract processItem must be implemented by subclasses. Over 500 lines

📄 lpai-backend/src/utils/webhooks/processors/financial.ts

Purpose: Process financial webhooks (invoices, orders, products, prices)
Status: Active
Dependencies: mongodb, base processor
Used By: Webhook processing system
External Services: None
Key Exports/Functions: FinancialProcessor class
Database Collections: invoices, orders, projects, product_events, price_events
**Critical Notes': Invoice amounts stored in cents. Updates project financials. Handles nested webhook payload structure. Over 500 lines

📄 lpai-backend/src/utils/webhooks/processors/messages.ts

Purpose: Process message webhooks (inbound/outbound messages, conversations)
Status: Active
Dependencies: mongodb, base processor
Used By: Webhook processing system
External Services: None
Key Exports/Functions: MessagesProcessor class
Database Collections: messages, conversations, contacts, email_stats
Critical Notes: Creates contacts if missing. Email content lazy loaded. Handles LCEmailStats for email tracking. Over 500 lines

📄 lpai-backend/src/utils/webhooks/processors/appointments.ts

Purpose: Process appointment webhooks (create, update, delete)
Status: Active
Dependencies: mongodb, base processor
Used By: Webhook processing system
External Services: None
Key Exports/Functions: AppointmentsProcessor class
Database Collections: appointments, projects, contacts
Critical Notes: Updates project timelines on appointment changes. Handles multiple date format fields. Links appointments to contacts and projects

📄 lpai-backend/src/utils/webhooks/processors/general.ts

Purpose: Process general webhooks (opportunities, tasks, notes, campaigns, users)
Status: Active
Dependencies: mongodb, base processor
Used By: Webhook processing system
External Services: None
Key Exports/Functions: GeneralProcessor class
Database Collections: projects, tasks, notes, users, campaign_events, custom_object_events, association_events, unhandled_webhooks
Critical Notes: Catch-all processor for less critical events. Maps opportunities to projects. Many event types stored for future use. Over 500 lines

📄 lpai-backend/src/utils/webhooks/processors/contacts.ts

Purpose: Process contact-related webhooks (CRUD, DND, tags, notes, tasks)
Status: Active
Dependencies: mongodb, base processor
Used By: Webhook processing system
External Services: None
Key Exports/Functions: ContactsProcessor class
Database Collections: contacts, notes, tasks
Critical Notes: Handles contact lifecycle and related entities. Updates contact activity tracking. Creates contact if not found on update. Over 500 lines

📄 lpai-backend/src/utils/webhooks/router.ts

Purpose: Route incoming webhooks to appropriate queues based on type and priority
Status: Active
Dependencies: mongodb, WebhookAnalytics
Used By: Main webhook endpoint
External Services: None
Key Exports/Functions: WebhookRouter class, analyzeWebhook, isSystemHealthy, generateTrackingId
Database Collections: webhook_queue
Critical Notes: Routes to 6 queues: critical, messages, contacts, appointments, financial, general. Priority 1-5. Health checks for queue depth

📄 lpai-backend/src/utils/webhooks/processors/projects.ts

Purpose: Process project/opportunity webhooks (CRUD, status, stage, value updates)
Status: Active
Dependencies: mongodb, base processor
Used By: Webhook processing system
External Services: None
Key Exports/Functions: ProjectsProcessor class
Database Collections: projects, contacts
Critical Notes: Maps GHL opportunities to projects. Maintains project timeline. Handles all opportunity update event types. Over 500 lines

📄 lpai-backend/src/utils/sync/syncInvoices.ts

Purpose: Sync invoices from GoHighLevel to MongoDB
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Sync endpoints
External Services: GoHighLevel API
Key Exports/Functions: syncInvoices(db, location, options)
Database Collections: invoices
Critical Notes: Amounts stored in cents. Complex invoice structure with line items, taxes, discounts. Links to opportunities/contacts

📄 lpai-backend/src/utils/sync/syncCustomFields.ts

Purpose: Sync and create required custom fields in GoHighLevel
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Location setup
External Services: GoHighLevel API
Key Exports/Functions: syncCustomFields(db, location)
Database Collections: locations (updates customFieldMapping)
Critical Notes: Creates project_title, quote_number, signed_date fields if missing. Maps field IDs for opportunity sync

📄 lpai-backend/src/utils/sync/syncTasks.ts

Purpose: Sync tasks from GoHighLevel to MongoDB
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Sync endpoints
External Services: GoHighLevel API
Key Exports/Functions: syncTasks(db, location, options)
Database Collections: tasks
Critical Notes: Uses POST search endpoint. No date filtering in API - filters locally. Links to contacts

📄 lpai-backend/src/utils/sync/syncContactNotes.ts

Purpose: Sync notes for a specific contact from GoHighLevel
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Contact detail endpoints
External Services: GoHighLevel API
Key Exports/Functions: syncContactNotes(db, location, contactId)
Database Collections: notes, contacts
Critical Notes: Requires MongoDB contact ID, fetches by GHL contact ID. One contact at a time

📄 lpai-backend/src/utils/sync/syncTags.ts

Purpose: Sync all tags from GoHighLevel location
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Location setup
External Services: GoHighLevel API
Key Exports/Functions: syncTags(db, location)
Database Collections: tags
Critical Notes: Clears and replaces all tags. Generates colors based on tag name hash. Creates slugs for URL-friendly names

📄 lpai-backend/src/utils/sync/syncContacts.ts

Purpose: Sync contacts from GoHighLevel with pagination and rate limiting
Status: Active
Dependencies: axios, mongodb, ghlAuth
Used By: Sync endpoints, location setup
External Services: GoHighLevel API
Key Exports/Functions: syncContacts(db, location, options)
Database Collections: contacts, locations
Critical Notes: Full sync processes in batches of 100. Rate limited to 8 requests/second. Handles 5k contacts max per run. Over 500 lines

📄 lpai-backend/src/utils/sync/syncConversations.ts

Purpose: Sync conversations and their messages from GoHighLevel
Status: Active
Dependencies: axios, mongodb, ghlAuth, syncMessages
Used By: Sync endpoints
External Services: GoHighLevel API
Key Exports/Functions: syncConversations(db, location, options)
Database Collections: conversations, messages, contacts, projects, locations
Critical Notes: Circuit breaker pattern for failures. Links to projects. Syncs messages for each conversation. Progress tracking. Over 500 lines

📄 lpai-backend/src/utils/ghlAuth.ts

Purpose: Central authentication handler for GoHighLevel API calls
Status: Active
Dependencies: axios, mongodb client
Used By: All GHL sync functions
External Services: GoHighLevel OAuth
Key Exports/Functions: getAuthHeader, tokenNeedsRefresh, refreshOAuthToken, getLocationToken
Database Collections: locations (token updates)
Critical Notes: Handles both OAuth and API key auth. 24-hour buffer for token refresh. Critical for all GHL operations

📄 lpai-backend/pages/api/ghl/[id].ts

Purpose: Syncs individual contact data from MongoDB with GoHighLevel (GHL) by fetching latest data from GHL and updating MongoDB if newer
Status: Active
Dependencies: mongodb, axios, ObjectId from mongodb
Used By: Frontend contact sync operations
External Services: MongoDB, GoHighLevel API
Key Exports/Functions: Default handler for GET requests to sync contact data
Database Collections: contacts (read/update), locations (read for API key)
Critical Notes: Compares dateUpdated timestamps and field changes to determine if MongoDB needs updating. Uses GHL Contact ID stored in MongoDB to fetch from GHL.

📄 lpai-backend/pages/api/contacts/withProjects.ts

Purpose: Fetches all contacts for a location with their associated projects in a single query
Status: Active
Dependencies: mongodb, ObjectId from mongodb
Used By: Frontend contact list views that need project information
External Services: MongoDB
Key Exports/Functions: GET handler that enriches contacts with their projects
Database Collections: contacts (read), projects (read)
Critical Notes: Groups projects by contactId for efficient frontend rendering

📄 lpai-backend/pages/api/appointments/index.ts

Purpose: Creates and retrieves appointments, syncing with GHL calendar events
Status: Active
Dependencies: mongodb, axios, ObjectId from mongodb
Used By: Frontend appointment scheduling features
External Services: MongoDB, GoHighLevel API
Key Exports/Functions: POST (create appointment), GET (fetch appointments)
Database Collections: appointments (read/write), contacts (read), users (read), locations (read)
Critical Notes: Creates in GHL first, then saves locally. Maps MongoDB IDs to GHL IDs. Handles location types (address/phone/custom). Returns both local and GHL response data.

📄 lpai-backend/pages/api/ghl/syncContacts.ts

Purpose: Bulk syncs all contacts from GoHighLevel to MongoDB for a location
Status: Active
Dependencies: mongodb
Used By: Admin sync operations, initial setup
External Services: MongoDB, GoHighLevel API (REST v1)
Key Exports/Functions: POST handler for bulk contact sync
Database Collections: contacts (bulk upsert), locations (read for API key)
Critical Notes: Uses GHL REST v1 API. Maps GHL contact fields to MongoDB schema. Upserts to handle existing contacts.

📄 lpai-backend/pages/api/appointments/[id].ts

Purpose: Updates, cancels, and fetches individual appointments with GHL sync
Status: Active
Dependencies: mongodb, axios, ObjectId, Resend for email notifications
Used By: Frontend appointment detail/edit views
External Services: MongoDB, GoHighLevel API, Resend (email)
Key Exports/Functions: GET (fetch), PATCH/PUT (update/cancel)
Database Collections: appointments (read/update), locations (read)
Critical Notes: Sends failure notification emails to admin on GHL sync failures. Handles appointment cancellation flow. POST method blocked (must use index.ts).

📄 lpai-backend/pages/api/ghl/pipelines/[locationId].ts

Purpose: Syncs pipeline configurations from GoHighLevel to MongoDB
Status: Active
Dependencies: mongodb, axios
Used By: Pipeline configuration sync, location setup
External Services: MongoDB, GoHighLevel API
Key Exports/Functions: Default GET handler for pipeline sync
Database Collections: locations (read/update - stores pipelines in location document)
Critical Notes: Only updates MongoDB if pipelines have changed. Stores full pipeline structure including stages.

📄 lpai-backend/pages/api/libraries/[LocationID].ts

Purpose: Manages product/service libraries with categories and items for quotes
Status: Active
Dependencies: mongodb, ObjectId
Used By: Quote creation features, product management
External Services: MongoDB
Key Exports/Functions: GET (fetch libraries), POST (create library), PATCH (update library/add items)
Database Collections: libraries (read/write)
Critical Notes: Creates default library with Fixtures/Piping/Labor categories if none exist. Supports nested category/item structure with pricing and markup.

📄 lpai-backend/pages/index.ts

Purpose: Simple health check endpoint returning "Endpoint is working"
Status: Active
Dependencies: None
Used By: Health monitoring, uptime checks
External Services: None
Key Exports/Functions: Default function returning status string
Database Collections: None
Critical Notes: Minimal endpoint for verifying backend is responsive

📄 lpai-backend/pages/api/emails/send-contract.ts

Purpose: Sends contract/quote emails with PDF attachments using email templates
Status: Active (507 lines)
Dependencies: mongodb, ObjectId
Used By: Quote signing flow, contract delivery
External Services: MongoDB, GoHighLevel Conversations API
Key Exports/Functions: POST handler to send contract emails
Database Collections: quotes (update activity), contacts (read), locations (read), emailTemplates (read)
Critical Notes: Uses local email templates with variable replacement. Falls back to global templates if location has no custom template. Sends via GHL Conversations API. Logs all email activity in quote's activityFeed.

📄 lpai-backend/pages/api/ghl/calendars/[locationId].ts

Purpose: Syncs calendar configurations from GoHighLevel to MongoDB
Status: Active
Dependencies: mongodb, axios, Calendar type from @lp-ai/types
Used By: Calendar setup, appointment scheduling features
External Services: MongoDB, GoHighLevel API
Key Exports/Functions: Default GET handler for calendar sync
Database Collections: locations (read/update - stores calendars in location document)
Critical Notes: Preserves custom icon assignments when syncing. Only updates if calendars changed. Uses 'star-outline' as default icon for new calendars.

📄 lpai-backend/pages/api/emails/send.ts

Purpose: Generic email sending endpoint via GoHighLevel Conversations API
Status: Active
Dependencies: mongodb, ObjectId
Used By: General email features, message sending
External Services: MongoDB, GoHighLevel Conversations API
Key Exports/Functions: POST handler for sending emails
Database Collections: conversations (upsert), messages (insert), contacts (read), locations (read)
Critical Notes: Creates/updates conversation records. Tracks all messages in messages collection. Supports attachments and threading via replyToMessageId.

📄 lpai-backend/pages/api/conversations/index.ts

Purpose: Fetches conversations (SMS/email) for a location or contact
Status: Active
Dependencies: mongodb, ObjectId
Used By: Conversation/messaging UI
External Services: MongoDB
Key Exports/Functions: GET handler with filtering options
Database Collections: conversations (read with contact lookup join)
Critical Notes: Supports filtering by type (sms/email). Joins with contacts collection for contact info. Limits to 50 most recent.

📄 lpai-backend/pages/api/agencies/sync.ts

Purpose: Syncs all agency/company locations that have OAuth tokens
Status: Active
Dependencies: mongodb
Used By: Admin bulk sync operations
External Services: MongoDB, calls internal /api/oauth/get-location-tokens endpoint
Key Exports/Functions: GET handler for agency-wide sync
Database Collections: locations (read - finds company-level OAuth records)
Critical Notes: Triggers location token sync for each company with OAuth. Returns results summary.

📄 lpai-backend/pages/api/locations/manual-setup.ts

Purpose: Manually triggers full setup process for a specific location
Status: Active
Dependencies: mongodb
Used By: Admin tools, manual setup triggers
External Services: Calls internal /api/locations/setup-location endpoint
Key Exports/Functions: POST handler to trigger location setup
Database Collections: None directly (delegates to setup-location)
Critical Notes: Wrapper endpoint that calls setup-location with fullSync=true

📄 lpai-backend/pages/api/cron/refresh-tokens.ts

Purpose: Cron job to refresh expiring OAuth tokens for all locations
Status: Active
Dependencies: mongodb, ghlAuth utilities
Used By: Vercel cron scheduler
External Services: MongoDB, GoHighLevel OAuth
Key Exports/Functions: Default handler with cron authentication
Database Collections: locations (read/update OAuth tokens)
Critical Notes: Checks for Vercel cron header or Bearer token auth. Refreshes tokens that need refresh. Returns summary of refreshed/failed tokens.

📄 lpai-backend/pages/api/contacts/[contactId]/conversations.ts

Purpose: Fetches all conversations for a specific contact with pagination
Status: Active
Dependencies: mongodb, ObjectId
Used By: Contact detail views, conversation history
External Services: MongoDB
Key Exports/Functions: GET handler with pagination support
Database Collections: contacts (read), conversations (read), messages (aggregate for unread counts)
Critical Notes: Validates contact belongs to location. Calculates unread message counts per conversation. Supports type filtering.

📄 lpai-backend/pages/api/contacts/[contactId].ts

Purpose: Fetches and updates individual contacts with GHL sync
Status: Active
Dependencies: mongodb, axios, ObjectId
Used By: Contact detail/edit features
External Services: MongoDB, GoHighLevel API
Key Exports/Functions: GET (fetch contact), PATCH (update contact)
Database Collections: contacts (read/update), locations (read for API key)
Critical Notes: Updates MongoDB first, then syncs to GHL. Only sends specific fields to GHL (no locationId on update). Falls back gracefully if GHL sync fails.

📄 lpai-backend/pages/api/conversations/[conversationId]/messages.ts

Purpose: Fetches messages for a conversation with pagination and marks as read
Status: Active
Dependencies: mongodb, ObjectId
Used By: Message thread views
External Services: MongoDB
Key Exports/Functions: GET handler with message formatting
Database Collections: conversations (read/update), messages (read/update)
Critical Notes: Handles different message types (SMS/Email/Activity). Marks messages as read automatically. Updates conversation unread count.

📄 lpai-backend/pages/api/analytics/installs/[locationId].ts

Purpose: Generates detailed installation analytics for a specific location
Status: Active (609 lines)
Dependencies: mongodb
Used By: Install analytics UI
External Services: MongoDB
Key Exports/Functions: GET handler returning InstallAnalytics data
Database Collections: locations (read), webhook_metrics (read/aggregate)
Critical Notes: Analyzes setup steps, calculates performance grades, identifies bottlenecks, generates recommendations. Compares against system-wide averages.

📄 lpai-backend/pages/api/analytics/installs/[locationId]/ui.ts

Purpose: Renders interactive HTML dashboard for installation analytics
Status: Active (757 lines)
Dependencies: mongodb
Used By: Direct browser access for analytics visualization
External Services: MongoDB, calls internal analytics API
Key Exports/Functions: GET handler returning HTML with Chart.js visualizations
Database Collections: locations (read for dropdown)
Critical Notes: Generates full HTML page with particles.js background, Chart.js graphs, real-time animations. Includes location dropdown for navigation.

📄 lpai-backend/pages/api/cron/process-messages.ts

Purpose: Cron job to process message webhooks using MessagesProcessor
Status: Active
Dependencies: mongodb, MessagesProcessor utility
Used By: Vercel cron scheduler
External Services: MongoDB
Key Exports/Functions: Default handler with 60s max duration
Database Collections: Delegated to MessagesProcessor
Critical Notes: Verifies cron secret. Returns runtime statistics.

📄 lpai-backend/pages/api/cron/process-appointments.ts

Purpose: Cron job to process appointment webhooks using AppointmentsProcessor
Status: Active
Dependencies: mongodb, AppointmentsProcessor utility
Used By: Vercel cron scheduler
External Services: MongoDB
Key Exports/Functions: Default handler with 60s max duration
Database Collections: Delegated to AppointmentsProcessor
Critical Notes: Verifies cron secret. Returns runtime statistics.

📄 lpai-backend/pages/api/cron/process-contacts.ts

Purpose: Cron job to process contact webhooks using ContactsProcessor
Status: Active
Dependencies: mongodb, ContactsProcessor utility
Used By: Vercel cron scheduler
External Services: MongoDB
Key Exports/Functions: Default handler with 60s max duration
Database Collections: Delegated to ContactsProcessor
Critical Notes: Verifies cron secret. Returns runtime statistics.

📄 lpai-backend/pages/api/cron/process-financial.ts

Purpose: Cron job to process financial webhooks using FinancialProcessor
Status: Active
Dependencies: mongodb, FinancialProcessor utility
Used By: Vercel cron scheduler
External Services: MongoDB
Key Exports/Functions: Default handler with 60s max duration
Database Collections: Delegated to FinancialProcessor
Critical Notes: Verifies cron secret. Returns runtime statistics.

📄 lpai-backend/pages/api/cron/process-general.ts

Purpose: Cron job to process general webhooks using GeneralProcessor
Status: Active
Dependencies: mongodb, GeneralProcessor utility
Used By: Vercel cron scheduler
External Services: MongoDB
Key Exports/Functions: Default handler with 60s max duration
Database Collections: Delegated to GeneralProcessor
Critical Notes: Verifies cron secret. Returns runtime statistics.

📄 lpai-backend/pages/api/cron/process-webhooks.ts

Purpose: Main webhook processing cron that routes to appropriate processors
Status: Active
Dependencies: mongodb, processWebhook, processNativeWebhook utilities
Used By: Vercel cron scheduler
External Services: MongoDB
Key Exports/Functions: Default handler processing up to 50 webhooks per run
Database Collections: webhook_queue (read/update/delete), webhook_logs (delete old)
Critical Notes: Skips specialized webhook types for dedicated processors. Routes native vs workflow webhooks. Cleans up old completed webhooks. Max 60s duration.

📄 lpai-backend/pages/api/cron/process-critical.ts

Purpose: High-priority webhook processing using CriticalProcessor
Status: Active
Dependencies: mongodb, CriticalProcessor utility
Used By: Vercel cron scheduler
External Services: MongoDB
Key Exports/Functions: Default handler with self-triggering capability
Database Collections: webhook_queue (count), processor_logs (read)
Critical Notes: Prevents overlapping runs. Self-triggers if more items pending and time allows.

📄 lpai-backend/pages/api/cron/process-projects.ts

Purpose: Cron job to process project/opportunity webhooks using ProjectsProcessor
Status: Active
Dependencies: mongodb, ProjectsProcessor utility
Used By: Vercel cron scheduler
External Services: MongoDB
Key Exports/Functions: Default handler with 60s max duration
Database Collections: Delegated to ProjectsProcessor
Critical Notes: Verifies cron secret. Returns runtime statistics.

📄 lpai-backend/pages/api/cron/process-install-queue.ts

Purpose: Processes installation retry queue and sync jobs
Status: Active
Dependencies: mongodb, processNativeWebhook, cleanupExpiredLocks utilities
Used By: Vercel cron scheduler
External Services: MongoDB
Key Exports/Functions: Default handler processing install retries and sync queue
Database Collections: install_retry_queue (read/update), sync_queue (read/update)
Critical Notes: Cleans expired locks. Handles exponential backoff for retries. Processes agency sync jobs.

📄 lpai-backend/pages/api/analytics/dashboard-ui.ts

Purpose: Renders comprehensive analytics dashboard HTML with real-time metrics
Status: Active (926 lines)
Dependencies: mongodb
Used By: Direct browser access for system analytics
External Services: MongoDB, calls internal dashboard API
Key Exports/Functions: GET handler returning HTML dashboard
Database Collections: locations (read for navigation)
Critical Notes: Particles.js background, Chart.js visualizations, real-time updates. Supports time range selection. Shows queue health, performance metrics, error tracking.

📄 lpai-backend/pages/api/analytics/dashboard.ts

Purpose: Generates comprehensive analytics data for dashboard visualization
Status: Active (658 lines)
Dependencies: mongodb
Used By: Dashboard UI endpoint
External Services: MongoDB
Key Exports/Functions: GET handler with time range support
Database Collections: webhook_queue (aggregate), webhook_metrics (aggregate)
Critical Notes: Calculates queue statistics, performance metrics, error analysis, webhook type distribution, system health scores, SLA compliance. Supports hour/today/week/month/all time ranges.

📄 lpai-backend/pages/api/locations/setup-location.ts

Purpose: Orchestrates complete location setup including all data syncs
Status: Active (731 lines)
Dependencies: mongodb, axios, all sync utilities
Used By: Install webhooks, manual setup
External Services: MongoDB, GoHighLevel API
Key Exports/Functions: POST handler for full location setup
Database Collections: locations (read/update)
Critical Notes: Handles OAuth token fetching from company level. Runs 11+ sync steps. Tracks progress in syncProgress field. Max 5 minute timeout. Falls back to API key if no OAuth.

📄 lpai-backend/pages/api/cron/daily-report.ts

Purpose: Generates and sends daily analytics reports
Status: Active
Dependencies: mongodb, EnhancedDailyReportGenerator utility
Used By: Vercel cron scheduler (daily)
External Services: MongoDB, Email service via report generator
Key Exports/Functions: Default handler triggering daily reports
Database Collections: Delegated to report generator
Critical Notes: Verifies cron secret. Sends to configured admin email.

📄 lpai-backend/pages/api/cron/weekly-report.ts

Purpose: Generates and sends weekly analytics reports
Status: Active
Dependencies: mongodb, EnhancedWeeklyReportGenerator utility
Used By: Vercel cron scheduler (weekly)
External Services: MongoDB, Email service via report generator
Key Exports/Functions: Default handler triggering weekly reports
Database Collections: Delegated to report generator
Critical Notes: Verifies cron secret. Sends comprehensive weekly summary.

📄 lpai-backend/pages/api/contacts/search/lpai.ts

Purpose: Searches contacts in MongoDB (local database search)
Status: Active
Dependencies: mongodb, httpResponses utilities
Used By: Contact search features
External Services: MongoDB
Key Exports/Functions: GET handler for MongoDB contact search
Database Collections: contacts (read - filters by ghlContactId exists)
Critical Notes: Only returns contacts that have been synced from GHL

📄 lpai-backend/pages/api/contacts/index.ts

Purpose: Creates new contacts in GoHighLevel
Status: Active
Dependencies: mongodb, axios, httpResponses, ghlAuth utilities
Used By: Contact creation features
External Services: MongoDB, GoHighLevel API
Key Exports/Functions: POST handler for contact creation
Database Collections: locations (read via getLocation)
Critical Notes: Formats phone to E.164. Creates in GHL only (not MongoDB). Uses auth from location record.

📄 lpai-backend/pages/api/login/oauth.ts

Purpose: Authenticates users via email and returns JWT token
Status: Active
Dependencies: mongodb, jsonwebtoken
Used By: OAuth/Google login flow
External Services: MongoDB
Key Exports/Functions: POST handler returning JWT and user data
Database Collections: users (read)
Critical Notes: Requires user pre-registration in GHL. Returns user permissions and preferences.

📄 lpai-backend/constants/ghl.ts

Purpose: Defines all GoHighLevel API endpoint URLs
Status: Active
Dependencies: None
Used By: All GHL API integration files
External Services: None (constants only)
Key Exports/Functions: GHL_ENDPOINTS object with nested endpoint builders
Database Collections: None
Critical Notes: Base URL: https://services.leadconnectorhq.com

📄 lpai-backend/pages/api/contacts/search/ghl.ts

Purpose: Searches contacts directly in GoHighLevel API
Status: Active
Dependencies: axios, httpResponses, ghlAuth, cors
Used By: Advanced contact search needing real-time GHL data
External Services: GoHighLevel API
Key Exports/Functions: POST handler for GHL contact search
Database Collections: locations (read via getLocation)
Critical Notes: Bypasses MongoDB for real-time GHL search. Uses Version 2021-07-28.

📄 lpai-backend/pages/api/contacts/[contactId]/sync-notes.ts

Purpose: Syncs notes/activities for a specific contact from GHL
Status: Active
Dependencies: mongodb, syncContactNotes utility
Used By: Contact detail views needing note history
External Services: MongoDB, GoHighLevel API
Key Exports/Functions: POST handler for individual contact note sync
Database Collections: locations (read), notes (via syncContactNotes)
Critical Notes: Uses authenticated DB helper. Syncs notes for single contact on demand.

📄 lpai-backend/pages/api/invoices/create.ts

Purpose: Creates invoices and payment links via GoHighLevel
Status: Active
Dependencies: mongodb, axios, ObjectId
Used By: Invoice creation features
External Services: MongoDB, GoHighLevel API (products, payments)
Key Exports/Functions: Default handler for invoice creation, createPaymentLinkHandler
Database Collections: invoices (insert), payments (insert), locations (read)
Critical Notes: Creates GHL product first, then payment link. Stores both MongoDB invoice and GHL payment records.

📄 lpai-backend/pages/api/locations/byLocation.ts

Purpose: Gets and updates location settings and branding
Status: Active
Dependencies: mongodb, cors
Used By: Location settings UI
External Services: MongoDB
Key Exports/Functions: GET (fetch location), PATCH (update location)
Database Collections: locations (read/update)
Critical Notes: Returns non-sensitive fields only. Handles branding, terms, email templates, company info updates.

📄 lpai-backend/pages/api/install-progress/[locationId].ts

Purpose: Returns current installation progress status
Status: Active
Dependencies: Assumes db is available (missing import)
Used By: Installation progress monitoring
External Services: MongoDB
Key Exports/Functions: Default handler returning progress status
Database Collections: locations (read setupCompleted, setupResults)
Critical Notes: Missing database connection import - appears incomplete

📄 lpai-backend/pages/api/users/byLocation.ts

Purpose: Fetches API key for a specific location from the locations collection (NOT users collection despite the path)
Status: Active
Dependencies: NextApiRequest, NextApiResponse from 'next', clientPromise from mongodb lib
Used By: Unknown (no content provided)
External Services: MongoDB
Key Exports/Functions: Default handler function that retrieves location API key by locationId
Database Collections: locations (read)
Critical Notes: File is misnamed - it fetches from locations collection, not users. Returns 404 if location not found or API key not set

📄 lpai-backend/pages/api/users/index.ts

Purpose: Fetches all users for a specific location
Status: Active
Dependencies: NextApiRequest, NextApiResponse from 'next', clientPromise from mongodb lib
Used By: Unknown (no content provided)
External Services: MongoDB
Key Exports/Functions: Default handler (GET only) that returns users array filtered by locationId
Database Collections: users (read)
Critical Notes: Excludes hashedPassword field from response for security

📄 lpai-backend/pages/api/projects/byContact.ts

Purpose: Fetches all projects associated with a specific contact
Status: Active
Dependencies: NextApiRequest, NextApiResponse from 'next', clientPromise from mongodb lib
Used By: Unknown (no content provided)
External Services: MongoDB
Key Exports/Functions: Default handler that returns projects filtered by contactId
Database Collections: projects (read)
Critical Notes: Returns 402 status code for missing contactId (unusual choice - should be 400)

📄 lpai-backend/pages/api/projects/index.ts

Purpose: GET: Returns all projects for a location with contact info enriched; POST: Creates new project and syncs to GHL as opportunity
Status: Active (537 lines)
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId from mongodb, axios
Used By: Mobile app project screens
External Services: MongoDB, GHL API (opportunities endpoint)
Key Exports/Functions: Default handler with GET/POST methods
Database Collections: projects (read/write), contacts (read), locations (read)
Critical Notes: Attempts to sync new projects to GHL as opportunities if ghlContactId and pipelineId exist. Enriches project responses with contact name/email/phone

📄 lpai-backend/pages/api/templates/[locationId]/copy/[globalTemplateId].ts

Purpose: Copies a global template to a specific location as a customizable copy
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId from mongodb
Used By: Unknown (no content provided)
External Services: MongoDB
Key Exports/Functions: POST handler that duplicates global templates for location-specific use
Database Collections: templates (read/write)
Critical Notes: Prevents duplicate copies, adds "(Copy)" suffix to template name, tracks source template ID

📄 lpai-backend/pages/api/templates/global.ts

Purpose: GET: Retrieves all global templates; POST: Creates new global template (admin only)
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise
Used By: Template management UI
External Services: MongoDB
Key Exports/Functions: Default handler with GET/POST methods, getGlobalTemplates, createGlobalTemplate functions
Database Collections: templates (read/write)
Critical Notes: Global templates have isGlobal: true flag, sorted by category then name

📄 lpai-backend/pages/api/templates/[locationId].ts

Purpose: GET: Returns location's custom templates plus available global templates; POST: Creates location-specific template
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId from mongodb
Used By: Location template management
External Services: MongoDB
Key Exports/Functions: Default handler with GET/POST, getLocationTemplates, createLocationTemplate functions
Database Collections: templates (read/write)
Critical Notes: Returns both locationTemplates and globalTemplates in response for template selection UI

📄 lpai-backend/pages/api/templates/[locationId]/[templateId].ts

Purpose: GET: Retrieves specific template; PATCH: Updates location template; DELETE: Deletes location template
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId from mongodb
Used By: Template editor UI
External Services: MongoDB
Key Exports/Functions: Default handler with GET/PATCH/DELETE, getTemplate, updateTemplate, deleteTemplate functions
Database Collections: templates (read/write/delete)
Critical Notes: Global templates cannot be edited or deleted directly, only location templates. Adds computed fields like isEditable and enabledSectionsCount

📄 lpai-backend/pages/api/users/[userId].ts

Purpose: GET: Fetches user details; PATCH: Updates user (mainly for preferences)
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId from mongodb
Used By: User profile/settings screens
External Services: MongoDB
Key Exports/Functions: Default handler with GET/PATCH methods, getUser, updateUser functions
Database Collections: users (read/write)
Critical Notes: Supports lookup by both ObjectId and userId field. Preference updates are the primary use case for PATCH

📄 lpai-backend/pages/api/quotes/[id]/pdf.ts

Purpose: POST: Generates and stores PDF for quote; GET: Retrieves stored PDF
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId, quotePDFGenerator service, pdfStorageService
Used By: Quote PDF generation/viewing
External Services: MongoDB, GridFS
Key Exports/Functions: Default handler with POST/GET, generateAndStorePDF, retrievePDF functions
Database Collections: quotes (read/write), locations (read), GridFS (signed_quotes bucket)
Critical Notes: KNOWN BUG - Only generates 1 page PDFs, content gets cut off. Body size limit increased to 10mb

📄 lpai-backend/tsconfig.json

Purpose: TypeScript configuration for Next.js backend
Status: Active
Dependencies: expo/tsconfig.base
Used By: TypeScript compiler
External Services: None
Key Exports/Functions: N/A - Configuration file
Database Collections: None
Critical Notes: Targets ES2017, uses esnext module resolution, paths configured for @/* and @types/*

📄 lpai-backend/README.md

Purpose: Standard Next.js project documentation
Status: Active
Dependencies: None
Used By: Developers
External Services: None
Key Exports/Functions: N/A - Documentation file
Database Collections: None
Critical Notes: Generic Next.js readme, not customized for LPai project

📄 lpai-backend/pages/api/projects/[id].ts

Purpose: GET: Enhanced project details with related data; PATCH: Updates project and syncs to GHL; DELETE: Soft deletes project
Status: Active (1217 lines)
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId, axios
Used By: Project detail screens
External Services: MongoDB, GHL API (opportunities endpoint)
Key Exports/Functions: Default handler, getEnhancedProject, updateProjectWithSmartSync, buildCustomFields, updateOpportunityCustomFields, softDeleteProject
Database Collections: projects (read/write), contacts (read), appointments (read), quotes (read), locations (read)
Critical Notes: CRITICAL - Updates GHL first, then MongoDB. Uses location-specific custom field IDs. Extensive logging for debugging GHL sync issues

📄 lpai-backend/eslint.config.mjs

Purpose: ESLint configuration using new flat config format
Status: Active
Dependencies: @eslint/eslintrc, path, url modules
Used By: ESLint linter
External Services: None
Key Exports/Functions: Default export of eslintConfig array
Database Collections: None
Critical Notes: Extends Next.js core-web-vitals and TypeScript configs

📄 lpai-backend/java.util.concurrent.ThreadPoolExecutor$Worker

Purpose: Unknown (no content provided)
Status: Unknown
Dependencies: Unknown (no content provided)
Used By: Unknown (no content provided)
External Services: Unknown (no content provided)
Key Exports/Functions: Unknown (no content provided)
Database Collections: Unknown (no content provided)
Critical Notes: Appears to be a Java class file incorrectly placed in the project

📄 lpai-backend/tsconfig.scripts.json

Purpose: TypeScript configuration specifically for scripts directory
Status: Active
Dependencies: None
Used By: ts-node for running scripts
External Services: None
Key Exports/Functions: N/A - Configuration file
Database Collections: None
Critical Notes: CommonJS module output, less strict than main config

📄 lpai-backend/tsconfig.expo.json

Purpose: TypeScript configuration for Expo/React Native compatibility
Status: Active
Dependencies: expo/tsconfig.base
Used By: Unknown (seems misplaced in backend)
External Services: None
Key Exports/Functions: N/A - Configuration file
Database Collections: None
Critical Notes: JSX set to react-native, likely not needed in backend

📄 lpai-backend/next-env.d.ts

Purpose: Next.js TypeScript environment definitions
Status: Active
Dependencies: next types
Used By: TypeScript compiler
External Services: None
Key Exports/Functions: N/A - Type definition file
Database Collections: None
Critical Notes: Auto-generated by Next.js, should not be edited

📄 lpai-backend/pages/api/payments/upload-proof.ts

Purpose: Uploads payment proof photos to GridFS
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId, GridFSBucket from mongodb
Used By: Payment proof upload feature
External Services: MongoDB, GridFS
Key Exports/Functions: POST handler that stores base64 images in GridFS
Database Collections: payments (write), GridFS (payment_proofs bucket)
Critical Notes: Converts base64 to buffer, returns promise for stream handling, updates payment record with proof reference

📄 lpai-backend/pages/api/quotes/[id]/publish.ts

Purpose: Changes quote status from draft to published, generates secure web link for customer access
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId, crypto
Used By: Quote publishing workflow
External Services: MongoDB
Key Exports/Functions: PATCH handler for publishing quotes
Database Collections: quotes (read/write), projects (write)
Critical Notes: Generates 32-byte hex token for web links, 30-day expiry, initializes payment summary if missing

📄 lpai-backend/pages/api/quotes/[id]/sign.ts

Purpose: Records digital signatures (consultant or customer) on quotes
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId
Used By: Quote signing interface
External Services: MongoDB
Key Exports/Functions: POST handler for adding signatures
Database Collections: quotes (read/write), projects (write)
Critical Notes: Handles null signatures object initialization, updates project to 'won' status when both signatures complete

📄 lpai-backend/pages/api/sms/send.ts

Purpose: Sends SMS messages via GHL API with template support and comprehensive logging
Status: Active (635 lines)
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId, axios, processTemplate, UNIVERSAL_TEMPLATES
Used By: SMS features throughout app
External Services: MongoDB, GHL API (conversations/messages)
Key Exports/Functions: POST handler for sending SMS
Database Collections: locations (read), contacts (read), users (read), appointments (read), projects (read/write), conversations (read/write), messages (write), sms_logs (write)
Critical Notes: Structured logging with requestId tracking, creates/updates conversation records, supports template processing with dynamic data

📄 lpai-backend/pages/api/sms/templates.ts

Purpose: GET: Retrieves SMS templates; PUT: Updates templates; POST: Resets to defaults
Status: Active (613 lines)
Dependencies: NextApiRequest, NextApiResponse, clientPromise
Used By: SMS template management UI
External Services: MongoDB
Key Exports/Functions: Default handler, processTemplate function, UNIVERSAL_TEMPLATES, AVAILABLE_VARIABLES exports
Database Collections: locations (read), sms_templates (read/write), user_sms_templates (read/write)
Critical Notes: Supports location-level and user-level template customization, includes 7 default templates with variable substitution

📄 lpai-backend/pages/api/webhooks/ghl/email-received.ts

Purpose: Processes inbound email webhooks from GHL
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId
Used By: GHL webhook system
External Services: MongoDB
Key Exports/Functions: POST handler for email webhooks
Database Collections: webhook_logs (write), contacts (read), conversations (read/write), messages (write)
Critical Notes: Only processes inbound emails, creates/updates email conversations, increments unread count

📄 lpai-backend/pages/api/payments/create-link.ts

Purpose: Creates GHL invoices for payment collection (deposit, progress, final)
Status: Active (778 lines)
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId, axios
Used By: Payment link generation
External Services: MongoDB, GHL API (invoices endpoint)
Key Exports/Functions: POST handler for creating payment links
Database Collections: locations (read), users (read), contacts (read), projects (read/write), payments (read/write), counters (read/write), quotes (write)
Critical Notes: Includes duplicate prevention logic, auto-increments invoice numbers using counters collection, sends invoice after creation

📄 lpai-backend/pages/api/payments/record-manual.ts

Purpose: Records manual payments (cash/cheque) against GHL invoices
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId, axios
Used By: Manual payment recording
External Services: MongoDB, GHL API (invoices/record-payment)
Key Exports/Functions: POST handler for recording manual payments
Database Collections: locations (read), users (read), payments (read/write), quotes (write), projects (write)
Critical Notes: Updates payment status to completed, updates quote payment summary and balance, changes project status based on deposit payment

📄 lpai-backend/pages/api/webhooks/ghl/sms-received.ts

Purpose: Processes inbound SMS webhooks from GHL
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId
Used By: GHL webhook system
External Services: MongoDB
Key Exports/Functions: POST handler for SMS webhooks
Database Collections: webhook_logs (write), contacts (read), locations (read), conversations (read/write), messages (write), appointments (write)
Critical Notes: Structured logging, creates/updates SMS conversations, links messages to active appointments

📄 lpai-backend/pages/api/login.ts

Purpose: Authenticates users and returns JWT token with user data
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, jwt, bcryptjs
Used By: Mobile app login screen
External Services: MongoDB
Key Exports/Functions: POST handler for authentication
Database Collections: users (read)
Critical Notes: Returns full user object including preferences, JWT expires in 7 days, requires JWT_SECRET env var

📄 lpai-backend/pages/api/quotes/[id]/create-revision.ts

Purpose: Creates a new revision of an existing quote while maintaining the same web link
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId, crypto
Used By: Quote revision workflow
External Services: MongoDB
Key Exports/Functions: POST handler for creating quote revisions
Database Collections: quotes (read/write), projects (write)
Critical Notes: Original quote status changes to 'superseded', revision inherits web link token, version number increments

📄 lpai-backend/pages/api/maps/calculate-eta.ts

Purpose: Calculates ETA and route information using free OpenStreetMap/OSRM services
Status: Active
Dependencies: NextApiRequest, NextApiResponse, axios
Used By: Navigation features
External Services: Nominatim (geocoding), OSRM (routing)
Key Exports/Functions: POST handler for ETA calculation
Database Collections: None
Critical Notes: No API key required, simulates traffic conditions based on time of day, returns duration in minutes

📄 lpai-backend/pages/api/payments/[id].ts

Purpose: GET: Fetches payment details; PATCH: Updates payment status
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId
Used By: Payment management features
External Services: MongoDB
Key Exports/Functions: Default handler with GET/PATCH, getPayment, updatePayment functions
Database Collections: payments (read/write), projects (write), quotes (write), invoices (write)
Critical Notes: Updates related records when payment completes, handles deposit vs final payment logic

📄 lpai-backend/pages/api/quotes/[id].ts

Purpose: GET: Fetches quote with enriched data; PATCH: Updates quote; DELETE: Soft deletes quote
Status: Active (676 lines)
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId
Used By: Quote management screens
External Services: MongoDB
Key Exports/Functions: Default handler with GET/PATCH/DELETE, getQuote, updateQuote, deleteQuote functions
Database Collections: quotes (read/write), contacts (read), projects (read/write)
Critical Notes: Supports status updates, content updates, activity tracking, updates project timeline on quote changes

📄 lpai-backend/pages/api/quotes/index.ts

Purpose: GET: Fetches quotes with filters; POST: Creates new quote
Status: Active (612 lines)
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId
Used By: Quote listing and creation screens
External Services: MongoDB
Key Exports/Functions: Default handler with GET/POST, getQuotes, createQuote functions
Database Collections: quotes (read/write), contacts (read), projects (read/write)
Critical Notes: Auto-generates quote numbers (Q-YYYY-###), calculates totals and deposit amounts, updates project with quote reference

📄 lpai-backend/pages/api/webhooks/ghl/unified.ts

Purpose: Single endpoint to receive all GHL webhooks and route them to appropriate queues
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId
Used By: GHL webhook configuration
External Services: MongoDB
Key Exports/Functions: Default handler, determineEventType function
Database Collections: webhook_queue (write), webhook_discovery (write)
Critical Notes: Determines event type from payload structure, queues for async processing, discovers unrecognized webhook types

📄 lpai-backend/pages/api/webhooks/trigger-cron.ts

Purpose: Manual trigger endpoint for cron job testing
Status: Active
Dependencies: NextApiRequest, NextApiResponse, process-webhooks handler
Used By: Development/testing
External Services: None
Key Exports/Functions: Default handler that adds auth header and calls cron handler
Database Collections: None (delegates to cron handler)
Critical Notes: Adds CRON_SECRET authorization header for manual triggering

📄 lpai-backend/pages/api/status.ts

Purpose: Health check endpoint returning database connection status and counts
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise
Used By: Monitoring/health checks
External Services: MongoDB
Key Exports/Functions: Default handler returning system status
Database Collections: locations (count), webhook_queue (count), agencies (count)
Critical Notes: Returns 500 if database disconnected, includes basic collection counts

📄 lpai-backend/pages/api/sync/custom-fields.ts

Purpose: Syncs custom field definitions from GHL to MongoDB
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, syncCustomFields utility
Used By: Location setup/sync processes
External Services: MongoDB, GHL API (via syncCustomFields)
Key Exports/Functions: POST handler for custom field sync
Database Collections: locations (read), custom fields synced via utility
Critical Notes: Requires locationId in body, delegates to syncCustomFields utility function

📄 lpai-backend/pages/api/sync/custom-values.ts

Purpose: Syncs custom field values/options from GHL to MongoDB
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, syncCustomValues utility
Used By: Location setup/sync processes
External Services: MongoDB, GHL API (via syncCustomValues)
Key Exports/Functions: POST handler for custom value sync
Database Collections: locations (read), custom values synced via utility
Critical Notes: Requires locationId in body, complements custom-fields sync

📄 lpai-backend/pages/api/sync/calendars.ts

Purpose: Syncs calendar data from GHL to MongoDB
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, syncCalendars utility
Used By: Location setup/sync processes
External Services: MongoDB, GHL API (via syncCalendars)
Key Exports/Functions: POST handler for calendar sync
Database Collections: locations (read), calendars synced via utility
Critical Notes: Part of location setup workflow

📄 lpai-backend/pages/api/sync/pipelines.ts

Purpose: Syncs pipeline/stage data from GHL to MongoDB
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, syncPipelines utility
Used By: Location setup/sync processes
External Services: MongoDB, GHL API (via syncPipelines)
Key Exports/Functions: POST handler for pipeline sync
Database Collections: locations (read), pipelines synced via utility
Critical Notes: Critical for project/opportunity management

📄 lpai-backend/pages/api/sync/location-details.ts

Purpose: Syncs location settings and details from GHL to MongoDB
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, syncLocationDetails utility
Used By: Location setup/sync processes
External Services: MongoDB, GHL API (via syncLocationDetails)
Key Exports/Functions: POST handler for location detail sync
Database Collections: locations (read/write via utility)
Critical Notes: Updates location branding, settings, timezone etc.

📄 lpai-backend/pages/api/sync/opportunities.ts

Purpose: Syncs opportunities (projects) from GHL to MongoDB
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, syncOpportunities utility
Used By: Data sync processes
External Services: MongoDB, GHL API (via syncOpportunities)
Key Exports/Functions: POST handler with pagination support
Database Collections: locations (read), opportunities synced via utility
Critical Notes: Supports limit, offset, fullSync parameters

📄 lpai-backend/pages/api/sync/contacts.ts

Purpose: Syncs contacts from GHL to MongoDB
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, syncContacts utility
Used By: Data sync processes
External Services: MongoDB, GHL API (via syncContacts)
Key Exports/Functions: POST handler with pagination support
Database Collections: locations (read), contacts synced via utility
Critical Notes: Supports limit, offset, fullSync parameters

📄 lpai-backend/pages/api/sync/users.ts

Purpose: Syncs user accounts from GHL to MongoDB
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, syncUsers utility
Used By: Location setup/sync processes
External Services: MongoDB, GHL API (via syncUsers)
Key Exports/Functions: POST handler for user sync
Database Collections: locations (read), users synced via utility
Critical Notes: Part of initial location setup

📄 lpai-backend/pages/api/sync/appointments.ts

Purpose: Syncs appointments from GHL to MongoDB
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, syncAppointments utility
Used By: Calendar sync processes
External Services: MongoDB, GHL API (via syncAppointments)
Key Exports/Functions: POST handler with date range support
Database Collections: locations (read), appointments synced via utility
Critical Notes: Supports startDate, endDate, fullSync parameters

📄 lpai-backend/pages/api/sync/conversations.ts

Purpose: Syncs conversations/messages from GHL to MongoDB
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, syncConversations utility
Used By: Message sync processes
External Services: MongoDB, GHL API (via syncConversations)
Key Exports/Functions: POST handler with pagination support
Database Collections: locations (read), conversations synced via utility
Critical Notes: Supports limit, offset, fullSync parameters

📄 lpai-backend/pages/api/messages/email/[emailMesageId].ts

Purpose: Fetches full email content from GHL by message ID
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, axios, getAuthHeader utility
Used By: Email viewing features
External Services: MongoDB, GHL API (conversations/messages/email)
Key Exports/Functions: GET handler for email content retrieval
Database Collections: locations (read), messages (write)
Critical Notes: Updates local message record with fetched content, note typo in filename (emailMesageId)

📄 lpai-backend/pages/api/oauth/get-location-tokens.ts

Purpose: Obtains location-specific OAuth tokens from company-level tokens
Status: Active (860 lines)
Dependencies: NextApiRequest, NextApiResponse, clientPromise, axios, getAuthHeader utility
Used By: OAuth setup workflow
External Services: MongoDB, GHL API (oauth/locationToken, companies, locations/search)
Key Exports/Functions: POST handler with rate limiting
Database Collections: locations (read/write), agencies (write)
Critical Notes: Rate limited to 10 requests/minute per company, processes in batches of 5, handles both single location and bulk agency operations

📄 lpai-backend/pages/api/webhooks/status.ts

Purpose: Provides webhook processing queue status and metrics
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise
Used By: Monitoring/debugging
External Services: MongoDB
Key Exports/Functions: Default handler returning queue statistics
Database Collections: webhook_queue (aggregate), webhook_metrics (aggregate), processor_logs (read)
Critical Notes: Shows pending queues, processing metrics from last hour, recent processor runs

📄 lpai-backend/pages/api/webhooks/ghl/native.ts

Purpose: Native GHL webhook endpoint with signature verification and intelligent routing
Status: Active (561 lines)
Dependencies: NextApiRequest, NextApiResponse, clientPromise, crypto, ObjectId, webhook router/queue utilities
Used By: GHL webhook configuration
External Services: MongoDB
Key Exports/Functions: Default handler with signature verification, webhook routing
Database Collections: webhook_queue (write), webhook_discovery (write)
Critical Notes: Verifies GHL signature with public key, prevents replay attacks (5 min window), routes to appropriate queue based on webhook type

📄 lpai-backend/pages/api/oauth/callback.ts

Purpose: OAuth callback handler that exchanges code for tokens and triggers location setup
Status: Active (699 lines)
Dependencies: NextApiRequest, NextApiResponse, clientPromise, axios, installQueue utilities
Used By: GHL OAuth flow
External Services: MongoDB, GHL API (oauth/token)
Key Exports/Functions: Default handler for OAuth callback
Database Collections: locations (read/write)
Critical Notes: Uses install lock to prevent duplicate processing, handles both company and location installs, triggers background setup, redirects to progress page

📄 lpai-backend/pages/api/sync/progress/[id].ts

Purpose: Shows real-time installation/sync progress with UI or API response
Status: Active (1126 lines)
Dependencies: NextApiRequest, NextApiResponse, clientPromise
Used By: OAuth callback redirect, setup monitoring
External Services: MongoDB
Key Exports/Functions: Default handler with UI generation, generateProgressUI, generateLocationCard, generateDetailedProgress functions
Database Collections: locations (read)
Critical Notes: OBSERVATION ONLY - doesn't trigger syncs, just shows progress. Renders interactive HTML UI with particles.js animation when ui=true

📄 lpai-backend/pages/api/webhooks/workflow/email-activity.ts

Purpose: Processes email activity events (opened, clicked, bounced, etc.) from workflow webhooks
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId
Used By: Email tracking workflows
External Services: MongoDB
Key Exports/Functions: POST handler for email activity events
Database Collections: email_activity (write), contacts (read/write), quotes (write)
Critical Notes: Updates contact email engagement metrics, tracks last activity dates, updates quote activity if linked

📄 lpai-backend/pages/api/webhooks/workflow/form-submission.ts

Purpose: Processes form submission webhooks, creates/updates contacts and projects
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId
Used By: Form submission workflows
External Services: MongoDB
Key Exports/Functions: POST handler for form submissions
Database Collections: form_submissions (write), contacts (read/write), projects (write), survey_responses (write)
Critical Notes: Creates new contacts from form data if needed, handles quote requests and survey responses

📄 lpai-backend/test-webhook.json

Purpose: Sample webhook payload for testing
Status: Active
Dependencies: None
Used By: Webhook testing
External Services: None
Key Exports/Functions: N/A - Test data file
Database Collections: None
Critical Notes: Contains sample contact created webhook structure

📄 lpai-backend/package.json

Purpose: Node.js package configuration for Next.js backend
Status: Active
Dependencies: Multiple - Next.js 15.3.2, React 19, MongoDB 6.16, axios, bcryptjs, jsonwebtoken, etc.
Used By: npm/yarn package manager
External Services: None
Key Exports/Functions: N/A - Configuration file
Database Collections: None
Critical Notes: Type is CommonJS, includes seed scripts and setup-indexes script

📄 lpai-backend/next.config.ts

Purpose: Next.js configuration with build error suppression
Status: Active
Dependencies: NextConfig type from 'next'
Used By: Next.js build system
External Services: None
Key Exports/Functions: Default export of nextConfig
Database Collections: None
Critical Notes: ESLint and TypeScript errors ignored during builds (Vercel-friendly)

📄 lpai-backend/.env.local

Purpose: Environment variables for backend services
Status: Active
Dependencies: None
Used By: All backend services
External Services: MongoDB Atlas, Resend Email, GHL OAuth
Key Exports/Functions: N/A - Environment file
Database Collections: None
Critical Notes: Contains sensitive credentials - MongoDB URI, JWT secret, API keys

📄 lpai-backend/response.json

Purpose: Sample error response (likely debug artifact)
Status: Unknown
Dependencies: None
Used By: Unknown
External Services: None
Key Exports/Functions: N/A - JSON file
Database Collections: None
Critical Notes: Contains authentication error message, possibly from testing

📄 lpai-backend/.gitignore

Purpose: Git ignore configuration
Status: Active
Dependencies: None
Used By: Git version control
External Services: None
Key Exports/Functions: N/A - Configuration file
Database Collections: None
Critical Notes: Standard Next.js gitignore with .env* files ignored

📄 lpai-backend/pages/api/payments/products/ghl.ts

Purpose: Fetches products from GHL for a location
Status: Active
Dependencies: NextApiRequest, NextApiResponse, axios, httpResponses utilities, GHL_ENDPOINTS constants, getAuthHeader, getLocation utilities, cors
Used By: Product listing features
External Services: GHL API (products endpoint)
Key Exports/Functions: GET handler for retrieving GHL products
Database Collections: None (direct GHL API proxy)
Critical Notes: Uses custom HTTP response utilities, applies CORS, requires locationId parameter

📄 lpai-backend/pages/api/webhooks/workflow/contact-milestones.ts

Purpose: Processes contact milestone events (birthdays, reminders, engagement scores, tasks)
Status: Active
Dependencies: NextApiRequest, NextApiResponse, clientPromise, ObjectId
Used By: Contact milestone workflows
External Services: MongoDB
Key Exports/Functions: POST handler for milestone events
Database Collections: contact_milestones (write), contacts (read/write), notes (write), projects (write), tasks (write), engagement_alerts (write)
Critical Notes: Handles birthday reminders, custom date reminders, engagement score changes, task reminders, stale opportunities

📄 lpai-backend/vercel.json

Purpose: Vercel deployment configuration with cron jobs and function settings
Status: Active
Dependencies: None
Used By: Vercel deployment
External Services: Vercel platform
Key Exports/Functions: N/A - Configuration file
Database Collections: None
Critical Notes: Defines 11 cron jobs (token refresh every 6 hours, various processors every minute, reports daily/weekly), sets function timeouts, configures CORS for webhook endpoint

*******************************************

********************************************
