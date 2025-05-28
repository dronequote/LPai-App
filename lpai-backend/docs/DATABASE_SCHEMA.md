# MongoDB Database Schema

Database Name: `lpai`

## Overview

The LPai database uses MongoDB with a multi-tenant architecture where all data is isolated by `locationId`. This document describes all collections, their schemas, relationships, and indexing strategies.

## Collections

```
lpai/
├── contacts              # Customer/lead records
├── projects              # Jobs/opportunities
├── quotes                # Quote documents with pricing and signatures
├── appointments          # Calendar events
├── users                 # System users (consultants/employees)
├── locations             # Tenant companies with settings
├── libraries             # Product catalogs per location
├── templates             # Quote and document templates
├── emailTemplates        # Email templates (global and custom)
├── payments              # Payment records (planned)
├── invoices              # Invoice records (planned)
└── signed_quotes.files/  # GridFS for PDF storage
    └── signed_quotes.chunks
```

## Collection Schemas

### 📇 contacts

Stores customer and lead information. Syncs with GHL contacts.

```javascript
{
  _id: ObjectId,
  
  // Basic Info
  firstName: String,                    // Required
  lastName: String,                     // Required
  email: String,                        // Required, unique per location
  phone: String,                        // E.164 format preferred
  address: String,
  
  // Multi-tenant
  locationId: String,                   // Required, references locations
  
  // Notes & Custom Data
  notes: String,
  tags: [String],
  source: String,                       // "Website", "Referral", etc.
  
  // GHL Integration
  ghlContactId: String,                 // GHL contact ID for sync
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.contacts.createIndex({ locationId: 1, email: 1 }, { unique: true })
db.contacts.createIndex({ locationId: 1, createdAt: -1 })
db.contacts.createIndex({ ghlContactId: 1 })
db.contacts.createIndex({ locationId: 1, "$**": "text" }) // Full-text search
```

### 🔨 projects

Represents jobs/opportunities. One contact can have multiple projects.

```javascript
{
  _id: ObjectId,
  
  // Basic Info
  title: String,                        // Required, e.g., "Kitchen Remodel"
  status: String,                       // "open", "won", "lost", "abandoned", "Deleted"
  
  // Relationships
  contactId: String,                    // Required, references contacts._id
  locationId: String,                   // Required, references locations
  userId: String,                       // Assigned consultant/user
  quoteId: String,                      // References quotes._id (if quote exists)
  
  // Pipeline Management
  pipelineId: String,                   // GHL pipeline ID
  pipelineStageId: String,              // Current stage in pipeline
  
  // Project Details
  scopeOfWork: String,                  // Detailed work description
  products: [String],                   // Product/service list
  monetaryValue: Number,                // Estimated or actual value
  
  // Enhanced Features
  milestones: [{
    id: String,
    title: String,
    completed: Boolean,
    completedAt: Date,
    createdAt: Date
  }],
  
  photos: [{
    id: String,
    url: String,
    caption: String,
    uploadedAt: Date,
    uploadedBy: String                  // userId
  }],
  
  documents: [{
    id: String,
    name: String,
    type: String,                       // "contract", "invoice", "permit", etc.
    url: String,
    fileId: ObjectId,                   // GridFS reference
    uploadedAt: Date,
    uploadedBy: String
  }],
  
  timeline: [{
    id: String,
    event: String,                      // "Created", "Status Changed", etc.
    description: String,
    timestamp: Date,
    userId: String
  }],
  
  customFields: Object,                 // Flexible storage for custom data
  
  // GHL Integration
  ghlOpportunityId: String,             // GHL opportunity ID
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date,                      // Soft delete timestamp
  signedDate: String                    // When contract was signed
}

// Indexes
db.projects.createIndex({ locationId: 1, contactId: 1 })
db.projects.createIndex({ locationId: 1, status: 1 })
db.projects.createIndex({ locationId: 1, userId: 1 })
db.projects.createIndex({ locationId: 1, createdAt: -1 })
db.projects.createIndex({ ghlOpportunityId: 1 })
```

### 📄 quotes

Stores quote/proposal documents with line items, signatures, and PDF generation tracking.

