# @lpai/types

Shared TypeScript interfaces for the LPai App ecosystem. Used by both the React Native mobile app and Next.js backend.

## Overview

This package contains all TypeScript interfaces that map to our MongoDB collections. The types are the single source of truth for data structures across all applications.

### Key Principles

1. **MongoDB is the source of truth** - All data is stored in MongoDB first
2. **Multi-tenant isolation** - Every request must include `locationId`
3. **GHL sync is secondary** - We sync TO GoHighLevel, not FROM it
4. **Types match the database** - Interface fields map directly to MongoDB documents

## All Available Interfaces

### Core Business Objects
- **Project** - Jobs/opportunities with milestones, photos, documents, timeline
- **Contact** - Customers with full profile, tags, custom fields
- **User** - System users with preferences, permissions, GHL sync status
- **Quote** - Full proposals with sections, line items, signatures, activity tracking
- **Payment** - Payment records with proof photos, GHL invoice links
- **Invoice** - Complete GHL invoices with items, taxes, payment methods

### Communication & CRM
- **Message** - All message types (email, SMS, etc.) with threading
- **Conversation** - Threaded conversations with unread counts
- **Note** - Internal notes linked to contacts/opportunities
- **EmailStat** - Detailed email tracking (delivered, opened, clicked)

### Scheduling & Tasks  
- **Appointment** - Calendar events with location types, resources, recurring
- **Calendar** - Calendar configurations with colors and permissions
- **Task** - Assignable tasks with due dates and contact details

### Configuration & Multi-tenant
- **Location** - Complete tenant setup with OAuth, settings, social, counts
- **Agency** - Parent company managing multiple locations
- **Template** - Quote templates with blocks, styling, company overrides
- **Library** - Product catalogs with categories and pricing
- **Tag** - Contact tags with colors and slugs
- **Pipeline** - CRM pipeline stages configuration

### Supporting Types
- **QuoteSection**, **QuoteLineItem** - Quote structure
- **QuoteActivity**, **QuoteEmail** - Quote tracking
- **Milestone**, **ProjectPhoto**, **ProjectDocument** - Project assets
- **UserPreferences**, **DashboardWidget** - User customization
- **TemplateBlock** types - All template content blocks
- **SignedQuoteFile**, **PaymentProofFile** - GridFS metadata

### Common ID Fields

```typescript
// Every document has these
_id: string;          // MongoDB ObjectId
locationId: string;   // REQUIRED for multi-tenancy

// GHL integration IDs
ghlContactId: string;     // GoHighLevel contact ID
ghlOpportunityId: string; // GoHighLevel opportunity ID
ghlTaskId: string;        // GoHighLevel task ID
```

### Entity Relationships

```
Location (Tenant)
  ├── Users
  ├── Contacts
  │   └── Projects (Opportunities)
  │       ├── Quotes
  │       │   └── Payments
  │       ├── Tasks
  │       └── Appointments
  └── Libraries (Product Catalogs)
```

## Common Patterns

### Always Include LocationId

```typescript
// ✅ CORRECT - Always filter by locationId
const projects = await api.get<Project[]>('/projects', {
  params: { locationId: user.locationId }
});

// ❌ WRONG - Never fetch without locationId
const projects = await api.get<Project[]>('/projects');
```

### Type Guards

```typescript
// Check if a quote is signed
function isQuoteSigned(quote: Quote): boolean {
  return !!quote.signatures?.customer?.signature;
}

// Check if a payment has proof
function hasPaymentProof(payment: Payment): boolean {
  return !!payment.proofPhotoId && payment.status === 'completed';
}

// Check if user needs re-auth
function needsReauth(user: User): boolean {
  return user.requiresReauth || !!user.reauthReason;
}
```

### Working with Dates

```typescript
// Most dates are ISO strings
const appointment: Appointment = {
  start: '2024-01-15T09:00:00Z',
  end: '2024-01-15T10:00:00Z',
  // ...
};

// Parse when needed
const startDate = new Date(appointment.start);
```

### Optional Fields

Many fields are optional (`?`) because:
- They're added by the backend after creation
- They're only present in certain states
- They're computed/denormalized fields

```typescript
interface Quote {
  // Always present
  _id: string;
  quoteNumber: string;
  
  // Optional - added after signing
  signatures?: {
    customer?: { signature: string; signedAt: string; }
    consultant?: { signature: string; signedAt: string; }
  };
  
  // Optional - added after payment
  paymentSummary?: { ... };
}
```

## File Storage (GridFS)

For large files, we use MongoDB GridFS:

```typescript
// Quote PDFs
interface SignedQuoteFile {
  _id: string;           // Use this ID to fetch the file
  filename: string;      // 'quote_123_signed_timestamp.pdf'
  metadata: { ... };     // Quote details
}

// Payment proof photos  
interface PaymentProofFile {
  _id: string;           // Use this ID to fetch the file
  filename: string;      // 'payment_123_proof_timestamp.jpg'
  metadata: { ... };     // Payment details
}
```

## Status Values

### Project Status
- `open` - Active project
- `won` - Completed successfully  
- `lost` - Cancelled/lost
- `abandoned` - No activity

### Quote Status
- `draft` - Being created
- `published` - Sent to customer
- `viewed` - Customer opened it
- `signed` - Customer signed
- `recalled` - Taken back
- `expired` - Past valid date
- `revised` - New version created
- `deposit_paid` - Deposit received

### Payment Status
- `pending` - Awaiting payment
- `completed` - Payment received

### Task Status
- `pending` - Not completed
- `completed` - Done

### Appointment Status
- `scheduled` - Upcoming
- `completed` - Finished
- `cancelled` - Cancelled
- `no_show` - Customer didn't show
- `rescheduled` - Moved to new time

### Message Direction
- `inbound` - From contact
- `outbound` - To contact

### Email Event Types
- `accepted` - Email accepted by server
- `delivered` - Email delivered to inbox
- `opened` - Email opened by recipient

## Migration Notes

### Recent Changes (June 2024)
- Added `Agency` interface (renamed from `Company`)
- Enhanced `Quote` with payment tracking
- Added `Template` system for quote generation
- Added `EmailStat` for email tracking

### Breaking Changes
None - all changes have been additive with optional fields.

## Common Gotchas

1. **User.userId vs User._id**
   - `userId` is the GHL user ID (what we usually want)
   - `_id` is the MongoDB document ID

2. **Dates are strings**
   - All dates are ISO strings, not Date objects
   - Parse with `new Date()` when needed

3. **GHL fields may be null**
   - Even "required" GHL fields might be null during sync
   - Always use optional chaining: `project?.ghlOpportunityId`

4. **Arrays default to empty**
   - `tags: []` not `tags: undefined`
   - `milestones: []` not `milestones: undefined`

## Need Help?

- Check the [main README](../../README.md) for setup instructions
- See backend [API docs](../../lpai-backend/docs/API.md)
- Ask in the team chat

## Contributing

When adding new types:
1. Match the MongoDB collection structure exactly
2. Use optional (`?`) for fields that might not exist
3. Add JSDoc comments for unclear fields
4. Update this README if adding new patterns