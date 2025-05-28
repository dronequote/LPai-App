# GoHighLevel (GHL) Integration Guide

## Overview

LPai integrates with GoHighLevel (LeadConnector) as the CRM backend while maintaining MongoDB as the primary data source. This guide explains the sync patterns, API integration, and best practices for GHL integration.

## Architecture Principles

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   LPai App  │     │   MongoDB   │     │     GHL     │
│  (Frontend) │────▶│  (Primary)  │◀───▶│   (Sync)    │
└─────────────┘     └─────────────┘     └─────────────┘
        │                                        ▲
        └────────────────X───────────────────────┘
         Never Direct - Always Through MongoDB
```

### Key Principles

1. **MongoDB First**: All app reads/writes go to MongoDB
2. **Backend Sync**: Only backend syncs with GHL
3. **Selective Sync**: Only sync necessary fields to GHL
4. **Graceful Failures**: GHL sync failures don't block app operations
5. **Field Mapping**: Carefully map between MongoDB and GHL schemas

## GHL API Configuration

### API Versions

```javascript
// GHL uses different API versions for different endpoints
const GHL_API_VERSIONS = {
  contacts: '2021-07-28',
  opportunities: '2021-07-28',
  calendars: '2021-04-15',
  pipelines: '2021-07-28',
  appointments: '2021-04-15',
  conversations: '2021-04-15'  // For emails
};
```

### Base Configuration

```javascript
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

// Headers required for all GHL requests
function getGHLHeaders(apiKey, version) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Version': version
  };
}
```

## Entity Mappings

### Contacts

**MongoDB Contact → GHL Contact**

```javascript
// MongoDB schema
{
  _id: ObjectId,
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  address: String,
  notes: String,
  locationId: String,
  ghlContactId: String  // Stores GHL ID after creation
}

// GHL payload (for creation)
{
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+1234567890",
  address1: "123 Main St",
  locationId: "loc_xxx"
  // notes: NOT supported in contact creation
}

// GHL payload (for updates) - NO locationId
{
  firstName: "John Updated",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+1234567890",
  address1: "123 Main St Updated"
}
```

**Implementation Example:**

```javascript
// Create contact in GHL
async function createContactInGHL(contact, apiKey) {
  try {
    const payload = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      address1: contact.address,
      locationId: contact.locationId
    };
    
    const response = await axios.post(
      `${GHL_BASE_URL}/contacts/`,
      payload,
      { headers: getGHLHeaders(apiKey, '2021-07-28') }
    );
    
    return response.data.contact?.id;
  } catch (error) {
    console.error('GHL Contact Creation Failed:', error.response?.data);
    return null; // Don't block local operation
  }
}

// Update contact in GHL (NO locationId in payload!)
async function updateContactInGHL(ghlContactId, updates, apiKey) {
  const payload = {
    firstName: updates.firstName,
    lastName: updates.lastName,
    email: updates.email,
    phone: updates.phone,
    address1: updates.address
  };
  
  await axios.put(
    `${GHL_BASE_URL}/contacts/${ghlContactId}`,
    payload,
    { headers: getGHLHeaders(apiKey, '2021-07-28') }
  );
}
```

### Projects (Opportunities)

**MongoDB Project → GHL Opportunity**

```javascript
// MongoDB schema
{
  _id: ObjectId,
  title: String,              // → GHL "name"
  status: String,             // Must be valid GHL status
  contactId: String,          // MongoDB contact ID
  locationId: String,
  pipelineId: String,
  monetaryValue: Number,
  
  // MongoDB-only fields
  scopeOfWork: String,        // → Custom field or don't sync
  products: [String],         // → Custom field or don't sync
  milestones: Array,          // Don't sync
  photos: Array,              // Don't sync
  
  ghlOpportunityId: String    // Stores GHL ID after creation
}

// GHL payload (for creation)
{
  contactId: "ghl_contact_id",  // Must use GHL contact ID!
  name: "Kitchen Remodel",
  status: "open",               // open, won, lost, abandoned ONLY
  pipelineId: "pipeline_id",
  locationId: "loc_xxx",
  monetaryValue: 15000
}