```javascript
{
  _id: ObjectId,
  
  // Identification
  quoteNumber: String,                  // Auto-generated, e.g., "Q-2025-001"
  version: Number,                      // 1, 2, 3 for revisions
  parentQuoteId: String,                // For revisions, references parent quote
  
  // Relationships
  projectId: String,                    // Required, references projects._id
  contactId: String,                    // Required, references contacts._id
  locationId: String,                   // Required, references locations
  userId: String,                       // Created by user
  
  // Quote Content
  title: String,                        // Required
  description: String,
  
  sections: [{
    id: String,
    name: String,                       // "Materials", "Labor", etc.
    lineItems: [{
      id: String,
      libraryItemId: String,            // Reference to library item
      categoryId: String,
      name: String,
      description: String,
      quantity: Number,
      unitPrice: Number,
      totalPrice: Number,
      unit: String,                     // "each", "hours", "sqft"
      sku: String,
      isCustomItem: Boolean
    }],
    subtotal: Number,
    isCollapsed: Boolean
  }],
  
  // Pricing
  subtotal: Number,                     // Sum of all line items
  taxRate: Number,                      // 0.08 for 8%
  taxAmount: Number,
  discountAmount: Number,
  discountPercentage: Number,
  total: Number,                        // Final amount
  
  // Status & Publishing
  status: String,                       // "draft", "published", "viewed", "signed", "superseded"
  publishedAt: Date,
  publishedBy: String,                  // userId
  viewedAt: Date,
  lastViewedAt: Date,
  
  // Web Link (for remote viewing/signing)
  webLinkToken: String,                 // Secure random token
  webLinkExpiry: Date,
  
  // Signatures
  signatures: {
    consultant: {
      signature: String,                // Base64 image data
      signedAt: Date,
      signedBy: String,                 // userId
      deviceInfo: String                // "iPad App", "Web Browser", etc.
    },
    customer: {
      signature: String,                // Base64 image data
      signedAt: Date,
      signedBy: String,                 // Customer name
      deviceInfo: String
    }
  },
  
  // PDF Generation
  signedPdfFileId: ObjectId,            // GridFS file reference
  signedPdfUrl: String,                 // API endpoint for retrieval
  pdfGeneratedAt: Date,
  
  // Terms & Settings
  termsAndConditions: String,
  paymentTerms: String,
  notes: String,
  validUntil: Date,
  
  // Activity Tracking
  activityFeed: [{
    id: String,
    action: String,                     // "created", "published", "viewed", "consultant_signed", etc.
    timestamp: Date,
    userId: String,
    metadata: Object                    // Action-specific data
  }],
  
  // Timestamps
  createdAt: String,                    // ISO date string
  updatedAt: String,
  signedAt: String,                     // When fully signed
  respondedAt: String                   // When customer took action
}

// Indexes
db.quotes.createIndex({ locationId: 1, projectId: 1 })
db.quotes.createIndex({ locationId: 1, contactId: 1 })
db.quotes.createIndex({ locationId: 1, status: 1 })
db.quotes.createIndex({ webLinkToken: 1 })
db.quotes.createIndex({ quoteNumber: 1 }, { unique: true })
```

### 📅 appointments

Calendar events linked to contacts and projects. Syncs with GHL calendars.

```javascript
{
  _id: ObjectId,
  
  // Basic Info
  title: String,                        // Required
  notes: String,
  
  // Relationships
  contactId: String,                    // Required, references contacts._id
  userId: String,                       // Required, assigned user
  locationId: String,                   // Required, references locations
  projectId: String,                    // Optional, references projects._id
  
  // Schedule
  start: Date,                          // Required, ISO datetime
  end: Date,                            // Required, ISO datetime
  duration: Number,                     // Minutes
  calendarId: String,                   // GHL calendar ID
  
  // Location Details
  locationType: String,                 // "address", "custom", "phone", "googlemeet", "zoom"
  customLocation: String,               // Used when locationType is "custom"
  address: String,                      // Resolved address for the appointment
  
  // Status
  status: String,                       // "scheduled", "completed", "cancelled", "no-show"
  
  // GHL Integration
  ghlAppointmentId: String,             // GHL event ID
  ghlPayload: Object,                   // Last payload sent to GHL
  ghlResponse: Object,                  // Last response from GHL
  
  // Metadata
  meetingLocationType: String,
  meetingLocationId: String,
  appointmentStatus: String,
  assignedUserId: String,               // GHL user ID
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  cancelledAt: Date
}

// Indexes
db.appointments.createIndex({ locationId: 1, start: 1 })
db.appointments.createIndex({ locationId: 1, userId: 1 })
db.appointments.createIndex({ locationId: 1, contactId: 1 })
db.appointments.createIndex({ ghlAppointmentId: 1 })
```

