# API Reference

Base URL: 
- Development: `http://localhost:3000/api`
- Production: `https://your-domain.com/api`

## Table of Contents

1. [Authentication](#authentication)
2. [Core Resources](#core-resources)
   - [Locations](#locations)
   - [Contacts](#contacts)
   - [Projects](#projects)
   - [Quotes](#quotes)
   - [Appointments](#appointments)
3. [Supporting Resources](#supporting-resources)
   - [Users](#users)
   - [Libraries](#libraries)
   - [Templates](#templates)
   - [Email](#email)
4. [GHL Sync](#ghl-sync)
5. [Response Formats](#response-formats)
6. [Error Handling](#error-handling)

## Authentication

All endpoints except `/login` require JWT token in Authorization header:

```
Authorization: Bearer <token>
```

### Login

```http
POST /api/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "userId": "ghl_user_id",
  "locationId": "loc_xxx",
  "name": "John Doe",
  "role": "admin",
  "permissions": ["read", "write"],
  "_id": "mongodb_user_id",
  "email": "user@example.com"
}
```

## Core Resources

### Locations

Locations represent tenant companies in the system. Each location has its own data, settings, and GHL integration.

#### Get Location Details

```http
GET /api/locations/byLocation?locationId={locationId}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "locationId": "loc_xxx",
  "name": "ABC Plumbing Company",
  "branding": {
    "phone": "+1234567890",
    "email": "info@abcplumbing.com",
    "address": "123 Main St, City, State 12345"
  },
  "pipelines": [
    {
      "id": "pipeline_1",
      "name": "Sales Pipeline",
      "stages": [...]
    }
  ],
  "calendars": [
    {
      "id": "cal_1",
      "name": "Main Calendar",
      "icon": "calendar-outline"
    }
  ],
  "termsAndConditions": "Terms with {companyName} variable...",
  "emailTemplates": {
    "contractSigned": "template_id_1",
    "quoteSent": "template_id_2",
    "invoiceSent": null
  },
  "ghlCustomFields": {
    "project_title": "custom_field_id_1",
    "quote_number": "custom_field_id_2",
    "signed_date": "custom_field_id_3"
  }
}
```

#### Update Location

```http
PATCH /api/locations/byLocation?locationId={locationId}
Content-Type: application/json

{
  "termsAndConditions": "Updated terms and conditions...",
  "branding": {
    "phone": "+9876543210"
  },
  "emailTemplates": {
    "contractSigned": "new_template_id"
  }
}
```

### Contacts

Contacts are the customers/leads in the system.

#### List Contacts

```http
GET /api/contacts?locationId={locationId}
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "address": "456 Oak Ave",
    "notes": "Referred by Mike",
    "locationId": "loc_xxx",
    "ghlContactId": "ghl_contact_xxx",
    "createdAt": "2025-05-20T10:00:00Z",
    "updatedAt": "2025-05-20T10:00:00Z"
  }
]
```

#### Create Contact

```http
POST /api/contacts
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "locationId": "loc_xxx",
  "address": "789 Pine St",
  "notes": "Met at home show"
}
```

**Response:**
```json
{
  "success": true,
  "contactId": "507f1f77bcf86cd799439011",
  "ghlContactId": "ghl_contact_yyy"
}
```

#### Get Single Contact

```http
GET /api/contacts/{id}
```

#### Update Contact

```http
PATCH /api/contacts/{id}
Content-Type: application/json

{
  "firstName": "Jane Updated",
  "phone": "+9876543210",
  "notes": "VIP customer"
}
```

#### Get Contacts with Projects

```http
GET /api/contacts/withProjects?locationId={locationId}
```

**Response includes nested projects array for each contact**

### Projects

Projects represent jobs/opportunities in the system.

#### List Projects

```http
GET /api/projects?locationId={locationId}
```

**Optional Query Parameters:**
- `contactId` - Filter by contact
- `status` - Filter by status
- `userId` - Filter by assigned user

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Kitchen Remodel",
    "contactId": "contact_id",
    "locationId": "loc_xxx",
    "userId": "user_id",
    "status": "open",
    "pipelineId": "pipeline_id",
    "pipelineStageId": "stage_id",
    "monetaryValue": 15000,
    "scopeOfWork": "Complete kitchen renovation including...",
    "products": ["Cabinets", "Countertops", "Appliances"],
    "ghlOpportunityId": "ghl_opp_xxx",
    "quoteId": "quote_id",
    "contactName": "John Doe",
    "contactEmail": "john@example.com",
    "contactPhone": "+1234567890"
  }
]
```

#### Get Enhanced Project Details

```http
GET /api/projects/{id}?locationId={locationId}
```

**Response includes:**
- Full contact object
- Related projects for the same contact
- Upcoming appointments
- Milestones with progress tracking
- Photos and documents arrays
- Timeline events
- Custom fields

#### Create Project

```http
POST /api/projects
Content-Type: application/json

{
  "contactId": "contact_id",
  "locationId": "loc_xxx",
  "userId": "user_id",
  "title": "Bathroom Renovation",
  "status": "open",
  "pipelineId": "pipeline_id",
  "pipelineStageId": "stage_id",
  "scopeOfWork": "Complete bathroom remodel...",
  "products": ["Vanity", "Shower", "Flooring"],
  "monetaryValue": 8000
}
```

#### Update Project

```http
PATCH /api/projects/{id}?locationId={locationId}
Content-Type: application/json

{
  "title": "Master Bathroom Renovation",
  "status": "won",
  "signedDate": "2025-05-28",
  "milestones": [
    {
      "id": "1",
      "title": "Demo complete",
      "completed": true
    }
  ]
}
```

**Note:** Updates sync to GHL opportunity if linked

#### Delete Project (Soft Delete)

```http
DELETE /api/projects/{id}?locationId={locationId}
```

### Quotes

Quotes are proposals sent to customers with pricing, terms, and signature capability.

#### List Quotes

```http
GET /api/quotes?locationId={locationId}
```

**Optional Query Parameters:**
- `projectId` - Filter by project
- `contactId` - Filter by contact
- `status` - Filter by status (draft, published, signed)
- `userId` - Filter by creator

**Response includes enriched contact and project data**

#### Create Quote

```http
POST /api/quotes
Content-Type: application/json

{
  "projectId": "project_id",
  "contactId": "contact_id",
  "locationId": "loc_xxx",
  "userId": "user_id",
  "title": "Kitchen Remodel Quote",
  "description": "Premium kitchen renovation package",
  "sections": [
    {
      "name": "Materials",
      "lineItems": [
        {
          "name": "Premium Cabinets",
          "description": "Solid wood construction",
          "quantity": 10,
          "unitPrice": 500,
          "totalPrice": 5000,
          "unit": "each"
        }
      ]
    },
    {
      "name": "Labor",
      "lineItems": [
        {
          "name": "Installation",
          "quantity": 40,
          "unitPrice": 75,
          "totalPrice": 3000,
          "unit": "hours"
        }
      ]
    }
  ],
  "taxRate": 0.08,
  "discountPercentage": 10,
  "termsAndConditions": "Payment due upon completion...",
  "paymentTerms": "50% deposit, 50% on completion",
  "notes": "Includes 1-year warranty",
  "validUntil": "2025-06-30"
}
```

#### Get Quote Details

```http
GET /api/quotes/{id}?locationId={locationId}
```

#### Update Quote

```http
PATCH /api/quotes/{id}
Content-Type: application/json

{
  "locationId": "loc_xxx",
  "action": "update_status",
  "status": "sent"
}
```

**Or update content:**
```json
{
  "locationId": "loc_xxx",
  "action": "update_content",
  "title": "Updated Quote Title",
  "sections": [...],
  "taxRate": 0.085
}
```

#### Sign Quote

```http
POST /api/quotes/{id}/sign
Content-Type: application/json

{
  "locationId": "loc_xxx",
  "signatureType": "consultant",
  "signature": "data:image/png;base64,iVBORw0KGgo...",
  "signedBy": "user_id",
  "deviceInfo": "iPad App"
}
```

**For customer signature:**
```json
{
  "locationId": "loc_xxx",
  "signatureType": "customer",
  "signature": "data:image/png;base64,iVBORw0KGgo...",
  "signedBy": "John Doe",
  "deviceInfo": "iPad App"
}
```

#### Generate PDF

```http
POST /api/quotes/{id}/pdf
Content-Type: application/json

{
  "locationId": "loc_xxx"
}
```

**Response:**
```json
{
  "success": true,
  "pdf": {
    "fileId": "507f1f77bcf86cd799439011",
    "filename": "quote_Q-2025-001_signed_1234567890.pdf",
    "url": "/api/quotes/{id}/pdf/{fileId}",
    "size": 245678
  }
}
```

#### Retrieve PDF

```http
GET /api/quotes/{id}/pdf?locationId={locationId}&fileId={fileId}
```

**Response:** Binary PDF data with appropriate headers

#### Publish Quote

```http
PATCH /api/quotes/{id}/publish
Content-Type: application/json

{
  "locationId": "loc_xxx",
  "userId": "user_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Quote published successfully",
  "quote": {...},
  "webLink": {
    "token": "secure_random_token",
    "url": "https://app.lpai.com/quote/secure_random_token",
    "expiresAt": "2025-06-28T00:00:00Z"
  }
}
```

#### Create Quote Revision

```http
POST /api/quotes/{id}/create-revision
Content-Type: application/json

{
  "locationId": "loc_xxx",
  "userId": "user_id",
  "revisionData": {
    "sections": [...]
  },
  "notifyCustomer": true
}
```

### Appointments

Appointments are calendar events linked to contacts and projects.

#### List Appointments

```http
GET /api/appointments?locationId={locationId}
```

**Optional Query Parameters:**
- `userId` - Filter by assigned user
- `start` - Start date (ISO 8601)
- `end` - End date (ISO 8601)

#### Create Appointment

```http
POST /api/appointments
Content-Type: application/json

{
  "contactId": "contact_id",
  "userId": "user_id",
  "locationId": "loc_xxx",
  "title": "Initial Consultation",
  "start": "2025-05-28T10:00:00Z",
  "end": "2025-05-28T11:00:00Z",
  "calendarId": "calendar_id",
  "notes": "Discuss kitchen remodel project",
  "locationType": "address",
  "customLocation": "",
  "duration": 60
}
```

**Location Types:**
- `address` - Use contact's address
- `custom` - Use customLocation field
- `phone` - Phone call
- `googlemeet` - Google Meet
- `zoom` - Zoom meeting

#### Get Appointment

```http
GET /api/appointments/{id}
```

**Optional: Get from GHL**
```http
GET /api/appointments/{id}?source=ghl
```

#### Update/Cancel Appointment

```http
PATCH /api/appointments/{id}
Content-Type: application/json

{
  "status": "cancelled"
}
```

**Or update details:**
```json
{
  "title": "Rescheduled Consultation",
  "start": "2025-05-29T14:00:00Z",
  "end": "2025-05-29T15:00:00Z"
}
```

## Supporting Resources

### Users

#### Get Users by Location

```http
GET /api/users?locationId={locationId}
```

#### Get User Details

```http
GET /api/users/{userId}
```

#### Update User Preferences

```http
PATCH /api/users/{userId}
Content-Type: application/json

{
  "preferences": {
    "notifications": true,
    "defaultCalendarView": "week"
  }
}
```

### Libraries (Product Catalogs)

#### Get Libraries

```http
GET /api/libraries/{locationId}
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "locationId": "loc_xxx",
    "name": "Main Product Library",
    "categories": [
      {
        "id": "cat_1",
        "name": "Fixtures",
        "description": "Plumbing fixtures",
        "icon": "home-outline",
        "items": [
          {
            "id": "item_1",
            "name": "Premium Faucet",
            "description": "Chrome finish",
            "basePrice": 299.99,
            "markup": 1.5,
            "unit": "each",
            "sku": "FAU-001"
          }
        ]
      }
    ],
    "isDefault": true
  }
]
```

#### Create Library

```http
POST /api/libraries/{locationId}
Content-Type: application/json

{
  "name": "Custom Product Library",
  "categories": [...]
}
```

#### Update Library (Add Category)

```http
PATCH /api/libraries/{locationId}
Content-Type: application/json

{
  "libraryId": "library_id",
  "action": "add_category",
  "category": {
    "name": "Appliances",
    "description": "Kitchen appliances",
    "icon": "home-outline"
  }
}
```

#### Update Library (Add Item)

```http
PATCH /api/libraries/{locationId}
Content-Type: application/json

{
  "libraryId": "library_id",
  "action": "add_item",
  "category": {
    "id": "cat_1"
  },
  "item": {
    "name": "Dishwasher",
    "basePrice": 599.99,
    "unit": "each",
    "sku": "DW-001"
  }
}
```

### Templates

#### Get Location Templates

```http
GET /api/templates/{locationId}
```

**Response:**
```json
{
  "locationTemplates": [...],
  "globalTemplates": [...]
}
```

#### Get Template Details

```http
GET /api/templates/{locationId}/{templateId}
```

#### Create Template

```http
POST /api/templates/{locationId}
Content-Type: application/json

{
  "name": "Premium Quote Template",
  "category": "quotes",
  "sections": [...],
  "styling": {
    "primaryColor": "#2E86AB"
  }
}
```

#### Update Template

```http
PATCH /api/templates/{locationId}/{templateId}
Content-Type: application/json

{
  "name": "Updated Template Name",
  "sections": [...]
}
```

#### Copy Global Template

```http
POST /api/templates/{locationId}/copy/{globalTemplateId}
Content-Type: application/json

{
  "customizations": {
    "name": "My Custom Version"
  }
}
```

### Email

#### Send Contract Email

```http
POST /api/emails/send-contract
Content-Type: application/json

{
  "quoteId": "quote_id",
  "locationId": "loc_xxx",
  "contactId": "contact_id",
  "pdfFileId": "gridfs_file_id",
  "quoteData": {
    "quoteNumber": "Q-2025-001",
    "customerName": "John Doe",
    "projectTitle": "Kitchen Remodel",
    "total": 15000
  },
  "companyData": {
    "name": "ABC Plumbing",
    "phone": "+1234567890",
    "email": "info@abcplumbing.com"
  }
}
```

## GHL Sync

### Sync Pipelines

```http
GET /api/ghl/pipelines/{locationId}
```

**Response:**
```json
{
  "success": true,
  "updated": true,
  "pipelines": [
    {
      "id": "pipeline_1",
      "name": "Sales Pipeline",
      "stages": [
        {
          "id": "stage_1",
          "name": "Lead"
        }
      ]
    }
  ]
}
```

### Sync Calendars

```http
GET /api/ghl/calendars/{locationId}
```

### Sync Single Contact

```http
GET /api/ghl/{contactId}?locationId={locationId}
```

**Fetches latest data from GHL and updates MongoDB**

### Sync All Contacts

```http
POST /api/ghl/syncContacts
Content-Type: application/json

{
  "locationId": "loc_xxx"
}
```

## Response Formats

### Success Response

```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "error": "Error message here",
  "details": "Additional context about the error",
  "code": "ERROR_CODE"
}
```

### Pagination (where applicable)

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Error Handling

### HTTP Status Codes

- `200` - Success (GET, PATCH, PUT)
- `201` - Created (POST)
- `204` - No Content (DELETE)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `405` - Method Not Allowed
- `422` - Unprocessable Entity (GHL validation errors)
- `500` - Internal Server Error

### Common Error Scenarios

1. **Missing locationId**
```json
{
  "error": "Missing locationId"
}
```

2. **Invalid MongoDB ID**
```json
{
  "error": "Invalid project ID format"
}
```

3. **GHL Sync Failure**
```json
{
  "error": "Failed to sync with GHL",
  "details": "GHL API returned 422: Invalid field 'notes'",
  "ghlError": {...}
}
```

4. **Authentication Failed**
```json
{
  "error": "Invalid credentials"
}
```

5. **Resource Not Found**
```json
{
  "error": "Contact not found or access denied"
}
```

## Best Practices

1. **Always include locationId** in requests for multi-tenant isolation
2. **Use proper HTTP methods** (GET for read, POST for create, PATCH for update, DELETE for remove)
3. **Handle pagination** for list endpoints when dealing with large datasets
4. **Check response status** before processing data
5. **Implement retry logic** for network failures
6. **Cache responses** where appropriate (especially for pipelines, calendars)
7. **Use WebSocket** for real-time updates (planned feature)