// GHL payload (for updates) - Custom fields included
{
  name: "Kitchen Remodel Updated",
  status: "won",
  monetaryValue: 18000,
  customFields: [
    {
      id: "custom_field_id_1",
      key: "project_title",
      field_value: "Kitchen Remodel Updated"
    },
    {
      id: "custom_field_id_2", 
      key: "signed_date",
      field_value: "2025-05-28"
    }
  ]
}
```

**Custom Fields Configuration:**

```javascript
// Stored in locations collection
{
  locationId: "loc_xxx",
  ghlCustomFields: {
    project_title: "custom_field_id_1",
    quote_number: "custom_field_id_2",
    signed_date: "custom_field_id_3",
    scope_of_work: "custom_field_id_4"
  }
}

// Build custom fields for update
async function buildCustomFields(db, locationId, projectData) {
  const location = await db.collection('locations').findOne({ locationId });
  const fieldMappings = location?.ghlCustomFields || {};
  
  const customFields = [];
  
  if (projectData.title && fieldMappings.project_title) {
    customFields.push({
      id: fieldMappings.project_title,
      key: "project_title",
      field_value: projectData.title
    });
  }
  
  if (projectData.signedDate && fieldMappings.signed_date) {
    customFields.push({
      id: fieldMappings.signed_date,
      key: "signed_date",
      field_value: projectData.signedDate
    });
  }
  
  return customFields;
}
```

### Appointments (Calendar Events)

**MongoDB Appointment → GHL Appointment**

```javascript
// MongoDB schema
{
  _id: ObjectId,
  title: String,
  contactId: String,          // MongoDB contact ID
  userId: String,             // MongoDB user ID
  start: Date,
  end: Date,
  calendarId: String,
  notes: String,
  locationType: String,
  ghlAppointmentId: String    // Stores GHL ID after creation
}

