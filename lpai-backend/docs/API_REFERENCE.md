# 📱 LPai Mobile App - Comprehensive API Reference

## 🚀 Quick Start Guide

### Base URL
```
https://lpai-backend-omega.vercel.app
```

### Authentication Flow
```
1. Mobile App → POST /api/login → Receives JWT token
2. Store JWT in AsyncStorage
3. Send JWT with all requests: Authorization: Bearer {token}
4. Backend validates JWT → Uses OAuth tokens for GHL
```

### Required Headers for ALL Requests
```javascript
{
  'Authorization': 'Bearer {jwt_token}',
  'Content-Type': 'application/json'
}
```

### Required Parameters for Most Requests
```javascript
{
  locationId: 'user.locationId' // From user object
}
```

### Error Response Format
```javascript
{
  "error": "Error message",
  "details": "Additional details (dev mode only)",
  "statusCode": 400
}
```

---

## 🔐 Authentication & User Management

### POST `/api/login`
**Login with email/password - Returns JWT token**

Request:
```javascript
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response (200):
```javascript
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "userId": "ghl_user_id",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "name": "John Doe",
  "permissions": ["dashboard", "contacts", "projects"],
  "role": "admin",
  "_id": "mongo_user_id",
  "email": "user@example.com",
  "preferences": {
    "dashboardType": "service",
    "navigatorOrder": "['Home', 'Projects', 'Quotes']",
    "showGlobalTemplates": true
  }
}
```

Error Responses:
- 401: Invalid credentials
- 400: Missing email or password

### POST `/api/login/oauth`
**Login with Google OAuth email**

Request:
```javascript
"user@example.com" // Just the email string
```

Response: Same as `/api/login` or `{ noEmailFound: true }`

### GET `/api/users?locationId={locationId}`
**Get all users for a location**

Response (200):
```javascript
[
  {
    "_id": "123",
    "userId": "ghl_user_id", // This is ghlUserId in DB
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "locationId": "JMtlZzwrNOUmLpJk2eCE",
    "permissions": ["dashboard", "contacts"],
    "phone": "+1234567890",
    "preferences": {},
    "isActive": true,
    "dateAdded": "2024-01-01T00:00:00Z"
  }
]
```

### GET `/api/users/{userId}`
**Get specific user details**

Response: Single user object

### PATCH `/api/users/{userId}`
**Update user (mainly preferences)**

Request:
```javascript
{
  "preferences": {
    "navigatorOrder": "['Home', 'Projects', 'Quotes']",
    "dashboardType": "custom",
    "showGlobalTemplates": true,
    "customDashboard": {
      "layout": [...]
    }
  }
}
```

---

## 👥 Contacts Management

### GET `/api/contacts/search/lpai?locationId={locationId}`
**Search contacts in MongoDB (fast, local)**

Response (200):
```javascript
[
  {
    "_id": "123",
    "ghlContactId": "ghl_123",
    "locationId": "JMtlZzwrNOUmLpJk2eCE",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "secondaryPhone": "",
    "address": "123 Main St",
    "city": "Denver",
    "state": "CO",
    "country": "USA",
    "postalCode": "80202",
    "companyName": "ABC Corp",
    "website": "www.example.com",
    "dateOfBirth": null,
    "dnd": false,
    "tags": ["customer", "vip"],
    "source": "Website",
    "type": "lead",
    "assignedTo": null,
    "customFields": [],
    "additionalEmails": [],
    "attributions": [
      {
        "utmSessionSource": "google",
        "medium": "cpc",
        "isFirst": true
      }
    ],
    "ghlCreatedAt": "2024-01-01T00:00:00Z",
    "ghlUpdatedAt": "2024-01-01T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

### POST `/api/contacts/search/ghl`
**Search contacts in GHL (real-time)**

Request:
```javascript
{
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "query": "john",
  "limit": 20
}
```

### POST `/api/contacts?locationId={locationId}`
**Create new contact (syncs to GHL)**

Request:
```javascript
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "1234567890", // Will be formatted to E.164
  "address": "123 Main St",
  "city": "Denver",
  "state": "CO",
  "postalCode": "80202",
  "tags": ["new-customer"],
  "source": "Mobile App"
}
```

Response: Created contact with `ghlContactId`

### GET `/api/contacts/{contactId}`
**Get single contact details**

Response: Single contact object

### PATCH `/api/contacts/{contactId}`
**Update contact (syncs to GHL)**

Request: Any contact fields to update
```javascript
{
  "firstName": "Jane",
  "phone": "+9876543210",
  "notes": "VIP customer",
  "address": "456 New St"
}
```

### GET `/api/contacts/withProjects?locationId={locationId}`
**Get contacts with their projects**

Response:
```javascript
[
  {
    ...contactData,
    "projects": [
      {
        "_id": "123",
        "title": "Kitchen Remodel",
        "status": "in_progress",
        "monetaryValue": 5000
      }
    ]
  }
]
```

### GET `/api/contacts/{contactId}/conversations?locationId={locationId}`
**Get all conversations for a contact**

Query params:
- `limit`: Number of results (default: 10)
- `offset`: Skip results (default: 0)
- `type`: Filter by type (TYPE_EMAIL, TYPE_PHONE, etc)

Response:
```javascript
{
  "success": true,
  "contactId": "123",
  "contactName": "John Doe",
  "conversations": [
    {
      "id": "conv_123",
      "type": "TYPE_EMAIL",
      "lastMessageDate": "2024-01-01T00:00:00Z",
      "lastMessageBody": "Thanks for your quote...",
      "lastMessageType": "TYPE_EMAIL",
      "lastMessageDirection": "inbound",
      "unreadCount": 2,
      "starred": false,
      "tags": [],
      "projectId": "proj_123",
      "projectTitle": "Kitchen Remodel"
    }
  ],
  "pagination": {
    "total": 50,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

### POST `/api/contacts/{contactId}/sync-notes`
**🆕 Sync notes from GHL for specific contact**

Request:
```javascript
{
  "locationId": "JMtlZzwrNOUmLpJk2eCE"
}
```

Response:
```javascript
{
  "success": true,
  "created": 3,
  "updated": 1,
  "notes": [...]
}
```

---

## 🔨 Projects (Opportunities)

### GET `/api/projects?locationId={locationId}`
**Get all projects with contact info**

Query params:
- `contactId`: Filter by contact
- `status`: Filter by status
- `userId`: Filter by assigned user

Response:
```javascript
[
  {
    "_id": "123",
    "ghlOpportunityId": "opp_123",
    "locationId": "JMtlZzwrNOUmLpJk2eCE",
    "title": "Kitchen Remodel",
    "status": "won",
    "contactId": "contact_123",
    "userId": "user_123",
    "pipelineId": "pipe_123",
    "pipelineStageId": "stage_123",
    "monetaryValue": 5000,
    "quoteNumber": "Q-2025-001",
    "signedDate": "2024-01-01",
    "contactName": "John Doe",
    "contactEmail": "john@example.com",
    "contactPhone": "+1234567890",
    "ghlCreatedAt": "2024-01-01T00:00:00Z",
    "ghlUpdatedAt": "2024-01-01T00:00:00Z",
    "timeline": [
      {
        "id": "1",
        "event": "project_created",
        "description": "Project created",
        "timestamp": "2024-01-01T00:00:00Z",
        "metadata": {
          "syncedFrom": "opportunity"
        }
      }
    ],
    "milestones": [
      {
        "id": "1",
        "title": "Initial consultation",
        "completed": true,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "photos": [],
    "documents": [],
    "hasQuote": true,
    "quoteId": "quote_123",
    "activeQuoteId": "quote_123"
  }
]
```

### POST `/api/projects`
**Create new project (syncs to GHL)**

Request:
```javascript
{
  "contactId": "contact_123",
  "userId": "user_123",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "title": "Kitchen Remodel",
  "status": "open",
  "scopeOfWork": "Full kitchen renovation",
  "products": ["Cabinets", "Countertops", "Appliances"],
  "pipelineId": "pipe_123", // Required for GHL sync
  "pipelineStageId": "stage_123",
  "monetaryValue": 5000
}
```

Response:
```javascript
{
  "success": true,
  "projectId": "123",
  "ghlOpportunityId": "opp_123"
}
```

### GET `/api/projects/{id}?locationId={locationId}`
**Get project with full details**

Response includes:
- Full project data
- Contact details object
- Other projects for same contact
- Upcoming appointments
- Timeline events
- Progress percentage
- Milestones tracking
- Custom fields

### PATCH `/api/projects/{id}?locationId={locationId}`
**Update project (syncs to GHL)**

Request:
```javascript
{
  "title": "Updated Title",
  "status": "won",
  "signedDate": "2024-01-01",
  "monetaryValue": 6000,
  "milestones": [
    {
      "id": "1",
      "title": "Demo complete",
      "completed": true
    }
  ],
  "customFields": {
    "field1": "value1"
  }
}
```

**Note:** Custom fields sync to GHL if location has them configured in `locations.ghlCustomFields`

### DELETE `/api/projects/{id}?locationId={locationId}`
**Soft delete project (sets status to 'Deleted')**

### GET `/api/projects/byContact?contactId={contactId}`
**Get all projects for a contact**

---

## 📄 Quotes & Signatures

### GET `/api/quotes?locationId={locationId}`
**Get all quotes**

Query params:
- `projectId`: Filter by project
- `contactId`: Filter by contact
- `status`: Filter by status (draft, published, signed, paid)
- `userId`: Filter by creator

Response includes enriched contact and project data

### POST `/api/quotes`
**Create new quote**

Request:
```javascript
{
  "projectId": "proj_123",
  "contactId": "contact_123",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "userId": "user_123",
  "title": "Kitchen Remodel Quote",
  "description": "Premium kitchen renovation package",
  "sections": [
    {
      "name": "Materials",
      "lineItems": [
        {
          "name": "Cabinet Set",
          "description": "Premium wood cabinets",
          "quantity": 1,
          "unitPrice": 5000,
          "totalPrice": 5000,
          "unit": "set",
          "sku": "CAB-001",
          "libraryItemId": "lib_item_123", // Optional
          "categoryId": "cat_123" // Optional
        }
      ]
    },
    {
      "name": "Labor",
      "lineItems": [
        {
          "name": "Installation",
          "description": "Professional installation",
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
  "depositType": "percentage", // or "fixed"
  "depositValue": 30, // 30% or $30
  "termsAndConditions": "Standard terms...",
  "paymentTerms": "50% deposit, 50% on completion",
  "notes": "Includes 1-year warranty",
  "validUntil": "2024-12-31"
}
```

Response: Created quote with calculated totals and payment summary

### GET `/api/quotes/{id}?locationId={locationId}`
**Get quote details**

### PATCH `/api/quotes/{id}`
**Update quote**

For status change:
```javascript
{
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "action": "update_status",
  "status": "sent",
  "userId": "user_123"
}
```

For content update:
```javascript
{
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "action": "update_content",
  "title": "Updated Title",
  "sections": [...],
  "taxRate": 0.085,
  "depositType": "fixed",
  "depositValue": 2000
}
```

### POST `/api/quotes/{id}/sign`
**Add digital signature**

Request:
```javascript
{
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "signatureType": "consultant" | "customer",
  "signature": "base64_image_data",
  "signedBy": "John Doe",
  "deviceInfo": "iPad App"
}
```

Response:
```javascript
{
  "success": true,
  "signatureType": "consultant",
  "fullySignedCompleted": false, // true when both signatures complete
  "quote": {
    "_id": "quote_123",
    "quoteNumber": "Q-2025-001",
    "status": "signed", // Only if both signed
    "signatures": {
      "consultant": {
        "signature": "base64_data",
        "signedAt": "2024-01-01T00:00:00Z",
        "signedBy": "user_123",
        "deviceInfo": "iPad App"
      },
      "customer": {
        "signature": "base64_data",
        "signedAt": "2024-01-01T00:00:00Z",
        "signedBy": "John Doe",
        "deviceInfo": "iPad App"
      }
    }
  }
}
```

### PATCH `/api/quotes/{id}/publish`
**Publish quote (make it viewable)**

Request:
```javascript
{
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "userId": "user_123"
}
```

Response:
```javascript
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

### POST `/api/quotes/{id}/pdf`
**Generate PDF**

Request:
```javascript
{
  "locationId": "JMtlZzwrNOUmLpJk2eCE"
}
```

Response:
```javascript
{
  "success": true,
  "pdf": {
    "fileId": "file_123",
    "filename": "quote_Q-2024-001_signed.pdf",
    "url": "/api/quotes/123/pdf?locationId=xxx&fileId=yyy",
    "size": 102400
  }
}
```

### GET `/api/quotes/{id}/pdf?locationId={locationId}&fileId={fileId}`
**Download PDF**

Returns: Binary PDF data with appropriate headers

### POST `/api/quotes/{id}/create-revision`
**Create quote revision**

Request:
```javascript
{
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "userId": "user_123",
  "revisionData": {
    "sections": [...], // Updated sections
    "total": 6000
  },
  "notifyCustomer": true
}
```

Response:
```javascript
{
  "success": true,
  "message": "Quote revision created successfully",
  "originalQuote": {
    "_id": "quote_123",
    "quoteNumber": "Q-2025-001",
    "status": "superseded"
  },
  "revisionQuote": {
    "_id": "quote_456",
    "quoteNumber": "Q-2025-001-R2",
    "version": 2,
    "parentQuoteId": "quote_123",
    "status": "published"
  }
}
```

### DELETE `/api/quotes/{id}?locationId={locationId}&userId={userId}`
**Soft delete quote**

---

## 📅 Appointments

### GET `/api/appointments?locationId={locationId}`
**Get appointments**

Query params:
- `userId`: Filter by assigned user
- `start`: Start date (ISO)
- `end`: End date (ISO)

Response:
```javascript
[
  {
    "_id": "123",
    "ghlAppointmentId": "appt_123",
    "ghlEventId": "event_123",
    "locationId": "JMtlZzwrNOUmLpJk2eCE",
    "title": "Kitchen Consultation",
    "notes": "Discuss renovation plans",
    "contactId": "contact_123",
    "userId": "user_123",
    "calendarId": "cal_123",
    "groupId": "group_123",
    "start": "2024-01-01T10:00:00Z",
    "end": "2024-01-01T11:00:00Z",
    "duration": 60,
    "timezone": "America/Denver",
    "locationType": "address",
    "customLocation": "",
    "address": "123 Main St",
    "status": "scheduled",
    "appointmentStatus": "confirmed",
    "contactName": "John Doe",
    "contactEmail": "john@example.com",
    "contactPhone": "+1234567890",
    "calendarName": "Service Calendar",
    "assignedUserId": "user_123",
    "assignedResources": [],
    "isRecurring": false,
    "createdBy": {
      "source": "calendar_page",
      "userId": "user_123"
    },
    "ghlCreatedAt": "2024-01-01T00:00:00Z",
    "ghlUpdatedAt": "2024-01-01T00:00:00Z"
  }
]
```

### POST `/api/appointments`
**Create appointment (syncs to GHL)**

Request:
```javascript
{
  "contactId": "contact_123",
  "userId": "user_123",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "calendarId": "cal_123",
  "start": "2024-01-01T10:00:00Z",
  "end": "2024-01-01T11:00:00Z",
  "title": "Kitchen Consultation",
  "notes": "Measure for remodel",
  "locationType": "address", // address|custom|phone|googlemeet|zoom
  "customLocation": "Customer home",
  "duration": 60
}
```

Response:
```javascript
{
  "appointment": {...},
  "ghlPayload": {...}, // What was sent to GHL
  "ghlResponse": {...}, // GHL response
  "ghlAppointmentId": "appt_123"
}
```

### GET `/api/appointments/{id}?source=ghl`
**Get appointment (optionally from GHL)**

### PATCH `/api/appointments/{id}`
**Update/Cancel appointment**

To cancel:
```javascript
{
  "status": "cancelled"
}
```

To update:
```javascript
{
  "title": "Updated Title",
  "start": "2024-01-01T11:00:00Z",
  "end": "2024-01-01T12:00:00Z",
  "notes": "Updated notes"
}
```

---

## 💬 Messaging - SMS

### POST `/api/sms/send`
**Send SMS message**

Request:
```javascript
{
  "contactId": "contact_123",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "templateKey": "on-way", // Or use customMessage
  "customMessage": "Custom text here",
  "appointmentId": "appt_123", // Optional
  "projectId": "proj_123", // Optional
  "userId": "user_123",
  "dynamicData": {
    "eta": "15",
    "newTime": "3:45 PM",
    "lateMinutes": "10"
  }
}
```

Response:
```javascript
{
  "success": true,
  "messageId": "msg_123",
  "smsRecordId": "sms_123",
  "conversationId": "conv_123",
  "message": "SMS sent successfully"
}
```

### GET `/api/sms/templates?locationId={locationId}`
**Get SMS templates**

Query params:
- `userId`: Get user-specific customizations

Response:
```javascript
{
  "templates": {
    "on-way": {
      "name": "On My Way",
      "message": "Hi {contactFirstName}, this is {userName} from {locationName}. I'm on my way to your appointment and should arrive in approximately {eta} minutes.",
      "description": "Sent when technician starts navigation",
      "variables": ["contactFirstName", "userName", "locationName", "eta"],
      "category": "appointment",
      "isCustomized": false,
      "isUserCustomized": false
    },
    "running-late": {...},
    "arrived": {...},
    "appointment-reminder": {...},
    "quote-sent": {...},
    "payment-received": {...},
    "job-complete": {...}
  },
  "canEditTemplates": true,
  "hasLocationCustomTemplates": false,
  "hasUserCustomTemplates": false,
  "availableVariables": {
    "user": [...],
    "location": [...],
    "contact": [...],
    "appointment": [...],
    "project": [...],
    "dynamic": [...]
  },
  "categories": ["appointment", "reminder", "sales", "billing", "completion"]
}
```

### PUT `/api/sms/templates`
**Customize SMS template**

Request:
```javascript
{
  "templateKey": "on-way",
  "message": "Updated message with {variables}",
  "userId": "user_123",
  "scope": "location" // or "user"
}
```

### POST `/api/sms/templates`
**Reset template to default**

Request:
```javascript
{
  "templateKey": "on-way",
  "scope": "location", // or "user"
  "userId": "user_123"
}
```

---

## 📧 Messaging - Email

### POST `/api/emails/send`
**Send email**

Request:
```javascript
{
  "contactId": "contact_123",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "subject": "Your Quote is Ready",
  "htmlContent": "<h1>Quote Ready</h1><p>...</p>",
  "plainTextContent": "Quote Ready...",
  "attachments": [
    {
      "url": "https://example.com/file.pdf",
      "filename": "quote.pdf"
    }
  ],
  "appointmentId": "appt_123", // Optional
  "projectId": "proj_123", // Optional
  "userId": "user_123",
  "replyToMessageId": "msg_123" // Optional for threading
}
```

Response:
```javascript
{
  "success": true,
  "messageId": "msg_123",
  "conversationId": "conv_123",
  "message": "Email sent successfully"
}
```

### POST `/api/emails/send-contract`
**Send contract email with PDF**

Request:
```javascript
{
  "quoteId": "quote_123",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "contactId": "contact_123",
  "pdfFileId": "file_123",
  "quoteData": {
    "quoteNumber": "Q-2025-001",
    "customerName": "John Doe",
    "projectTitle": "Kitchen Remodel",
    "title": "Kitchen Remodel Quote",
    "total": 15000,
    "description": "Premium renovation"
  },
  "companyData": {
    "name": "ABC Plumbing",
    "phone": "+1234567890",
    "email": "info@abc.com",
    "address": "123 Main St",
    "establishedYear": "2010",
    "warrantyYears": "2"
  }
}
```

Response:
```javascript
{
  "success": true,
  "emailId": "email_123",
  "templateUsed": "Contract Signed",
  "sentAt": "2024-01-01T00:00:00Z",
  "sentTo": "john@example.com"
}
```

---

## 💸 Payments

### POST `/api/payments/create-link`
**Create payment link (GHL invoice)**

Request:
```javascript
{
  "projectId": "proj_123",
  "quoteId": "quote_123",
  "contactId": "contact_123",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "amount": 1500,
  "description": "30% Deposit for Kitchen Remodel",
  "type": "deposit", // deposit|progress|final
  "userId": "user_123"
}
```

Response:
```javascript
{
  "success": true,
  "paymentId": "payment_123",
  "paymentUrl": "https://updates.leadprospecting.ai/invoice/xxx",
  "amount": 1500,
  "invoiceNumber": "DEP-1234",
  "message": "Invoice created successfully"
}
```

**Note:** System prevents duplicate invoices for same quote/type

### POST `/api/payments/record-manual`
**Record cash/check payment**

Request:
```javascript
{
  "invoiceId": "ghl_invoice_id",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "amount": 1500,
  "mode": "cash" | "cheque",
  "checkNumber": "1234", // For checks
  "notes": "Paid in person",
  "userId": "user_123"
}
```

Response:
```javascript
{
  "success": true,
  "message": "Payment recorded successfully",
  "paymentId": "payment_123"
}
```

### POST `/api/payments/upload-proof`
**Upload payment proof photo**

Request:
```javascript
{
  "paymentId": "payment_123",
  "photo": "base64_image_data",
  "locationId": "JMtlZzwrNOUmLpJk2eCE"
}
```

Response:
```javascript
{
  "success": true,
  "photoId": "file_123",
  "message": "Photo proof uploaded successfully"
}
```

### GET `/api/payments/{id}?locationId={locationId}`
**Get payment details**

### PATCH `/api/payments/{id}`
**Update payment status**

Request:
```javascript
{
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "status": "completed",
  "completedAt": "2024-01-01T00:00:00Z",
  "ghlTransactionId": "trans_123"
}
```

---

## 💬 Conversations & Messages

### GET `/api/conversations?locationId={locationId}`
**Get conversations list**

Query params:
- `contactId`: Filter by contact
- `type`: Filter by type (sms|email)
- `includeEmail`: Include email conversations (default: true)

Response:
```javascript
[
  {
    "_id": "conv_123",
    "ghlConversationId": "ghl_conv_123",
    "locationId": "JMtlZzwrNOUmLpJk2eCE",
    "contactId": "contact_123",
    "projectId": "proj_123", // Optional
    "type": "TYPE_PHONE",
    "unreadCount": 2,
    "inbox": true,
    "starred": false,
    "lastMessageDate": "2024-01-01T00:00:00Z",
    "lastMessageBody": "Thanks for the quote",
    "lastMessageType": "TYPE_SMS",
    "lastMessageDirection": "inbound",
    "contactName": "John Doe",
    "contactEmail": "john@example.com",
    "contactPhone": "+1234567890",
    "attributed": false,
    "scoring": [],
    "followers": ["user_123"],
    "tags": [],
    "contact": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    }
  }
]
```

### GET `/api/conversations/{conversationId}/messages?locationId={locationId}`
**Get messages in conversation**

Query params:
- `limit`: Number of messages (default: 20)
- `offset`: Skip messages (default: 0)

Response:
```javascript
{
  "success": true,
  "conversationId": "conv_123",
  "messages": [
    {
      "id": "msg_123",
      "type": 1, // 1=SMS, 3=Email, 25=Activity-Contact, 26=Activity-Invoice
      "messageType": "TYPE_SMS", // or TYPE_EMAIL, TYPE_ACTIVITY_OPPORTUNITY
      "direction": "inbound",
      "dateAdded": "2024-01-01T00:00:00Z",
      "source": "app",
      "body": "Message content",
      "read": true,
      "status": "delivered"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Note:** Messages marked as read automatically when fetched

### GET `/api/messages/email/{emailMessageId}?locationId={locationId}`
**Get email content (fetches from GHL if needed)**

Response:
```javascript
{
  "success": true,
  "email": {
    "id": "email_123",
    "subject": "Re: Your Quote",
    "body": "<html>...</html>",
    "from": "john@example.com",
    "to": ["info@company.com"],
    "cc": [],
    "bcc": [],
    "dateAdded": "2024-01-01T00:00:00Z",
    "status": "sent",
    "direction": "inbound",
    "provider": "gmail",
    "threadId": "thread_123"
  }
}
```

---

## 🏢 Location Settings

### GET `/api/locations/byLocation?locationId={locationId}`
**Get location settings and data**

Response:
```javascript
{
  "_id": "123",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "name": "Demo Company",
  "branding": {
    "logo": "https://...",
    "primaryColor": "#2E86AB",
    "phone": "(555) 123-4567",
    "email": "info@company.com",
    "address": "123 Main St, Denver, CO"
  },
  "pipelines": [
    {
      "id": "pipe_123",
      "name": "Sales Pipeline",
      "stages": [
        {
          "id": "stage_123",
          "name": "Lead",
          "position": 1
        }
      ]
    }
  ],
  "calendars": [
    {
      "id": "cal_123",
      "calendarId": "cal_123",
      "name": "Service Calendar",
      "description": "Main service calendar",
      "color": "#FF6900",
      "icon": "calendar-outline",
      "isActive": true
    }
  ],
  "termsAndConditions": "Standard terms...",
  "emailTemplates": {
    "contractSigned": "template_123",
    "quoteSent": null,
    "invoiceSent": null
  },
  "companyInfo": {
    "establishedYear": "2010",
    "warrantyYears": "2"
  }
}
```

### PATCH `/api/locations/byLocation?locationId={locationId}`
**Update location settings**

Request: Any fields to update
```javascript
{
  "termsAndConditions": "Updated terms",
  "branding": {
    "primaryColor": "#FF6900"
  },
  "companyInfo": {
    "warrantyYears": "5"
  }
}
```

### POST `/api/locations/setup-location`
**Setup/sync location data from GHL**

Request:
```javascript
{
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "fullSync": true // false for partial sync
}
```

---

## 📚 Product Libraries

### GET `/api/libraries/{locationId}`
**Get product libraries**

Response:
```javascript
[
  {
    "_id": "lib_123",
    "locationId": "JMtlZzwrNOUmLpJk2eCE",
    "name": "Main Product Library",
    "isDefault": true,
    "isShared": false,
    "categories": [
      {
        "id": "cat_123",
        "name": "Fixtures",
        "description": "Toilets, sinks, faucets",
        "icon": "home-outline",
        "sortOrder": 1,
        "isActive": true,
        "items": [
          {
            "id": "item_123",
            "name": "Premium Toilet",
            "description": "High-efficiency toilet",
            "basePrice": 500,
            "markup": 1.5,
            "unit": "each",
            "sku": "TOI-001",
            "isActive": true,
            "usageCount": 0,
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
          }
        ],
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "createdBy": "system",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

### POST `/api/libraries/{locationId}`
**Create new library**

Request:
```javascript
{
  "name": "Custom Product Library",
  "categories": [
    {
      "name": "Custom Category",
      "description": "Custom products",
      "icon": "cube-outline"
    }
  ]
}
```

### PATCH `/api/libraries/{locationId}`
**Update library (add/edit items)**

Add category:
```javascript
{
  "libraryId": "lib_123",
  "action": "add_category",
  "category": {
    "name": "Appliances",
    "description": "Kitchen appliances",
    "icon": "home-outline",
    "sortOrder": 2
  }
}
```

Add item:
```javascript
{
  "libraryId": "lib_123",
  "action": "add_item",
  "category": {
    "id": "cat_123"
  },
  "item": {
    "name": "Dishwasher",
    "description": "Energy efficient",
    "basePrice": 599.99,
    "markup": 1.3,
    "unit": "each",
    "sku": "DW-001"
  }
}
```

Update item:
```javascript
{
  "libraryId": "lib_123",
  "action": "update_item",
  "category": {
    "id": "cat_123"
  },
  "item": {
    "id": "item_123",
    "name": "Updated Name",
    "basePrice": 699.99
  }
}
```

---

## 🎨 Templates (Quote Templates)

### GET `/api/templates/{locationId}`
**Get location and global templates**

Response:
```javascript
{
  "locationTemplates": [
    // Custom location-specific templates
  ],
  "globalTemplates": [
    {
      "_id": "template_123",
      "isGlobal": true,
      "name": "Professional Plumbing",
      "description": "Clean, professional template",
      "category": "plumbing",
      "preview": "🔧",
      "isDefault": false,
      "styling": {
        "primaryColor": "#2E86AB",
        "accentColor": "#A23B72",
        "fontFamily": "system",
        "layout": "standard"
      },
      "companyOverrides": {
        "name": null,
        "logo": null,
        "tagline": null,
        "phone": null,
        "email": null,
        "address": null,
        "establishedYear": "2010",
        "warrantyYears": "2"
      },
      "tabs": [
        {
          "id": "overview",
          "title": "Project Overview",
          "icon": "📋",
          "enabled": true,
          "order": 1,
          "blocks": [
            {
              "id": "block_1",
              "type": "hero",
              "position": 1,
              "content": {
                "title": "Your {projectTitle} Quote",
                "subtitle": "Professional Service Estimate",
                "icon": "🔧"
              }
            }
          ]
        }
      ],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "createdBy": "admin"
    }
  ]
}
```

### GET `/api/templates/{locationId}/{templateId}`
**Get specific template details**

### POST `/api/templates/{locationId}`
**Create custom template**

### PATCH `/api/templates/{locationId}/{templateId}`
**Update template (location templates only)**

### DELETE `/api/templates/{locationId}/{templateId}`
**Delete template (location templates only)**

### POST `/api/templates/{locationId}/copy/{globalTemplateId}`
**Copy global template to location**

Request:
```javascript
{
  "customizations": {
    "name": "My Custom Plumbing Template"
  }
}
```

### GET `/api/templates/global`
**Get all global templates**

### POST `/api/templates/global`
**Create global template (admin only)**

---

## 🔧 Additional Resources

### POST `/api/invoices/create`
**Create invoice (for payments)**

Request:
```javascript
{
  "projectId": "proj_123",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "title": "Kitchen Remodel Invoice",
  "amount": 5000,
  "type": "deposit", // deposit|progress|final
  "amountType": "percentage", // percentage|fixed
  "amountValue": 30
}
```

### POST `/api/maps/calculate-eta`
**Calculate ETA between points**

Request:
```javascript
{
  "origin": { "lat": 39.7392, "lng": -104.9903 },
  "destination": "123 Main St, Denver, CO" // or coordinates
}
```

Response:
```javascript
{
  "success": true,
  "duration": 15, // minutes
  "distance": 8, // km
  "trafficCondition": "normal", // normal|moderate|heavy
  "originalDuration": 12 // without traffic
}
```

### GET `/api/status`
**Check API health**

Response:
```javascript
{
  "status": "healthy",
  "database": "connected",
  "counts": {
    "locations": 42,
    "pendingWebhooks": 3,
    "agencies": 5
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### GET `/api/payments/products/ghl?locationId={locationId}`
**Get GHL products**

---

## 🆕 New Features Available

### 1. **Notes System**
- Notes are synced from GHL
- Available on contacts via `sync-notes` endpoint
- Stored in `notes` collection with full text and metadata

### 2. **Tasks System**
- Tasks synced from GHL
- Available in `tasks` collection
- Can filter by contact, status, due date
- Includes assigned user details

### 3. **Tags System**
- Tags synced from GHL
- Available in `tags` collection
- Can be applied to contacts, projects
- Includes color coding

### 4. **Templates System**
- Global templates for quotes
- Location-specific customizations
- Multiple styling options
- Dynamic content blocks

### 5. **Enhanced User Preferences**
```javascript
{
  "dashboardType": "service" | "sales" | "operations" | "custom",
  "navigatorOrder": "['Home', 'Projects', 'Quotes']",
  "showGlobalTemplates": true,
  "hiddenNavItems": ["settings", "reports"],
  "showHomeLabel": true,
  "customDashboard": {
    "layout": [
      { "type": "stats", "position": 1 },
      { "type": "tasks", "position": 2 }
    ]
  },
  "theme": "light" | "dark" | "system",
  "notifications": {
    "push": true,
    "email": false,
    "sms": true
  },
  "defaultCalendarView": "week",
  "emailSignature": "Best regards,\n{userName}"
}
```

### 6. **Payment Tracking**
- Full payment lifecycle
- Deposit tracking with percentage/fixed options
- Payment proofs with photo upload
- Invoice generation via GHL
- Manual payment recording

### 7. **Conversation History**
- All SMS/Email threads
- Unified messaging view
- Read/unread tracking
- Message threading
- Activity feed integration

### 8. **Enhanced Quotes**
- Multi-section support
- Line items with SKUs
- Tax and discount calculations
- Deposit configuration
- Payment summary tracking
- Quote revisions with version control

---

## 📝 Implementation Checklist

When updating the frontend, ensure:

### Authentication
- [ ] Add JWT token to all requests
- [ ] Include locationId in all requests
- [ ] Handle token expiry (401 errors)
- [ ] Update user preferences via PATCH

### Data Management
- [ ] Use MongoDB data (not GHL direct)
- [ ] Handle pagination for lists
- [ ] Cache frequently used data (pipelines, calendars)
- [ ] Sync only when needed

### New Features to Add
- [ ] Notes on contact profiles
- [ ] Task management views
- [ ] Tag filtering and management
- [ ] Template selection for quotes
- [ ] Payment tracking UI
- [ ] Conversation threads view
- [ ] Custom dashboard layouts
- [ ] Quote revision workflow

### Error Handling
- [ ] Show user-friendly messages
- [ ] Log errors for debugging
- [ ] Retry failed requests
- [ ] Offline mode consideration
- [ ] Handle GHL sync failures gracefully

---

## 🔄 OAuth Migration Notes

### What Changed
1. **Backend now uses OAuth** instead of API keys
2. **Mobile app still uses JWT** - no changes needed
3. **Location tokens are managed automatically** by backend
4. **Token refresh handled automatically** in backend

### What Stays the Same
1. Mobile app authentication flow
2. All request formats
3. Response formats
4. Error handling patterns

### Backend OAuth Flow
```
1. User installs app via GHL Marketplace
2. OAuth callback stores tokens in locations.ghlOAuth
3. Backend auto-refreshes tokens as needed
4. Mobile app doesn't need OAuth tokens
```

### Location OAuth Status Check
```javascript
// In location data
{
  "hasLocationOAuth": true,
  "hasCompanyOAuth": true,
  "appInstalled": true,
  "ghlOAuth": {
    "expiresAt": "2024-01-01T00:00:00Z",
    "userType": "Location"
  }
}
```

---

## 🚨 Common Issues & Solutions

### "No authentication method available"
- Location needs OAuth installation
- Check `locations.ghlOAuth` exists
- Run setup-location endpoint

### "Invalid or expired token"
- JWT expired (7 days)
- User needs to login again
- Not related to OAuth tokens

### "Missing locationId"
- Always include in requests
- Get from user object after login

### "Contact not found"
- May need to sync from GHL
- Check MongoDB first
- Use sync endpoints if needed

### "GHL sync failed"
- Check OAuth token validity
- May need to reinstall app
- Check GHL API status

### Rate Limiting
- GHL has rate limits
- Backend handles retries
- Consider caching data
- Use batch operations

### PDF Generation Issues
- Currently limited to 1 page
- Large quotes may be cut off
- Fix in progress

---

## 📊 HTTP Status Codes

- `200` - Success (GET, PATCH, PUT)
- `201` - Created (POST)
- `204` - No Content (DELETE)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing JWT)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `405` - Method Not Allowed
- `409` - Conflict (duplicate resource)
- `422` - Unprocessable Entity (GHL validation errors)
- `429` - Rate Limited
- `500` - Internal Server Error

---

## 📞 Support & Questions

- Backend URL: https://lpai-backend-omega.vercel.app
- Database: MongoDB Atlas (database: lpai)
- Test Location: JMtlZzwrNOUmLpJk2eCE
- GitHub: dronequote/LPai-App
- Owner: TheSiznit (Michael)