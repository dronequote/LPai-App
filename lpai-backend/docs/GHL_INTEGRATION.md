GoHighLevel (GHL) Integration Guide
Overview
LPai integrates with GoHighLevel (LeadConnector) as a Marketplace App using OAuth 2.0 authentication. MongoDB serves as the primary data source with bidirectional sync to GHL. This guide covers the OAuth flow, sync patterns, webhook processing, and best practices.
Architecture Overview
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│   LPai App      │     │   MongoDB   │     │     GHL     │
│  (Frontend)     │────▶│  (Primary)  │◀───▶│   (CRM)     │
└─────────────────┘     └─────────────┘     └─────────────┘
                              ▲                      │
                              │                      │
                        ┌─────┴──────┐               │
                        │  Webhooks  │◀──────────────┘
                        │   Queue    │
                        └────────────┘
Key Architectural Principles

MongoDB as Source of Truth: All app operations read/write to MongoDB first
OAuth-First Authentication: Uses GHL OAuth 2.0 for secure API access
Webhook-Driven Updates: Real-time sync via native webhooks
Queue-Based Processing: Webhooks processed asynchronously to prevent timeouts
Multi-Tenant Isolation: All operations filtered by locationId
Graceful Degradation: GHL failures don't block app functionality

OAuth 2.0 Implementation
Installation Flow
mermaidsequenceDiagram
    User->>GHL Marketplace: Install App
    GHL Marketplace->>OAuth Callback: Redirect with code
    OAuth Callback->>GHL API: Exchange code for tokens
    GHL API->>OAuth Callback: Return tokens
    OAuth Callback->>MongoDB: Store tokens
    OAuth Callback->>Setup API: Trigger location setup
    Setup API->>GHL API: Sync all data
    Setup API->>MongoDB: Store synced data
OAuth Configuration
javascript// Environment Variables
GHL_MARKETPLACE_CLIENT_ID=683aa5ce1a9647760b904986-mbc8v930
GHL_MARKETPLACE_CLIENT_SECRET=a6ec6cdc-047d-41d0-bcc5-96de0acd37d3