### 👤 users

System users (employees/consultants) who can log into the app.

```javascript
{
  _id: ObjectId,
  
  // Authentication
  email: String,                        // Required, unique
  hashedPassword: String,               // bcrypt hashed
  
  // Profile
  name: String,                         // Display name
  firstName: String,
  lastName: String,
  phone: String,
  avatar: String,                       // URL or base64
  
  // Multi-tenant
  locationId: String,                   // Required, references locations
  
  // Permissions
  role: String,                         // "admin", "user", "viewer"
  permissions: [String],                // Granular permissions
  
  // GHL Integration
  ghlUserId: String,                    // GHL user ID for API calls
  
  // Preferences
  preferences: {
    notifications: Boolean,
    defaultCalendarView: String,        // "day", "week", "month"
    defaultPipeline: String,
    emailSignature: String,
    // ... other user-specific settings
  },
  
  // Status
  isActive: Boolean,
  lastLoginAt: Date,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}

// Indexes
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ locationId: 1 })
db.users.createIndex({ ghlUserId: 1 })
```

### 🏢 locations

Tenant companies with their settings, branding, and GHL configuration.

```javascript
{
  _id: ObjectId,
  
  // Identification
  locationId: String,                   // Required, unique, from GHL
  name: String,                         // Company name
  
  // GHL Integration
  apiKey: String,                       // GHL API key (encrypted in production)
  ghlAccountId: String,
  
  // Company Info
  branding: {
    logo: String,                       // URL or base64
    primaryColor: String,               // Hex color
    secondaryColor: String,
    phone: String,
    email: String,
    website: String,
    address: String,
    establishedYear: String,
    warrantyYears: String
  },
  
  // Synced from GHL
  pipelines: [{
    id: String,
    name: String,
    stages: [{
      id: String,
      name: String,
      position: Number
    }]
  }],
  
  calendars: [{
    id: String,
    calendarId: String,
    name: String,
    description: String,
    isActive: Boolean,
    icon: String                        // Icon name for UI
  }],
  
  // Custom Field Mappings (GHL)
  ghlCustomFields: {
    project_title: String,              // GHL custom field ID
    quote_number: String,               // GHL custom field ID
    signed_date: String,                // GHL custom field ID
    // ... other mappings
  },
  
  // Settings
  termsAndConditions: String,           // Default T&C with {companyName} variables
  
  emailTemplates: {
    contractSigned: String,             // emailTemplates._id or null
    quoteSent: String,
    invoiceSent: String,
    appointmentReminder: String
  },
  
  // Feature Flags
  features: {
    paymentsEnabled: Boolean,
    invoicingEnabled: Boolean,
    webQuotesEnabled: Boolean,
    smsEnabled: Boolean
  },
  
  // Subscription/Billing
  subscription: {
    plan: String,                       // "starter", "pro", "enterprise"
    status: String,                     // "active", "trial", "suspended"
    trialEndsAt: Date,
    seats: Number,
    billingEmail: String
  },
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  pipelinesUpdatedAt: Date,
  calendarsUpdatedAt: Date
}

// Indexes
db.locations.createIndex({ locationId: 1 }, { unique: true })
db.locations.createIndex({ ghlAccountId: 1 })
```

### 📚 libraries

Product/service catalogs for creating quotes. Each location can have multiple libraries.

```javascript
{
  _id: ObjectId,
  
  // Identification
  locationId: String,                   // Required, references locations
  name: String,                         // "Main Catalog", "Premium Options", etc.
  
  // Categories with Items
  categories: [{
    id: String,
    name: String,                       // "Fixtures", "Labor", "Materials"
    description: String,
    icon: String,                       // Icon name for UI
    sortOrder: Number,
    isActive: Boolean,
    
    items: [{
      id: String,
      name: String,                     // "Premium Faucet"
      description: String,
      basePrice: Number,                // Cost before markup
      markup: Number,                   // 1.5 = 50% markup
      unit: String,                     // "each", "hour", "sqft"
      sku: String,
      
      // Optional fields
      imageUrl: String,
      vendor: String,
      leadTime: String,                 // "2-3 weeks"
      notes: String,
      
      // Tracking
      isActive: Boolean,
      lastUsed: Date,
      usageCount: Number,
      
      // Timestamps
      createdAt: String,
      updatedAt: String
    }],
    
    // Timestamps
    createdAt: String,
    updatedAt: String
  }],
  
  // Settings
  isDefault: Boolean,                   // Primary library for location
  isShared: Boolean,                    // Available to all users
  
  // Metadata
  createdBy: String,                    // userId
  createdAt: String,
  updatedAt: String
}

// Indexes
db.libraries.createIndex({ locationId: 1 })
db.libraries.createIndex({ locationId: 1, isDefault: 1 })
```

