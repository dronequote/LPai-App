# LPai API Documentation

## Base URL
```
https://lpai-backend-omega.vercel.app
```

## Authentication
All endpoints require JWT authentication token in header:
```
Authorization: Bearer <jwt_token>
```

Get token from `/api/login` endpoint.

---

# 🔐 Authentication

## Login
```http
POST /api/login
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1...",
  "userId": "ghl_user_id",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "name": "John Doe",
  "role": "admin",
  "permissions": ["all"],
  "preferences": {
    "dashboardType": "service",
    "navigatorOrder": ["projects", "contacts", "appointments"]
  }
}
```

---

# 👥 Contacts

## List Contacts
```http
GET /api/contacts?locationId=xxx&limit=50&offset=0&search=john&sortBy=createdAt&sortOrder=desc
```

**Query Parameters:**
- `locationId` (required)
- `limit` (default: 50)
- `offset` (default: 0)
- `search` - Search in name, email, phone
- `sortBy` - Field to sort by
- `sortOrder` - asc/desc
- `tags` - Filter by tags (comma separated)
- `source` - Filter by lead source
- `hasProjects` - true/false
- `startDate` - Created after date
- `endDate` - Created before date

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

## Get Contact
```http
GET /api/contacts/:contactId
```

## Create Contact
```http
POST /api/contacts?locationId=xxx
```