// OAuth URLs
const OAUTH_BASE_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation';
const TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';
const CALLBACK_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/oauth/callback`;
Token Storage Structure
javascript// Company-level OAuth (Agency installs)
{
  companyId: "xvoQk4MIRt1U9L3bWLcC",
  locationId: null,  // null indicates company-level
  isCompanyLevel: true,
  ghlOAuth: {
    accessToken: "eyJhbGciOiJIUzI1NiIs...",
    refreshToken: "eyJhbGciOiJIUzI1NiIs...",
    expiresAt: new Date("2025-01-15T10:00:00Z"),
    tokenType: "Bearer",
    userType: "Company",
    installedAt: new Date(),
    installedBy: "user_id",
    approvedLocations: ["loc1", "loc2"]
  }
}

// Location-level OAuth (Sub-account installs)
{
  locationId: "JMtlZzwrNOUmLpJk2eCE",
  companyId: "xvoQk4MIRt1U9L3bWLcC",
  ghlOAuth: {
    accessToken: "eyJhbGciOiJIUzI1NiIs...",
    refreshToken: "eyJhbGciOiJIUzI1NiIs...",
    expiresAt: new Date("2025-01-15T10:00:00Z"),
    tokenType: "Bearer",
    userType: "Location",
    derivedFromCompany: true,  // If token came from company OAuth
    installedAt: new Date()
  }
}
Token Management
javascript// Get auth header with automatic token refresh
import { getAuthHeader } from '../utils/ghlAuth';

async function makeGHLRequest(location) {
  // Automatically handles token refresh if needed
  const auth = await getAuthHeader(location);
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': auth.header,  // "Bearer {token}" or API key
      'Version': '2021-07-28',
      'Accept': 'application/json'
    }
  });
  
  return response.data;
}

// Token refresh implementation
async function refreshOAuthToken(location) {
  if (!location.ghlOAuth?.refreshToken) {
    throw new Error('No refresh token available');
  }
  
  const response = await axios.post(
    'https://services.leadconnectorhq.com/oauth/token',
    new URLSearchParams({
      client_id: process.env.GHL_MARKETPLACE_CLIENT_ID,
      client_secret: process.env.GHL_MARKETPLACE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: location.ghlOAuth.refreshToken
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    }
  );
  
  // Update tokens in database
  const newExpiresAt = new Date(Date.now() + (response.data.expires_in * 1000));
  
  await db.collection('locations').updateOne(
    { _id: location._id },
    {
      $set: {
        'ghlOAuth.accessToken': response.data.access_token,
        'ghlOAuth.refreshToken': response.data.refresh_token,
        'ghlOAuth.expiresAt': newExpiresAt,
        'ghlOAuth.lastRefreshed': new Date()
      }
    }
  );
}
Cron Job for Token Refresh
javascript// Runs every hour to refresh expiring tokens
// /api/cron/refresh-tokens
export default async function refreshTokensCron(req, res) {
  // Verify cron secret
  if (req.headers['x-vercel-cron'] !== '1' && 
      req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const locations = await db.collection('locations').find({
    'ghlOAuth.accessToken': { $exists: true },
    appInstalled: true
  }).toArray();
  
  for (const location of locations) {
    if (tokenNeedsRefresh(location)) {
      await refreshOAuthToken(location);
    }
  }
}
Location Setup Process
When a location installs the app, a comprehensive setup process runs automatically:
javascript// /api/locations/setup-location
async function setupLocation(locationId) {
  const steps = [
    { name: 'locationDetails', fn: syncLocationDetails },
    { name: 'pipelines', fn: syncPipelines },
    { name: 'calendars', fn: syncCalendars },
    { name: 'users', fn: syncUsers },
    { name: 'customFields', fn: syncCustomFields },
    { name: 'customValues', fn: syncCustomValues },
    { name: 'contacts', fn: syncContacts },      // Initial batch only
    { name: 'opportunities', fn: syncOpportunities },
    { name: 'appointments', fn: syncAppointments },
    { name: 'conversations', fn: syncConversations },
    { name: 'defaults', fn: setupDefaults }     // Terms, templates, libraries
  ];
  
  const results = {};
  
  for (const step of steps) {
    try {
      results[step.name] = await step.fn(db, location);
    } catch (error) {
      results[step.name] = { success: false, error: error.message };
    }
  }
  
  return results;
}
API Configuration
API Versions by Endpoint
javascriptconst GHL_API_VERSIONS = {
  // V2 endpoints (newer)
  contacts: '2021-07-28',
  opportunities: '2021-07-28',
  pipelines: '2021-07-28',
  customFields: '2021-07-28',
  invoices: '2021-07-28',
  users: '2021-07-28',
  
  // V1 endpoints (older)
  calendars: '2021-04-15',
  appointments: '2021-04-15',
  conversations: '2021-04-15',
  messages: '2021-04-15'
};
Base URLs
javascriptconst GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_REST_URL = 'https://rest.gohighlevel.com/v1';  // Legacy endpoints
Entity Sync Patterns
Contacts Sync
javascript// MongoDB Contact Schema
{
  _id: ObjectId,
  ghlContactId: String,      // GHL reference
  locationId: String,        // Required for all operations
  
  // Basic Info
  firstName: String,
  lastName: String,
  fullName: String,          // Computed: firstName + lastName
  email: String,
  phone: String,             // E.164 format: +1234567890
  
  // Additional Info
  address: String,
  city: String,
  state: String,
  country: String,
  postalCode: String,
  dateOfBirth: Date,
  
  // Business Info
  companyName: String,
  website: String,
  
  // GHL Specific
  tags: [String],
  source: String,
  type: String,              // 'lead' or 'contact'
  dnd: Boolean,
  dndSettings: Object,
  customFields: Array,
  
  // Tracking
  createdAt: Date,
  updatedAt: Date,
  lastSyncedAt: Date,
  createdBySync: Boolean
}

// Sync Implementation
async function syncContacts(db, location, options = {}) {
  const { limit = 100, fullSync = false } = options;
  
  const response = await axios.get(
    'https://services.leadconnectorhq.com/contacts/',
    {
      headers: {
        'Authorization': auth.header,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      },
      params: {
        locationId: location.locationId,
        limit,
        startAfter: options.startAfter,
        startAfterId: options.startAfterId
      }
    }
  );
  
  // Bulk upsert pattern
  const bulkOps = response.data.contacts.map(ghlContact => ({
    updateOne: {
      filter: { 
        $or: [
          { ghlContactId: ghlContact.id },
          { email: ghlContact.email, locationId: location.locationId }
        ]
      },
      update: {
        $set: {
          ghlContactId: ghlContact.id,
          locationId: location.locationId,
          firstName: ghlContact.firstName || '',
          lastName: ghlContact.lastName || '',
          fullName: ghlContact.contactName || `${ghlContact.firstName} ${ghlContact.lastName}`.trim(),
          email: ghlContact.email || '',
          phone: ghlContact.phone || '',
          // ... map all fields
          lastSyncedAt: new Date()
        },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: new Date(),
          createdBySync: true
        }
      },
      upsert: true
    }
  }));
  
  await db.collection('contacts').bulkWrite(bulkOps);
}
Projects (Opportunities) Sync
javascript// MongoDB Project Schema
{
  _id: ObjectId,
  ghlOpportunityId: String,  // GHL reference
  locationId: String,
  contactId: String,         // MongoDB contact ID
  
  // Core Fields (sync with GHL)
  title: String,             // → GHL "name"
  status: String,            // MUST be: open, won, lost, abandoned
  monetaryValue: Number,
  pipelineId: String,
  pipelineStageId: String,
  
  // Custom Fields (sync via GHL custom fields)
  quoteNumber: String,       // → custom field
  signedDate: String,        // → custom field
  
  // App-specific (MongoDB only)
  milestones: Array,
  timeline: Array,
  photos: Array,
  documents: Array,
  customFields: Object,
  
  // Tracking
  createdAt: Date,
  updatedAt: Date,
  lastSyncedAt: Date
}

// Update with Custom Fields
async function updateProjectWithGHL(db, projectId, updates, location) {
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId)
  });
  
  if (!project.ghlOpportunityId) return;
  
  // Get custom field mappings
  const customFieldIds = location.ghlCustomFields || {};
  
  // Build custom fields array
  const customFields = [];
  
  if (updates.title && customFieldIds.project_title) {
    customFields.push({
      id: customFieldIds.project_title,
      key: "project_title",
      field_value: updates.title
    });
  }
  
  if (updates.signedDate && customFieldIds.signed_date) {
    customFields.push({
      id: customFieldIds.signed_date,
      key: "signed_date",
      field_value: updates.signedDate
    });
  }
  
  // Update GHL
  await axios.put(
    `https://services.leadconnectorhq.com/opportunities/${project.ghlOpportunityId}`,
    {
      name: updates.title || project.title,
      status: updates.status || project.status,
      monetaryValue: updates.monetaryValue || 0,
      customFields: customFields
    },
    {
      headers: {
        'Authorization': auth.header,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    }
  );
}
Custom Fields Management
javascript// Required custom fields for opportunities
const REQUIRED_CUSTOM_FIELDS = [
  {
    key: 'project_title',
    name: 'Project Title',
    dataType: 'TEXT',
    position: 0
  },
  {
    key: 'quote_number',
    name: 'Quote Number',
    dataType: 'TEXT',
    position: 1
  },
  {
    key: 'signed_date',
    name: 'Signed Date',
    dataType: 'DATE',
    position: 2
  }
];