### 📝 templates

Quote and document templates for consistent branding and quick creation.

```javascript
{
  _id: ObjectId,
  
  // Identification
  name: String,                         // Template name
  category: String,                     // "quote", "invoice", "contract"
  
  // Ownership
  locationId: String,                   // null for global templates
  isGlobal: Boolean,                    // Available to all locations
  sourceTemplateId: String,             // If copied from global template
  
  // Template Content
  sections: [{
    id: String,
    type: String,                       // "header", "pricing", "terms", "signature"
    enabled: Boolean,
    content: Object,                    // Section-specific content
    order: Number
  }],
  
  // Styling
  styling: {
    primaryColor: String,
    secondaryColor: String,
    accentColor: String,
    font: String,
    logoPosition: String                // "left", "center", "right"
  },
  
  // Company Overrides
  companyOverrides: {
    name: String,
    logo: String,
    phone: String,
    email: String,
    address: String
  },
  
  // Variables Available
  availableVariables: [String],         // ["{customerName}", "{projectTitle}", etc.]
  
  // Settings
  isActive: Boolean,
  isDefault: Boolean,                   // Default for category
  
  // Metadata
  createdBy: String,                    // userId
  lastModified: Date,
  usageCount: Number,
  
  // Timestamps
  createdAt: String,
  updatedAt: String
}

// Indexes
db.templates.createIndex({ locationId: 1, category: 1 })
db.templates.createIndex({ isGlobal: 1, category: 1 })
```

### ✉️ emailTemplates

Email templates for automated communications.

```javascript
{
  _id: ObjectId,
  
  // Identification
  name: String,                         // "Contract Signed", "Quote Follow-up"
  locationId: String,                   // "global" for system templates
  
  // Email Content
  subject: String,                      // With {variables}
  previewText: String,
  html: String,                         // Full HTML with {variables}
  
  // Settings
  category: String,                     // "transactional", "marketing", "reminder"
  trigger: String,                      // "contract_signed", "quote_sent", etc.
  
  // Variables
  variables: [String],                  // Available variables for this template
  requiredVariables: [String],          // Must be provided
  
  // Status
  isActive: Boolean,
  isGlobal: Boolean,
  
  // Testing
  testData: Object,                     // Sample data for preview
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  lastUsed: Date
}

// Indexes
db.emailTemplates.createIndex({ locationId: 1, name: 1 })
db.emailTemplates.createIndex({ locationId: 1, trigger: 1 })
```

### 💰 payments (Planned)

Payment records for quotes and invoices.

```javascript
{
  _id: ObjectId,
  
  // Relationships
  quoteId: ObjectId,
  projectId: ObjectId,
  contactId: ObjectId,
  locationId: String,
  invoiceId: ObjectId,                  // If payment for invoice
  
  // Payment Details
  amount: Number,
  type: String,                         // "deposit", "progress", "final"
  method: String,                       // "card", "check", "cash", "ach"
  
  // Status
  status: String,                       // "pending", "completed", "failed", "refunded"
  
  // Manual Payments
  checkNumber: String,
  proofPhotoUrl: String,                // GridFS reference for check/cash
  verifiedBy: ObjectId,                 // userId who verified
  verifiedAt: Date,
  notes: String,
  
  // Online Payments
  ghlPaymentId: String,
  stripePaymentId: String,
  last4: String,                        // Last 4 of card
  cardBrand: String,
  
  // Timestamps
  createdAt: Date,
  completedAt: Date,
  refundedAt: Date
}
```

### 📃 invoices (Planned)

Invoice records for billing.