**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "address": "123 Main St",
  "notes": "Interested in plumbing service"
}
```

## Update Contact
```http
PATCH /api/contacts/:contactId
```

**Body:** Any contact fields to update

## Batch Contact Operations
```http
POST /api/contacts/batch
```

**Body:**
```json
{
  "action": "create|update|delete|tag",
  "locationId": "xxx",
  "contacts": [...],
  "options": {
    "skipDuplicates": true,
    "tagOperation": "add|remove|replace",
    "tags": ["tag1", "tag2"]
  }
}
```

---

# 📋 Projects

## List Projects
```http
GET /api/projects?locationId=xxx&limit=50&offset=0
```

**Query Parameters:**
- All base filters plus:
- `status` - Filter by status (open, won, lost)
- `contactId` - Filter by contact
- `pipelineId` - Filter by pipeline
- `pipelineStageId` - Filter by stage
- `search` - Search in title, notes

**Response includes contact info and counts**

## Get Project (Enhanced)
```http
GET /api/projects/:projectId?locationId=xxx
```

**Returns:**
- Full project details
- Contact information
- Related projects
- Upcoming appointments
- Milestones progress
- Timeline events

## Create Project
```http
POST /api/projects
```

**Body:**
```json
{
  "title": "Kitchen Remodel",
  "contactId": "contact_id",
  "locationId": "xxx",
  "userId": "user_id",
  "status": "open",
  "pipelineId": "pipeline_id",
  "monetaryValue": 5000,
  "notes": "Full kitchen renovation"
}
```

## Update Project
```http
PATCH /api/projects/:projectId?locationId=xxx
```

**Body:** Any project fields to update

**Special Updates:**
- Milestone management
- Photo uploads
- Document attachments
- Timeline events
- Custom fields

## Batch Project Operations
```http
POST /api/projects/batch
```

---

# 📅 Appointments

## List Appointments
```http
GET /api/appointments?locationId=xxx&userId=xxx&start=2024-01-01&end=2024-12-31
```

**Query Parameters:**
- `calendarId` - Filter by calendar
- `userId` - Filter by assigned user
- `status` - scheduled, completed, cancelled
- `start/end` - Date range

## Get Appointment
```http
GET /api/appointments/:appointmentId
```

## Create Appointment
```http
POST /api/appointments
```

**Body:**
```json
{
  "title": "Plumbing Consultation",
  "contactId": "xxx",
  "userId": "xxx",
  "locationId": "xxx",
  "calendarId": "xxx",
  "start": "2024-01-15T10:00:00Z",
  "end": "2024-01-15T11:00:00Z",
  "locationType": "address|custom|phone",
  "customLocation": "123 Main St",
  "notes": "Initial consultation"
}
```

## Cancel Appointment
```http
PATCH /api/appointments/:appointmentId
```

**Body:**
```json
{
  "status": "cancelled"
}
```

## Batch Appointment Operations
```http
POST /api/appointments/batch
```

**Actions:** create, cancel, reschedule

---

# 💰 Quotes

## List Quotes
```http
GET /api/quotes?locationId=xxx&projectId=xxx&status=draft
```

**Query Parameters:**
- `status` - draft, published, viewed, signed, expired
- `projectId` - Filter by project
- `contactId` - Filter by contact

## Get Quote
```http
GET /api/quotes/:quoteId?locationId=xxx
```

## Create Quote
```http
POST /api/quotes
```

**Body:**
```json
{
  "projectId": "xxx",
  "contactId": "xxx",
  "locationId": "xxx",
  "userId": "xxx",
  "title": "Kitchen Remodel Quote",
  "sections": [{
    "name": "Materials",
    "lineItems": [{
      "name": "Kitchen Sink",
      "quantity": 1,
      "unitPrice": 299.99,
      "unit": "each"
    }]
  }],
  "taxRate": 0.08,
  "depositType": "percentage",
  "depositValue": 30,
  "termsAndConditions": "...",
  "validUntil": "2024-12-31"
}
```

## Publish Quote
```http
PATCH /api/quotes/:quoteId/publish
```

**Body:**
```json
{
  "locationId": "xxx",
  "userId": "xxx"
}
```

**Returns:** Web link for customer

## Sign Quote
```http
POST /api/quotes/:quoteId/sign
```

**Body:**
```json
{
  "locationId": "xxx",
  "signatureType": "consultant|customer",
  "signature": "base64_image",
  "signedBy": "John Doe",
  "deviceInfo": "iPad"
}
```

## Generate PDF
```http
POST /api/quotes/:quoteId/pdf
```

**Body:**
```json
{
  "locationId": "xxx"
}
```

## Create Revision
```http
POST /api/quotes/:quoteId/create-revision
```

---

# 💳 Payments

## Create Payment Link
```http
POST /api/payments/create-link
```

**Body:**
```json
{
  "projectId": "xxx",
  "quoteId": "xxx",
  "contactId": "xxx",
  "locationId": "xxx",
  "amount": 1500,
  "type": "deposit",
  "description": "30% deposit for kitchen remodel",
  "userId": "xxx"
}
```

## Record Manual Payment
```http
POST /api/payments/record-manual
```

**Body:**
```json
{
  "invoiceId": "ghl_invoice_id",
  "locationId": "xxx",
  "amount": 1500,
  "mode": "cash|cheque",
  "checkNumber": "1234",
  "notes": "Paid in person",
  "userId": "xxx"
}
```

## Upload Payment Proof
```http
POST /api/payments/upload-proof
```

**Body:**
```json
{
  "paymentId": "xxx",
  "photo": "base64_image",
  "locationId": "xxx"
}
```

---

# 💬 SMS

## Send SMS
```http
POST /api/sms/send
```

**Body:**
```json
{
  "contactId": "xxx",
  "locationId": "xxx",
  "templateKey": "on-way",
  "appointmentId": "xxx",
  "userId": "xxx",
  "dynamicData": {
    "eta": "15",
    "newTime": "3:45 PM"
  }
}
```

## Get SMS Templates
```http
GET /api/sms/templates?locationId=xxx&userId=xxx
```

## Update SMS Template
```http
PUT /api/sms/templates
```

**Body:**
```json
{
  "locationId": "xxx",
  "templateKey": "on-way",
  "message": "Hi {contactFirstName}, I'm on my way!",
  "userId": "xxx",
  "scope": "location|user"
}
```

## Send SMS Campaign (Batch)
```http
POST /api/sms/batch
```

---

# 📧 Email

## Send Email
```http
POST /api/emails/send
```

**Body:**
```json
{
  "contactId": "xxx",
  "locationId": "xxx",
  "subject": "Your Quote is Ready",
  "htmlContent": "<html>...",
  "attachments": [{
    "url": "https://...",
    "filename": "quote.pdf"
  }],
  "userId": "xxx"
}
```

## Send Contract Email
```http
POST /api/emails/send-contract
```

**Body:**
```json
{
  "quoteId": "xxx",
  "locationId": "xxx",
  "contactId": "xxx",
  "pdfFileId": "xxx",
  "quoteData": {...},
  "companyData": {...}
}
```

---

# 🔍 Search

## Global Search
```http
POST /api/search/global
```

**Body:**
```json
{
  "query": "john",
  "locationId": "xxx",
  "entities": ["contacts", "projects", "quotes", "appointments"],
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contacts": [...],
    "projects": [...],
    "quotes": [...],
    "appointments": [...],
    "totalResults": 25,
    "searchTime": 45
  }
}
```

## Contact Search
```http
POST /api/search/contacts
```

**Body:**
```json
{
  "query": "smith",
  "locationId": "xxx",
  "filters": {
    "tags": ["vip"],
    "hasProjects": true
  },
  "limit": 20,
  "offset": 0
}
```

---

# 📊 Statistics

## Dashboard Stats
```http
GET /api/stats/dashboard?locationId=xxx&period=month
```

**Response:**
```json
{
  "projects": {
    "total": 145,
    "active": 23,
    "byStatus": {...}
  },
  "quotes": {
    "total": 234,
    "conversionRate": 72.3
  },
  "revenue": {
    "total": 325600,
    "collected": 298400
  },
  "appointments": {
    "upcoming": 12,
    "completionRate": 87.3
  }
}
```

---

# 🏢 Location Settings

## Get Location Info
```http
GET /api/locations/byLocation?locationId=xxx
```

**Returns:**
- Basic info
- Pipelines
- Calendars
- Terms and conditions
- Email templates
- Branding

## Update Location Settings
```http
PATCH /api/locations/byLocation?locationId=xxx
```

**Body:**
```json
{
  "termsAndConditions": "...",
  "branding": {
    "primaryColor": "#2E86AB",
    "logo": "base64_image"
  },
  "emailTemplates": {
    "contractSigned": "template_id"
  }
}
```

---

# 🔧 GHL Sync Endpoints

## Sync Pipelines
```http
GET /api/ghl/pipelines/:locationId
```

## Sync Calendars
```http
GET /api/ghl/calendars/:locationId
```

## Sync Contact from GHL
```http
GET /api/ghl/:contactId
```

---

# 📚 Libraries (Product Catalogs)

## Get Libraries
```http
GET /api/libraries/:locationId
```

## Create Library
```http
POST /api/libraries/:locationId
```

## Update Library (Add Items)
```http
PATCH /api/libraries/:locationId
```

**Body:**
```json
{
  "libraryId": "xxx",
  "action": "add_category|add_item|update_item",
  "category": {...},
  "item": {...}
}
```

---

# 📄 Templates

## Get Location Templates
```http
GET /api/templates/:locationId
```

## Get Global Templates
```http
GET /api/templates/global
```

---

# Response Formats

## Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {...}
}
```

## Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

## Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

# Common Patterns

## Always Include LocationId
Every request needs `locationId` for multi-tenant security.

## Batch Operations
Available for contacts, projects, appointments, SMS:
```json
{
  "action": "create|update|delete",
  "items": [...],
  "options": {...}
}
```

## Date Formats
All dates use ISO 8601: `2024-01-15T10:00:00Z`

## Phone Numbers
Always E.164 format: `+12345678900`

## Status Values

**Projects:** open, won, lost, abandoned

**Appointments:** scheduled, completed, cancelled, no_show

**Quotes:** draft, published, viewed, signed, expired

**Payments:** pending, completed, failed