// Sync and create custom fields
async function syncCustomFields(db, location) {
  // Fetch existing custom fields
  const response = await axios.get(
    'https://services.leadconnectorhq.com/locations/customFields',
    {
      headers: {
        'Authorization': auth.header,
        'Version': '2021-07-28'
      },
      params: { locationId: location.locationId }
    }
  );
  
  const existingFields = response.data.customFields || [];
  const fieldMapping = {};
  
  // Check and create missing fields
  for (const required of REQUIRED_CUSTOM_FIELDS) {
    const existing = existingFields.find(f => f.key === required.key);
    
    if (existing) {
      fieldMapping[required.key] = existing.id;
    } else {
      // Create missing field
      const createResponse = await axios.post(
        'https://services.leadconnectorhq.com/locations/customFields',
        {
          locationId: location.locationId,
          name: required.name,
          key: required.key,
          dataType: required.dataType,
          position: required.position,
          model: 'opportunity'
        },
        {
          headers: {
            'Authorization': auth.header,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          }
        }
      );
      
      fieldMapping[required.key] = createResponse.data.customField.id;
    }
  }
  
  // Store mapping in location
  await db.collection('locations').updateOne(
    { _id: location._id },
    { $set: { ghlCustomFields: fieldMapping } }
  );
}
Webhook Processing
Native Webhook Implementation
javascript// Webhook endpoint with signature verification
// /api/webhooks/ghl/native
import crypto from 'crypto';