```javascript
{
  _id: ObjectId,
  
  // Identification
  invoiceNumber: String,                // "INV-2025-001"
  
  // Relationships
  quoteId: ObjectId,
  projectId: ObjectId,
  contactId: ObjectId,
  locationId: String,
  
  // Line Items
  lineItems: [{
    description: String,
    amount: Number,
    taxable: Boolean,
    category: String
  }],
  
  // Totals
  subtotal: Number,
  taxAmount: Number,
  total: Number,
  amountPaid: Number,
  balance: Number,
  
  // Status
  status: String,                       // "draft", "sent", "viewed", "paid", "overdue"
  
  // Dates
  issueDate: Date,
  dueDate: Date,
  paidDate: Date,
  sentAt: Date,
  viewedAt: Date,
  
  // PDF
  pdfFileId: ObjectId,                  // GridFS reference
  
  // GHL Integration
  ghlInvoiceId: String,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

## GridFS Collections

### 📎 signed_quotes

Stores PDF files and other large documents.

```javascript
// signed_quotes.files
{
  _id: ObjectId,
  length: Number,                       // File size in bytes
  chunkSize: Number,
  uploadDate: Date,
  filename: String,                     // "quote_Q-2025-001_signed_1234567890.pdf"
  contentType: String,                  // "application/pdf"
  
  metadata: {
    quoteId: String,
    quoteNumber: String,
    customerName: String,
    locationId: String,
    hasSignatures: Boolean,
    generatedAt: String,
    type: String                        // "signed_quote", "invoice", "photo", etc.
  }
}

// signed_quotes.chunks
{
  _id: ObjectId,
  files_id: ObjectId,                   // References signed_quotes.files._id
  n: Number,                            // Chunk sequence number
  data: BinData                         // Binary chunk data
}
```

## Relationships

### Primary Relationships

```
locations
    ↓ (1:many)
    ├── users (locationId)
    ├── contacts (locationId)
    ├── projects (locationId)
    ├── quotes (locationId)
    ├── appointments (locationId)
    ├── libraries (locationId)
    └── templates (locationId)

contacts
    ↓ (1:many)
    ├── projects (contactId)
    ├── quotes (contactId)
    └── appointments (contactId)

projects
    ↓ (1:many)
    └── quotes (projectId)
    
quotes
    ↓ (1:1)
    └── signed PDF in GridFS
```

### Cross-References

- `projects.quoteId` → `quotes._id` (active quote)
- `quotes.parentQuoteId` → `quotes._id` (revisions)
- `libraries.items.libraryItemId` → `quotes.lineItems`
- `locations.emailTemplates.*` → `emailTemplates._id`
- `templates.sourceTemplateId` → `templates._id` (global)

## Indexing Strategy

### Performance Indexes

1. **Multi-tenant Isolation**: Every collection has `locationId` as the first field in compound indexes
2. **Time-based Queries**: Collections with listings have `createdAt: -1` indexes
3. **Relationship Lookups**: Foreign key fields are indexed
4. **GHL Sync**: All `ghl*Id` fields are indexed for quick lookups
5. **Full-text Search**: Contacts have text indexes for search functionality

### Recommended Additional Indexes

```javascript
// For quote search
db.quotes.createIndex({ 
  locationId: 1, 
  quoteNumber: "text", 
  "sections.lineItems.name": "text" 
})

// For project dashboard
db.projects.createIndex({ 
  locationId: 1, 
  status: 1, 
  monetaryValue: -1 
})

// For appointment calendar
db.appointments.createIndex({ 
  locationId: 1, 
  userId: 1, 
  start: 1, 
  end: 1 
})
```

## Data Migration Notes

### From GHL to MongoDB

1. **Contacts**: Map GHL fields, preserve `ghlContactId`
2. **Opportunities**: Become projects, map status values
3. **Pipelines**: Stored on location, refreshed periodically
4. **Calendars**: Stored on location, appointments sync individually
5. **Custom Fields**: Stored in `customFields` object

### MongoDB-Only Fields

These fields exist only in MongoDB, not synced to GHL:
- Enhanced project fields (milestones, photos, documents)
- Quote details and signatures
- Libraries and templates
- User preferences
- Activity feeds and timelines

## Best Practices

1. **Always filter by locationId** for multi-tenant security
2. **Use ObjectId for relationships** within MongoDB
3. **Store GHL IDs separately** for sync operations
4. **Implement soft deletes** for important records
5. **Version documents** that might need revision history
6. **Index before scaling** - add indexes based on query patterns
7. **Denormalize carefully** - balance between performance and consistency

## Backup Strategy

1. **Daily backups** of entire database
2. **Point-in-time recovery** enabled
3. **Separate GridFS backups** for large files
4. **Test restores** monthly
5. **Export critical data** to S3 for long-term storage