// GHL payload - requires all GHL IDs!
{
  title: "Initial Consultation",
  contactId: "ghl_contact_id",        // Must be GHL ID
  assignedUserId: "ghl_user_id",      // Must be GHL ID
  startTime: "2025-05-28T10:00:00Z",
  endTime: "2025-05-28T11:00:00Z",
  calendarId: "calendar_id",
  locationId: "loc_xxx",
  address: "123 Main St",
  appointmentStatus: "confirmed",
  notes: "Discuss kitchen remodel"
}
```

## Sync Patterns

### 1. Write-Through Pattern (Create)

Used when creating new records - create locally first, then sync to GHL.

```javascript
// Example: Create contact
async function createContact(contactData) {
  // 1. Save to MongoDB first
  const mongoResult = await db.collection('contacts').insertOne(contactData);
  
  // 2. Get API key for location
  const location = await db.collection('locations').findOne({ 
    locationId: contactData.locationId 
  });
  
  if (!location?.apiKey) {
    console.warn('No API key, skipping GHL sync');
    return { success: true, contactId: mongoResult.insertedId };
  }
  
  // 3. Sync to GHL (don't block on failure)
  try {
    const ghlContactId = await createContactInGHL(contactData, location.apiKey);
    
    if (ghlContactId) {
      // 4. Update MongoDB with GHL ID
      await db.collection('contacts').updateOne(
        { _id: mongoResult.insertedId },
        { $set: { ghlContactId } }
      );
    }
  } catch (error) {
    console.error('GHL sync failed:', error);
    // Log but don't fail the operation
  }
  
  return { success: true, contactId: mongoResult.insertedId };
}
```

### 2. Update Pattern

Updates go to MongoDB first, then sync to GHL if linked.

```javascript
async function updateProject(projectId, updates, locationId) {
  // 1. Get existing project
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    locationId
  });
  
  if (!project) throw new Error('Project not found');
  
  // 2. Update MongoDB
  await db.collection('projects').updateOne(
    { _id: new ObjectId(projectId) },
    { $set: { ...updates, updatedAt: new Date() } }
  );
  
  // 3. Sync to GHL if linked
  if (project.ghlOpportunityId) {
    const location = await db.collection('locations').findOne({ locationId });
    
    if (location?.apiKey) {
      try {
        // Build custom fields
        const customFields = await buildCustomFields(db, locationId, updates);
        
        await axios.put(
          `${GHL_BASE_URL}/opportunities/${project.ghlOpportunityId}`,
          {
            name: updates.title || project.title,
            status: updates.status || project.status,
            monetaryValue: updates.monetaryValue || project.monetaryValue,
            customFields
          },
          { headers: getGHLHeaders(location.apiKey, '2021-07-28') }
        );
      } catch (error) {
        console.error('GHL update failed:', error.response?.data);
        // Continue - MongoDB is already updated
      }
    }
  }
  
  return { success: true };
}
```

### 3. Pull Pattern (Sync from GHL)

Used for pipelines, calendars, and periodic contact sync.

```javascript
// Sync pipelines from GHL to MongoDB
async function syncPipelines(locationId) {
  const location = await db.collection('locations').findOne({ locationId });
  if (!location?.apiKey) return;
  
  try {
    // Fetch from GHL
    const response = await axios.get(
      `${GHL_BASE_URL}/opportunities/pipelines/`,
      {
        headers: getGHLHeaders(location.apiKey, '2021-07-28'),
        params: { locationId }
      }
    );
    
    const pipelines = response.data.pipelines || [];
    
    // Compare with existing
    const existingPipelines = location.pipelines || [];
    const hasChanged = JSON.stringify(existingPipelines) !== JSON.stringify(pipelines);
    
    if (hasChanged) {
      // Update MongoDB
      await db.collection('locations').updateOne(
        { locationId },
        { 
          $set: { 
            pipelines,
            pipelinesUpdatedAt: new Date()
          }
        }
      );
    }
    
    return { updated: hasChanged, pipelines };
  } catch (error) {
    console.error('Pipeline sync failed:', error);
    throw error;
  }
}
```

### 4. Webhook Pattern (Real-time Updates)

For real-time updates from GHL (future implementation).

```javascript
// Webhook endpoint for GHL updates
app.post('/api/webhooks/ghl', async (req, res) => {
  const { event, data } = req.body;
  
  // Verify webhook signature
  if (!verifyGHLWebhook(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  switch (event) {
    case 'contact.updated':
      await syncContactFromGHL(data.contactId, data.locationId);
      break;
      
    case 'opportunity.statusChanged':
      await updateProjectStatus(data.opportunityId, data.status);
      break;
      
    // Handle other events...
  }
  
  res.status(200).json({ received: true });
});
```

## Error Handling

### Common GHL Errors

```javascript
// 422 - Validation Error (most common)
{
  "errors": {
    "status": ["Invalid status value"],
    "customFields": ["Invalid custom field ID"]
  }
}

// 401 - Invalid API Key
{
  "error": "Unauthorized"
}

// 404 - Resource Not Found
{
  "error": "Contact not found"
}

// 429 - Rate Limited
{
  "error": "Too many requests"
}
```

### Error Handling Strategy

```javascript
async function handleGHLRequest(requestFn, fallbackBehavior) {
  try {
    return await requestFn();
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    
    console.error('GHL API Error:', {
      status,
      data,
      url: error.config?.url,
      payload: error.config?.data
    });
    
    switch (status) {
      case 401:
        // Invalid API key - notify admin
        await notifyAdmin('Invalid GHL API key', { locationId });
        break;
        
      case 422:
        // Validation error - log details
        console.error('GHL Validation Error:', data.errors);
        break;
        
      case 429:
        // Rate limited - implement backoff
        await delay(5000);
        return handleGHLRequest(requestFn, fallbackBehavior);
        
      default:
        // Other errors - use fallback
        if (fallbackBehavior) {
          return fallbackBehavior();
        }
    }
    
    throw error;
  }
}
```

## Best Practices

### 1. Always Use MongoDB IDs Internally

```javascript
// DON'T store GHL IDs as primary references
{
  projectId: "ghl_opportunity_123"  // Bad
}

// DO store MongoDB IDs with GHL IDs separate
{
  projectId: "507f1f77bcf86cd799439011",     // MongoDB ObjectId
  ghlOpportunityId: "ghl_opportunity_123"    // GHL reference
}
```

### 2. Map IDs Before GHL Calls

```javascript
async function prepareGHLPayload(mongoData) {
  // Look up GHL IDs
  const contact = await db.collection('contacts').findOne({
    _id: new ObjectId(mongoData.contactId)
  });
  
  const user = await db.collection('users').findOne({
    _id: new ObjectId(mongoData.userId)
  });
  
  return {
    contactId: contact.ghlContactId,      // Use GHL ID
    assignedUserId: user.ghlUserId,       // Use GHL ID
    ...mongoData
  };
}
```

### 3. Validate Before Sending

```javascript
// Validate GHL status values
const VALID_GHL_STATUSES = ['open', 'won', 'lost', 'abandoned'];

function validateOpportunityStatus(status) {
  if (!VALID_GHL_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${VALID_GHL_STATUSES.join(', ')}`);
  }
}

// Remove invalid fields
function cleanGHLPayload(payload, allowedFields) {
  return Object.keys(payload)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = payload[key];
      return obj;
    }, {});
}
```

### 4. Cache Frequently Used Data

```javascript
// Cache pipelines and calendars
const pipelineCache = new Map();

async function getPipelines(locationId) {
  const cached = pipelineCache.get(locationId);
  const cacheAge = cached?.timestamp ? Date.now() - cached.timestamp : Infinity;
  
  // Use cache if less than 5 minutes old
  if (cached && cacheAge < 300000) {
    return cached.data;
  }
  
  // Fetch fresh data
  const location = await db.collection('locations').findOne({ locationId });
  const pipelines = location?.pipelines || [];
  
  // Update cache
  pipelineCache.set(locationId, {
    data: pipelines,
    timestamp: Date.now()
  });
  
  return pipelines;
}
```

### 5. Implement Sync Status Tracking

```javascript
// Track sync status in MongoDB
{
  _id: ObjectId,
  // ... other fields
  syncStatus: {
    lastSyncedAt: Date,
    syncErrors: [{
      error: String,
      timestamp: Date,
      details: Object
    }],
    needsSync: Boolean
  }
}

// Mark for retry on failure
async function markForResync(collection, documentId, error) {
  await db.collection(collection).updateOne(
    { _id: new ObjectId(documentId) },
    {
      $set: {
        'syncStatus.needsSync': true,
        'syncStatus.lastError': {
          error: error.message,
          timestamp: new Date(),
          details: error.response?.data
        }
      }
    }
  );
}
```

## Testing GHL Integration

### 1. Use GHL API Documentation

```javascript
// Always test in GHL's interactive docs first
// 1. Go to GHL API docs
// 2. Input your test values
// 3. Copy the working example
// 4. Implement in your code

// Example from GHL docs
const curlExample = `
curl --location 'https://services.leadconnectorhq.com/contacts/' \\
--header 'Authorization: Bearer {api_key}' \\
--header 'Version: 2021-07-28' \\
--header 'Content-Type: application/json' \\
--data '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
}'`;
```

### 2. Log Everything During Development

```javascript
// Detailed logging for debugging
function logGHLRequest(method, url, headers, data, response) {
  console.log('🚀 GHL Request:', {
    method,
    url,
    headers: {
      ...headers,
      Authorization: headers.Authorization?.substring(0, 20) + '...'
    },
    payload: JSON.stringify(data, null, 2),
    response: response?.data || response?.error
  });
}
```

### 3. Create Test Utilities

```javascript
// Test utility for GHL sync
async function testGHLConnection(locationId) {
  const location = await db.collection('locations').findOne({ locationId });
  
  if (!location?.apiKey) {
    return { success: false, error: 'No API key configured' };
  }
  
  try {
    // Test pipelines endpoint
    const response = await axios.get(
      `${GHL_BASE_URL}/opportunities/pipelines/`,
      {
        headers: getGHLHeaders(location.apiKey, '2021-07-28'),
        params: { locationId }
      }
    );
    
    return {
      success: true,
      pipelines: response.data.pipelines?.length || 0,
      message: 'GHL connection successful'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}
```

## Monitoring & Maintenance

### 1. Monitor Sync Health

```javascript
// Dashboard metrics
async function getGHLSyncMetrics(locationId) {
  const [contacts, projects, appointments] = await Promise.all([
    db.collection('contacts').countDocuments({
      locationId,
      ghlContactId: { $exists: true }
    }),
    db.collection('projects').countDocuments({
      locationId,
      ghlOpportunityId: { $exists: true }
    }),
    db.collection('appointments').countDocuments({
      locationId,
      ghlAppointmentId: { $exists: true }
    })
  ]);
  
  return {
    syncedContacts: contacts,
    syncedProjects: projects,
    syncedAppointments: appointments,
    lastSync: new Date()
  };
}
```

### 2. Implement Retry Queue

```javascript
// Retry failed syncs
async function processRetryQueue() {
  const failedSyncs = await db.collection('sync_queue').find({
    status: 'failed',
    retries: { $lt: 3 }
  }).limit(10).toArray();
  
  for (const sync of failedSyncs) {
    try {
      await retrySyncOperation(sync);
      
      // Mark as completed
      await db.collection('sync_queue').updateOne(
        { _id: sync._id },
        { $set: { status: 'completed' } }
      );
    } catch (error) {
      // Increment retry count
      await db.collection('sync_queue').updateOne(
        { _id: sync._id },
        { 
          $inc: { retries: 1 },
          $set: { lastError: error.message }
        }
      );
    }
  }
}
```

## Migration Guide

### Migrating Existing GHL Data to MongoDB

```javascript
// One-time migration script
async function migrateGHLDataToMongoDB(locationId) {
  const location = await db.collection('locations').findOne({ locationId });
  if (!location?.apiKey) throw new Error('No API key');
  
  // 1. Migrate Contacts
  let contactOffset = 0;
  const contactLimit = 100;
  
  while (true) {
    const response = await axios.get(`${GHL_BASE_URL}/contacts/`, {
      headers: getGHLHeaders(location.apiKey, '2021-07-28'),
      params: { locationId, limit: contactLimit, offset: contactOffset }
    });
    
    const contacts = response.data.contacts || [];
    if (contacts.length === 0) break;
    
    // Bulk upsert
    const bulkOps = contacts.map(ghlContact => ({
      updateOne: {
        filter: { ghlContactId: ghlContact.id, locationId },
        update: {
          $set: {
            firstName: ghlContact.firstName,
            lastName: ghlContact.lastName,
            email: ghlContact.email,
            phone: ghlContact.phone,
            address: ghlContact.address1,
            ghlContactId: ghlContact.id,
            locationId,
            createdAt: new Date(ghlContact.dateAdded),
            updatedAt: new Date(ghlContact.dateUpdated || ghlContact.dateAdded)
          }
        },
        upsert: true
      }
    }));
    
    await db.collection('contacts').bulkWrite(bulkOps);
    
    contactOffset += contactLimit;
  }
  
  // 2. Migrate Opportunities to Projects
  // ... similar pattern
}
```

## Troubleshooting

### Common Issues

1. **"Invalid custom field ID"**
   - Check locations.ghlCustomFields mapping
   - Verify field exists in GHL location

2. **"Contact not found"**
   - Ensure using GHL contact ID, not MongoDB ID
   - Verify contact exists in GHL

3. **"Invalid status value"**
   - Only use: open, won, lost, abandoned
   - Check for typos or custom statuses

4. **Rate limiting**
   - Implement exponential backoff
   - Batch operations where possible
   - Cache frequently accessed data

5. **Webhook delivery failures**
   - Verify webhook URL is publicly accessible
   - Check webhook signature validation
   - Monitor webhook queue in GHL