const GHL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
...
-----END PUBLIC KEY-----`;

function verifyWebhookSignature(payload, signature) {
  const verifier = crypto.createVerify('SHA256');
  verifier.update(payload);
  verifier.end();
  return verifier.verify(GHL_PUBLIC_KEY, signature, 'base64');
}

export default async function webhookHandler(req, res) {
  // Verify signature
  const signature = req.headers['x-wh-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Queue for processing
  await db.collection('webhook_queue').insertOne({
    _id: new ObjectId(),
    webhookId: req.body.webhookId || new ObjectId().toString(),
    type: req.body.type,  // ContactCreate, AppointmentUpdate, etc.
    payload: req.body,
    locationId: req.body.locationId,
    status: 'pending',
    attempts: 0,
    createdAt: new Date()
  });
  
  // Return immediately (process async)
  return res.status(200).json({ success: true });
}
Webhook Event Types
javascript// Currently implemented webhook processors
const WEBHOOK_PROCESSORS = {
  // App lifecycle
  'INSTALL': processInstallEvent,           // Triggers full setup
  'UNINSTALL': processUninstallEvent,       // Cleans up OAuth tokens
  'LocationUpdate': processLocationUpdate,   // Updates location info
  
  // Contact events
  'ContactCreate': processContactCreate,
  'ContactUpdate': processContactUpdate,
  'ContactDelete': processContactDelete,
  
  // Message events
  'InboundMessage': processInboundMessage,   // SMS/Email received
  'OutboundMessage': processOutboundMessage, // SMS/Email sent
  
  // Conversation events
  'ConversationUnreadUpdate': processConversationUnreadUpdate
};

// Install webhook triggers automatic setup
async function processInstallEvent(db, payload, webhookId) {
  const { locationId, companyId, installType } = payload;
  
  if (installType === 'Location' && locationId) {
    // Store installation record
    await db.collection('locations').updateOne(
      { locationId },
      {
        $set: {
          locationId,
          companyId,
          appInstalled: true,
          installedAt: new Date(),
          installedBy: payload.userId,
          installType: 'Location'
        }
      },
      { upsert: true }
    );
    
    // Trigger automatic setup
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/locations/setup-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, fullSync: true })
    });
  }
}
Webhook Queue Processing
javascript// Cron job processes webhook queue
// /api/cron/process-webhooks
export default async function processWebhooks(req, res) {
  const webhooks = await db.collection('webhook_queue')
    .find({
      status: 'pending',
      processAfter: { $lte: new Date() },
      attempts: { $lt: 3 }
    })
    .sort({ createdAt: 1 })
    .limit(50)
    .toArray();
  
  const results = await Promise.allSettled(
    webhooks.map(webhook => processWebhook(db, webhook))
  );
  
  // Clean up old completed webhooks
  await db.collection('webhook_queue').deleteMany({
    status: { $in: ['completed', 'skipped'] },
    completedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });
}
Sync Strategies
1. Initial Setup Sync (Pull Everything)
Used during app installation to populate MongoDB with existing GHL data.
javascriptasync function initialSetupSync(locationId) {
  // Run in specific order due to dependencies
  await syncLocationDetails(db, location);    // Basic info
  await syncPipelines(db, location);          // Required for projects
  await syncCalendars(db, location);          // Required for appointments
  await syncUsers(db, location);              // Required for assignments
  await syncCustomFields(db, location);       // Create/map custom fields
  await syncContacts(db, location);           // Initial batch
  await syncOpportunities(db, location);      // Projects
  await syncAppointments(db, location);       // Calendar events
  await syncConversations(db, location);      // Messages
  await setupDefaults(db, location);          // Terms, templates
}
2. Write-Through Pattern (Create/Update)
MongoDB first, then sync to GHL.
javascript// Example: Create appointment
async function createAppointment(appointmentData) {
  // 1. Save to MongoDB
  const result = await db.collection('appointments').insertOne({
    ...appointmentData,
    createdAt: new Date()
  });
  
  // 2. Map MongoDB IDs to GHL IDs
  const [contact, user] = await Promise.all([
    db.collection('contacts').findOne({ _id: new ObjectId(appointmentData.contactId) }),
    db.collection('users').findOne({ _id: new ObjectId(appointmentData.userId) })
  ]);
  
  // 3. Create in GHL
  if (contact?.ghlContactId && user?.ghlUserId) {
    try {
      const ghlResponse = await axios.post(
        'https://services.leadconnectorhq.com/calendars/events/appointments',
        {
          contactId: contact.ghlContactId,      // GHL ID required
          assignedUserId: user.ghlUserId,       // GHL ID required
          calendarId: appointmentData.calendarId,
          locationId: appointmentData.locationId,
          startTime: appointmentData.start,
          endTime: appointmentData.end,
          title: appointmentData.title,
          appointmentStatus: 'confirmed'
        },
        {
          headers: {
            'Authorization': auth.header,
            'Version': '2021-04-15'
          }
        }
      );
      
      // 4. Update MongoDB with GHL ID
      await db.collection('appointments').updateOne(
        { _id: result.insertedId },
        { $set: { ghlAppointmentId: ghlResponse.data.event.id } }
      );
    } catch (error) {
      console.error('GHL sync failed:', error.response?.data);
      // Continue - MongoDB record exists
    }
  }
  
  return { success: true, appointmentId: result.insertedId };
}
3. Webhook-Driven Updates
Real-time updates from GHL via webhooks.
javascript// Contact update webhook
async function processContactUpdate(db, payload, webhookId) {
  const { locationId, id: ghlContactId } = payload;
  
  const updateData = {
    lastWebhookUpdate: new Date(),
    updatedAt: new Date()
  };
  
  // Map GHL fields to MongoDB
  const fieldsToUpdate = [
    'email', 'firstName', 'lastName', 'phone', 'tags',
    'address1', 'city', 'state', 'country', 'postalCode'
  ];
  
  fieldsToUpdate.forEach(field => {
    if (payload[field] !== undefined) {
      updateData[field === 'address1' ? 'address' : field] = payload[field];
    }
  });
  
  await db.collection('contacts').updateOne(
    { ghlContactId, locationId },
    { $set: updateData }
  );
}
4. Periodic Sync Pattern
For data that changes frequently or needs validation.
javascript// Sync calendars on demand
async function syncCalendars(db, location) {
  const response = await axios.get(
    'https://services.leadconnectorhq.com/calendars/',
    {
      headers: {
        'Authorization': auth.header,
        'Version': '2021-04-15'
      },
      params: { locationId: location.locationId }
    }
  );
  
  const calendars = response.data.calendars.map(cal => ({
    id: cal.id,
    name: cal.name,
    description: cal.description || '',
    slotDuration: cal.slotDuration || 30,
    slotDurationUnit: cal.slotDurationUnit || 'mins',
    // ... map all fields
    icon: getCalendarIcon(cal.name),  // Assign icon based on name
    lastSynced: new Date()
  }));
  
  // Only update if changed
  const hasChanged = JSON.stringify(location.calendars) !== JSON.stringify(calendars);
  
  if (hasChanged) {
    await db.collection('locations').updateOne(
      { _id: location._id },
      { 
        $set: { 
          calendars,
          calendarsUpdatedAt: new Date()
        }
      }
    );
  }
}
Error Handling
Common GHL API Errors
javascript// 422 - Validation Error
{
  "errors": {
    "status": ["Invalid status value. Must be one of: open, won, lost, abandoned"],
    "customFields": ["Invalid custom field ID: xxx"]
  }
}

// 401 - Authentication Error
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}

// 429 - Rate Limit
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please retry after 60 seconds"
}

// 404 - Not Found
{
  "error": "Not Found",
  "message": "Contact with ID xxx not found"
}
Error Handling Strategy
javascriptasync function handleGHLError(error, context) {
  const status = error.response?.status;
  const data = error.response?.data;
  
  // Log detailed error info
  console.error('[GHL Error]', {
    status,
    url: error.config?.url,
    method: error.config?.method,
    payload: error.config?.data,
    response: data,
    context
  });
  
  switch (status) {
    case 401:
      // Token expired or invalid
      if (context.location?.ghlOAuth?.refreshToken) {
        // Attempt refresh
        await refreshOAuthToken(context.location);
        // Retry original request
        return true;
      }
      // Mark location as needing reauth
      await db.collection('locations').updateOne(
        { _id: context.location._id },
        { 
          $set: { 
            'ghlOAuth.needsReauth': true,
            'ghlOAuth.reauthReason': 'Token invalid'
          }
        }
      );
      break;
      
    case 422:
      // Validation error - log details
      if (data.errors) {
        Object.entries(data.errors).forEach(([field, errors]) => {
          console.error(`[Validation] ${field}: ${errors.join(', ')}`);
        });
      }
      break;
      
    case 429:
      // Rate limited - implement backoff
      const retryAfter = parseInt(error.response.headers['retry-after']) || 60;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return true; // Retry
      
    default:
      // Generic error
      console.error('[GHL Error] Unhandled error type:', status);
  }
  
  return false; // Don't retry
}
Best Practices
1. Always Map IDs Before GHL Calls
javascript// Never send MongoDB ObjectIds to GHL
async function prepareGHLPayload(mongoData, locationId) {
  const mappedData = { ...mongoData };
  
  // Map contact ID
  if (mongoData.contactId) {
    const contact = await db.collection('contacts').findOne({
      _id: new ObjectId(mongoData.contactId)
    });
    mappedData.contactId = contact?.ghlContactId;
  }
  
  // Map user ID
  if (mongoData.userId) {
    const user = await db.collection('users').findOne({
      _id: new ObjectId(mongoData.userId)
    });
    mappedData.assignedUserId = user?.ghlUserId;
  }
  
  // Add locationId for creation endpoints
  mappedData.locationId = locationId;
  
  return mappedData;
}
2. Validate Status Values
javascriptconst VALID_OPPORTUNITY_STATUSES = ['open', 'won', 'lost', 'abandoned'];
const VALID_APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'cancelled', 'showed', 'noshow'];

function validateStatus(status, type) {
  const validStatuses = type === 'opportunity' 
    ? VALID_OPPORTUNITY_STATUSES 
    : VALID_APPOINTMENT_STATUSES;
    
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid ${type} status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }
}
3. Implement Idempotency
javascript// Check for existing records before creating
async function createContactIdempotent(contactData, location) {
  // Check if already exists
  const existing = await db.collection('contacts').findOne({
    email: contactData.email,
    locationId: location.locationId
  });
  
  if (existing) {
    console.log('Contact already exists:', existing._id);
    return { exists: true, contact: existing };
  }
  
  // Create new
  return createContact(contactData, location);
}
4. Use Bulk Operations
javascript// Batch operations for efficiency
async function bulkSyncContacts(contacts, locationId) {
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    
    const bulkOps = batch.map(contact => ({
      updateOne: {
        filter: { 
          ghlContactId: contact.ghlContactId,
          locationId 
        },
        update: { $set: contact },
        upsert: true
      }
    }));
    
    await db.collection('contacts').bulkWrite(bulkOps);
    
    // Rate limit between batches
    if (i + BATCH_SIZE < contacts.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}
5. Monitor Sync Health
javascript// Track sync metrics
async function updateSyncMetrics(locationId, entityType, result) {
  await db.collection('locations').updateOne(
    { locationId },
    {
      $set: {
        [`syncMetrics.${entityType}.lastSync`]: new Date(),
        [`syncMetrics.${entityType}.lastResult`]: result
      },
      $inc: {
        [`syncMetrics.${entityType}.${result.success ? 'successCount' : 'errorCount'}`]: 1
      }
    }
  );
}

// Dashboard query
async function getSyncHealth(locationId) {
  const location = await db.collection('locations').findOne({ locationId });
  const metrics = location.syncMetrics || {};
  
  return {
    contacts: {
      ...metrics.contacts,
      synced: await db.collection('contacts').countDocuments({ locationId, ghlContactId: { $exists: true } }),
      total: await db.collection('contacts').countDocuments({ locationId })
    },
    projects: {
      ...metrics.projects,
      synced: await db.collection('projects').countDocuments({ locationId, ghlOpportunityId: { $exists: true } }),
      total: await db.collection('projects').countDocuments({ locationId })
    }
  };
}
Testing & Debugging
Test OAuth Flow
bash# 1. Generate install URL
https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=https://lpai-backend-omega.vercel.app/api/oauth/callback&client_id=683aa5ce1a9647760b904986-mbc8v930&scope=locations.readonly locations.write contacts.readonly contacts.write opportunities.readonly opportunities.write calendars.readonly calendars.write conversations.readonly conversations.write

# 2. Check token storage
db.locations.findOne({ locationId: "YOUR_LOCATION_ID" }, { ghlOAuth: 1 })

# 3. Test token refresh
curl https://lpai-backend-omega.vercel.app/api/cron/refresh-tokens \
  -H "Authorization: Bearer lpai_cron_2024_xK9mN3pQ7rL5vB8wT6yH2jF4"
Debug Webhook Processing
javascript// Check webhook queue
db.webhook_queue.find({ 
  status: "pending",
  type: "ContactCreate" 
}).sort({ createdAt: -1 }).limit(5)

// Check webhook logs
db.webhook_logs.find({
  type: "ContactCreate",
  locationId: "YOUR_LOCATION_ID"
}).sort({ receivedAt: -1 }).limit(5)

// Manually trigger processing
curl https://lpai-backend-omega.vercel.app/api/cron/process-webhooks \
  -H "Authorization: Bearer lpai_cron_2024_xK9mN3pQ7rL5vB8wT6yH2jF4"
Common Debugging Queries
javascript// Find locations with OAuth issues
db.locations.find({
  appInstalled: true,
  $or: [
    { "ghlOAuth.needsReauth": true },
    { "ghlOAuth.accessToken": { $exists: false } }
  ]
})

// Check sync status
db.locations.findOne(
  { locationId: "YOUR_LOCATION_ID" },
  { 
    setupResults: 1,
    lastContactSync: 1,
    lastAppointmentSync: 1,
    "ghlOAuth.expiresAt": 1
  }
)

// Find failed syncs
db.projects.find({
  locationId: "YOUR_LOCATION_ID",
  ghlOpportunityId: { $exists: false },
  createdAt: { $lt: new Date(Date.now() - 24*60*60*1000) }
})
Migration & Maintenance
Migrate from API Keys to OAuth
javascriptasync function migrateToOAuth(locationId) {
  const location = await db.collection('locations').findOne({ locationId });
  
  if (!location.ghlOAuth.accessToken) {
    console.log('No API key to migrate');
    return;
  }
  
  // Location must complete OAuth flow
  console.log(`Location ${locationId} needs to complete OAuth flow`);
  console.log(`Install URL: https://marketplace.gohighlevel.com/oauth/chooselocation?...`);
  
  // After OAuth complete, remove API key
  await db.collection('locations').updateOne(
    { locationId },
    { 
      $unset: { apiKey: "" },
      $set: { migratedToOAuth: new Date() }
    }
  );
}
Cleanup & Maintenance Tasks
javascript// Remove orphaned GHL references
async function cleanupOrphanedReferences(locationId) {
  // Find contacts with GHL IDs that don't exist in GHL
  const contacts = await db.collection('contacts').find({
    locationId,
    ghlContactId: { $exists: true }
  }).toArray();
  
  for (const contact of contacts) {
    try {
      await axios.get(
        `https://services.leadconnectorhq.com/contacts/${contact.ghlContactId}`,
        { headers: getAuthHeaders(location) }
      );
    } catch (error) {
      if (error.response?.status === 404) {
        // GHL contact doesn't exist, remove reference
        await db.collection('contacts').updateOne(
          { _id: contact._id },
          { $unset: { ghlContactId: "" } }
        );
      }
    }
  }
}

// Archive old webhook logs
async function archiveOldWebhooks() {
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
  
  await db.collection('webhook_logs').deleteMany({
    receivedAt: { $lt: cutoffDate }
  });
  
  await db.collection('webhook_queue').deleteMany({
    status: 'completed',
    completedAt: { $lt: cutoffDate }
  });
}
Troubleshooting Guide
OAuth Issues
Problem: "Invalid refresh token"
javascript// Solution: Re-authenticate
await db.collection('locations').updateOne(
  { locationId },
  { 
    $set: { 
      'ghlOAuth.needsReauth': true,
      'ghlOAuth.reauthReason': 'Invalid refresh token'
    }
  }
);
// User must reinstall app
Problem: "Token expired but refresh fails"
javascript// Check refresh token exists
const location = await db.collection('locations').findOne({ locationId });
if (!location.ghlOAuth?.refreshToken) {
  // Need complete reauth
}
Sync Issues
Problem: "Custom field not found"
javascript// Re-sync custom fields
await syncCustomFields(db, location);

// Verify mapping
const mapping = location.ghlCustomFields;
console.log('Custom field mappings:', mapping);
Problem: "Contact sync creates duplicates"
javascript// Use compound unique index
db.contacts.createIndex(
  { email: 1, locationId: 1 },
  { unique: true, sparse: true }
);

// Use upsert with $or condition
{ 
  $or: [
    { ghlContactId: ghlContact.id },
    { email: ghlContact.email, locationId }
  ]
}
Webhook Issues
Problem: "Webhooks not processing"
javascript// 1. Check queue
db.webhook_queue.countDocuments({ status: 'pending' })

// 2. Check cron logs
db.cron_logs.find({ endpoint: 'process-webhooks' }).sort({ ranAt: -1 })

// 3. Manually process
await processWebhookQueue(db);
Problem: "Duplicate webhook events"
javascript// Implement deduplication
const isDuplicate = await db.collection('webhook_hashes').findOne({
  hash: webhookHash,
  createdAt: { $gte: new Date(Date.now() - 60000) } // Within 1 minute
});

if (isDuplicate) {
  return { action: 'skipped', reason: 'duplicate' };
}
Security Considerations

Token Storage: OAuth tokens are encrypted at rest in MongoDB
Webhook Verification: All webhooks verified using GHL public key
Multi-tenant Isolation: All queries filtered by locationId
Rate Limiting: Implement client-side rate limiting to stay under GHL limits
Audit Logging: Track all GHL API calls and webhook events

Monitoring Recommendations

Set up alerts for:

OAuth token refresh failures
High webhook queue depth (>1000 pending)
Sync error rates >10%
API rate limit approaches


Track metrics:

OAuth token age and refresh success rate
Webhook processing latency
Sync completion rates by entity type
API call volumes by endpoint


Regular maintenance:

Clean webhook logs older than 30 days
Verify OAuth token validity weekly
Audit custom field mappings monthly
Review sync error patterns