# LPai Types - Complete Field Reference

Comprehensive reference of all available fields in the LPai type system. Fields marked with `?` are optional.

## Table of Contents
- [Core Entities](#core-entities)
  - [Project](#project)
  - [Contact](#contact)
  - [User](#user)
- [Financial](#financial)
  - [Quote](#quote)
  - [Payment](#payment)
  - [Invoice](#invoice)
- [Communication](#communication)
  - [Message](#message)
  - [Conversation](#conversation)
  - [Note](#note)
  - [EmailStat](#emailstat)
- [Scheduling & Tasks](#scheduling--tasks)
  - [Appointment](#appointment)
  - [Calendar](#calendar)
  - [Task](#task)
- [Configuration](#configuration)
  - [Location](#location)
  - [Agency](#agency)
  - [Template](#template)
  - [Library](#library)
  - [Tag](#tag)
- [Supporting Types](#supporting-types)

---

## Core Entities

### Project

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| title | string | No | Project name/title |
| status | string | No | Current status (open/won/lost/abandoned) |
| createdAt | string | No | ISO date created |
| contactId | string | No | Reference to Contact._id |
| userId | string | Yes | Assigned user ID |
| locationId | string | No | Tenant isolation ID |
| notes | string | Yes | Internal notes |
| quoteId | string | Yes | Associated Quote._id |
| ghlOpportunityId | string | Yes | GoHighLevel opportunity ID |
| milestones | Milestone[] | Yes | Array of project milestones |
| photos | ProjectPhoto[] | Yes | Array of project photos |
| documents | ProjectDocument[] | Yes | Array of uploaded documents |
| timeline | ProjectTimelineEntry[] | Yes | Array of timeline events |
| customFields | object | Yes | Custom field values |
| contact | Contact | Yes | Populated contact object |
| contactName | string | Yes | Denormalized contact name |
| otherProjects | Project[] | Yes | Other projects for same contact |
| upcomingAppointments | Appointment[] | Yes | Related appointments |
| completedMilestones | number | Yes | Count of completed milestones |
| totalMilestones | number | Yes | Total milestone count |
| progressPercentage | number | Yes | Calculated progress % |
| updatedAt | string | Yes | Last update timestamp |
| scopeOfWork | string | Yes | Work description |
| products | string | Yes | Products/services |
| pipelineId | string | Yes | CRM pipeline ID |
| pipelineName | string | Yes | Pipeline display name |
| pipelineStageId | string | Yes | Current stage ID |
| monetaryValue | number | Yes | Deal value |
| quoteNumber | string | Yes | Associated quote number |
| signedDate | string | Yes | Contract signed date |
| contactEmail | string | Yes | Denormalized email |
| contactPhone | string | Yes | Denormalized phone |
| ghlCreatedAt | string | Yes | GHL creation date |
| ghlUpdatedAt | string | Yes | GHL update date |
| lastSyncedAt | string | Yes | Last sync timestamp |
| createdBySync | boolean | Yes | Created via sync |

### Contact

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| firstName | string | No | First name |
| lastName | string | No | Last name |
| email | string | No | Primary email |
| phone | string | No | Primary phone |
| address | string | Yes | Street address |
| notes | string | Yes | Internal notes |
| status | string | No | Contact status |
| locationId | string | No | Tenant isolation ID |
| ghlContactId | string | No | GoHighLevel contact ID |
| projects | Project[] | Yes | Associated projects |
| fullName | string | Yes | Combined full name |
| secondaryPhone | string | Yes | Alternative phone |
| city | string | Yes | City |
| state | string | Yes | State/Province |
| country | string | Yes | Country |
| postalCode | string | Yes | ZIP/Postal code |
| companyName | string | Yes | Company name |
| website | string | Yes | Website URL |
| dateOfBirth | string \| null | Yes | Birth date |
| dnd | boolean | Yes | Do not disturb flag |
| dndSettings | any | Yes | DND configuration |
| tags | string[] | Yes | Array of tag names |
| source | string | Yes | Lead source |
| type | string | Yes | Contact type (e.g., 'lead') |
| assignedTo | string \| null | Yes | Assigned user ID |
| customFields | any[] | Yes | Custom field values |
| additionalEmails | string[] | Yes | Other email addresses |
| attributions | Attribution[] | Yes | UTM/source tracking |
| ghlCreatedAt | string | Yes | GHL creation date |
| ghlUpdatedAt | string | Yes | GHL update date |
| lastSyncedAt | string | Yes | Last sync timestamp |
| updatedAt | string | Yes | Update timestamp |
| createdAt | string | Yes | Creation timestamp |
| createdBySync | boolean | Yes | Created via sync |

### User

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | Yes | MongoDB ObjectId |
| userId | string | No | GHL user ID (primary key) |
| name | string | No | Display name |
| email | string | No | Email address |
| role | string | No | User role |
| locationId | string | No | Tenant isolation ID |
| permissions | string[] | No | Array of permissions |
| preferences | UserPreferences | Yes | User preferences object |
| hashedPassword | string | Yes | Password hash (backend only) |
| apiKey | string | Yes | API access key |
| updatedAt | string | Yes | Update timestamp |
| avatar | string | Yes | Avatar URL |
| dateAdded | string \| null | Yes | Addition date |
| extension | string | Yes | Phone extension |
| firstName | string | Yes | First name |
| isActive | boolean | Yes | Active status |
| lastLogin | string \| null | Yes | Last login timestamp |
| lastName | string | Yes | Last name |
| lastSyncedAt | string | Yes | Last sync timestamp |
| phone | string | Yes | Phone number |
| roles | UserRoles | Yes | Role configuration |
| reauthReason | string | Yes | Re-auth reason |
| requiresReauth | boolean | Yes | Re-auth required flag |
| needsPasswordReset | boolean | Yes | Password reset flag |
| createdAt | string | Yes | Creation timestamp |
| createdBySync | boolean | Yes | Created via sync |
| createdByWebhook | string | Yes | Webhook ID |
| processedBy | string | Yes | Processor ID |
| webhookId | string | Yes | Webhook ID |
| lastWebhookUpdate | string | Yes | Last webhook update |

---

## Financial

### Quote

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| quoteNumber | string | No | Auto-generated quote number |
| projectId | string | No | Associated Project._id |
| contactId | string | No | Associated Contact._id |
| locationId | string | No | Tenant isolation ID |
| userId | string | No | Creator user ID |
| title | string | No | Quote title |
| description | string | Yes | Quote description |
| sections | QuoteSection[] | No | Array of quote sections |
| subtotal | number | No | Pre-tax subtotal |
| taxRate | number | No | Tax rate (0.08 = 8%) |
| taxAmount | number | No | Calculated tax amount |
| discountAmount | number | Yes | Discount in dollars |
| discountPercentage | number | Yes | Discount percentage |
| total | number | No | Final total |
| status | string | No | Quote status |
| version | number | No | Version number |
| parentQuoteId | string | Yes | Parent quote if revision |
| publishedAt | string | Yes | Publication timestamp |
| publishedBy | string | Yes | Publisher user ID |
| viewedAt | string | Yes | First view timestamp |
| lastViewedAt | string | Yes | Last view timestamp |
| webLinkToken | string | Yes | Public link token |
| webLinkExpiry | string | Yes | Link expiration date |
| signatures | QuoteSignatures | Yes | Digital signatures |
| depositType | string | Yes | Deposit type |
| depositValue | number | Yes | Deposit percentage/amount |
| depositAmount | number | Yes | Calculated deposit |
| paymentSummary | PaymentSummary | Yes | Payment tracking |
| signedPdfUrl | string | Yes | Signed PDF URL |
| originalPdfUrl | string | Yes | Unsigned PDF URL |
| pdfGeneratedAt | string | Yes | PDF generation date |
| signedPdfFileId | string | Yes | GridFS file ID |
| activityFeed | QuoteActivity[] | Yes | Activity history |
| emailsSent | QuoteEmail[] | Yes | Email history |
| validUntil | string | Yes | Expiration date |
| termsAndConditions | string | Yes | Terms text |
| paymentTerms | string | Yes | Payment terms |
| notes | string | Yes | Internal notes |
| sentAt | string | Yes | Legacy sent date |
| respondedAt | string | Yes | Legacy response date |
| signatureImageUrl | string | Yes | Legacy signature URL |
| signedAt | string | Yes | Legacy signed date |
| signedBy | string | Yes | Legacy signer |
| ghlOpportunityId | string | Yes | GHL opportunity ID |
| ghlWorkflowTriggered | boolean | Yes | Workflow trigger flag |
| createdAt | string | No | Creation timestamp |
| updatedAt | string | No | Update timestamp |
| contact | Contact | Yes | Populated contact |
| project | Project | Yes | Populated project |
| contactName | string | Yes | Denormalized name |
| projectTitle | string | Yes | Denormalized title |

### Payment

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| projectId | string | No | Associated Project._id |
| quoteId | string | No | Associated Quote._id |
| contactId | string | No | Associated Contact._id |
| locationId | string | No | Tenant isolation ID |
| amount | number | No | Payment amount |
| type | string | No | Payment type (e.g., 'deposit') |
| method | string | No | Payment method |
| description | string | No | Payment description |
| status | string | No | Payment status |
| ghlInvoiceId | string | Yes | GHL invoice ID |
| ghlInvoiceNumber | string | Yes | GHL invoice number |
| ghlInvoiceUrl | string | Yes | GHL invoice URL |
| createdAt | string | No | Creation timestamp |
| createdBy | string | No | Creator user ID |
| proofPhotoId | string | Yes | Proof photo GridFS ID |
| proofPhotoUrl | string | Yes | Proof photo URL |
| proofUploadedAt | string | Yes | Proof upload date |
| checkNumber | string | Yes | Check number |
| completedAt | string | Yes | Completion timestamp |
| ghlPaymentId | string \| null | Yes | GHL payment ID |
| paymentMethod | string | Yes | Specific method |
| updatedAt | string | Yes | Update timestamp |

### Invoice

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| ghlInvoiceId | string | No | GHL invoice ID |
| locationId | string | No | Tenant isolation ID |
| companyId | string | No | Company ID |
| invoiceNumber | string | No | Invoice number |
| name | string | No | Invoice name |
| title | string | No | Invoice title |
| status | string | No | Invoice status |
| liveMode | boolean | No | Production mode flag |
| contactId | string | No | Associated Contact._id |
| contactDetails | ContactDetails | No | Contact info snapshot |
| businessDetails | BusinessDetails | No | Business info |
| issueDate | string | No | Issue date |
| dueDate | string | No | Due date |
| sentAt | string | No | Sent timestamp |
| invoiceItems | InvoiceItem[] | No | Line items |
| currency | string | No | Currency code |
| currencyOptions | CurrencyOptions | No | Currency display |
| subtotal | number | No | Pre-tax subtotal |
| discount | Discount | No | Discount details |
| totalTax | number | No | Total tax amount |
| total | number | No | Invoice total |
| invoiceTotal | number | No | Total due |
| amountPaid | number | No | Amount paid |
| amountDue | number | No | Balance due |
| paymentMethods | PaymentMethods | No | Payment options |
| termsNotes | string | No | Terms and notes |
| opportunityId | string \| null | No | GHL opportunity ID |
| attachments | any[] | No | File attachments |
| sentBy | string | No | Sender user ID |
| sentTo | SentTo | No | Recipients |
| updatedBy | string | No | Last updater ID |
| automaticTaxesCalculated | boolean | No | Auto tax flag |
| ghlCreatedAt | string | No | GHL creation date |
| ghlUpdatedAt | string | No | GHL update date |
| lastSyncedAt | string | No | Last sync timestamp |
| updatedAt | string | No | Update timestamp |
| createdAt | string | No | Creation timestamp |
| createdBySync | boolean | No | Created via sync |
| tipsConfiguration | any | Yes | Tips config |
| tipsReceived | any[] | Yes | Tips array |
| externalTransactions | any[] | Yes | External payments |
| lateFeesConfiguration | any | Yes | Late fee config |
| remindersConfiguration | RemindersConfig | Yes | Reminder settings |
| opportunityDetails | any \| null | Yes | Opportunity data |
| sentFrom | any | Yes | Sender details |
| manualStatusTransitions | object | Yes | Status flags |
| lastVisitedAt | string | Yes | Last view date |
| syncDetails | any[] | Yes | Sync history |

---

## Communication

### Message

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| ghlMessageId | string | No | GHL message ID |
| conversationId | string | No | Parent conversation ID |
| ghlConversationId | string | No | GHL conversation ID |
| locationId | string | No | Tenant isolation ID |
| contactId | string | No | Associated Contact._id |
| projectId | string \| null | No | Associated Project._id |
| type | number | No | Message type code |
| messageType | string | No | Message type string |
| direction | 'inbound' \| 'outbound' | No | Message direction |
| contentType | string \| null | No | Content MIME type |
| source | string | No | Message source |
| dateAdded | string | No | Creation date |
| lastSyncedAt | string | No | Last sync timestamp |
| updatedAt | string | No | Update timestamp |
| createdAt | string | No | Creation timestamp |
| createdBySync | boolean | No | Created via sync |
| read | boolean | No | Read status |
| body | string | Yes | Message content |
| meta | any | No | Metadata object |
| emailMessageId | string | Yes | Email message ID |
| needsContentFetch | boolean | Yes | Content fetch flag |

### Conversation

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| ghlConversationId | string | No | GHL conversation ID |
| locationId | string | No | Tenant isolation ID |
| contactId | string | No | Associated Contact._id |
| projectId | string | Yes | Associated Project._id |
| type | string | No | Conversation type |
| unreadCount | number | No | Unread message count |
| inbox | boolean | No | In inbox flag |
| starred | boolean | No | Starred flag |
| lastMessageDate | string | No | Last message date |
| lastMessageBody | string | No | Last message preview |
| lastMessageType | string | No | Last message type |
| lastMessageDirection | string | No | Last message direction |
| contactName | string | No | Contact display name |
| contactEmail | string | No | Contact email |
| contactPhone | string | No | Contact phone |
| dateAdded | string | No | Creation date |
| dateUpdated | string | No | Update date |
| attributed | boolean | No | Attribution flag |
| scoring | any[] | No | Scoring data |
| followers | string[] | No | Following user IDs |
| tags | string[] | No | Conversation tags |
| lastSyncedAt | string | No | Last sync timestamp |
| updatedAt | string | No | Update timestamp |
| createdAt | string | No | Creation timestamp |
| createdBySync | boolean | No | Created via sync |

### Note

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| ghlNoteId | string | No | GHL note ID |
| locationId | string | No | Tenant isolation ID |
| contactId | string | No | Associated Contact._id |
| opportunityId | string \| null | Yes | Associated opportunity |
| body | string | No | Note content |
| createdBy | string | No | Creator user ID |
| createdAt | string | No | Creation timestamp |
| createdByWebhook | string | Yes | Webhook ID |
| processedBy | string | Yes | Processor ID |

### EmailStat

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| webhookId | string | No | Webhook ID |
| locationId | string | No | Tenant isolation ID |
| emailId | string | No | Email ID |
| event | string | No | Event type |
| timestamp | string | No | Event timestamp |
| recipient | string | No | Recipient email |
| recipientDomain | string \| null | No | Email domain |
| primaryDomain | string \| null | No | Primary domain |
| tags | string[] | No | Email tags |
| recipientProvider | string \| null | No | Email provider |
| campaigns | any[] | No | Campaign data |
| deliveryStatus | any \| null | No | Delivery details |
| envelope | any \| null | No | Envelope data |
| lcOperations | LcOperations | No | GHL operations data |
| logLevel | string \| null | No | Log level |
| metadata | EmailMetadata | No | Webhook metadata |
| processedAt | string | No | Processing timestamp |
| processedBy | string | No | Processor ID |

---

## Scheduling & Tasks

### Appointment

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| ghlAppointmentId | string | No | GHL appointment ID |
| ghlEventId | string | No | GHL event ID |
| locationId | string | No | Tenant isolation ID |
| title | string | No | Appointment title |
| notes | string | No | Appointment notes |
| contactId | string | No | Associated Contact._id |
| userId | string \| null | No | Assigned user ID |
| calendarId | string | No | Calendar ID |
| groupId | string | No | Calendar group ID |
| projectId | string | Yes | Associated Project._id |
| quoteId | string | Yes | Associated Quote._id |
| start | string | No | Start ISO datetime |
| end | string | No | End ISO datetime |
| duration | number | No | Duration in minutes |
| timezone | string | No | Timezone |
| locationType | string | No | Location type |
| customLocation | string | No | Custom location text |
| address | string | No | Physical address |
| meetingUrl | string | Yes | Virtual meeting URL |
| status | string | No | Appointment status |
| appointmentStatus | string | No | Confirmation status |
| contactName | string | No | Contact name |
| contactEmail | string | No | Contact email |
| contactPhone | string | No | Contact phone |
| calendarName | string | No | Calendar name |
| calendarColor | string | Yes | Calendar color |
| calendarIcon | string | Yes | Calendar icon |
| assignedUserId | string \| null | No | Primary assignee |
| assignedResources | any[] | No | Additional resources |
| isRecurring | boolean | No | Recurring flag |
| recurringDetails | any | Yes | Recurrence config |
| recurringId | string | Yes | Parent recurring ID |
| createdBy | CreatedBy | No | Creation details |
| reminders | any[] | Yes | Reminder settings |
| followUpAppointmentId | string | Yes | Follow-up ID |
| previousAppointmentId | string | Yes | Previous ID |
| ghlCreatedAt | string | No | GHL creation date |
| ghlUpdatedAt | string | No | GHL update date |
| lastSyncedAt | string | No | Last sync timestamp |
| updatedAt | string | No | Update timestamp |
| createdAt | string | No | Creation timestamp |
| createdBySync | boolean | No | Created via sync |
| tags | string[] | Yes | Appointment tags |
| customFields | object | Yes | Custom fields |
| metadata | any | Yes | Additional metadata |
| time | string | Yes | Legacy time field |

### Calendar

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| id | string | No | Calendar ID |
| calendarId | string | Yes | Alternative ID |
| name | string | No | Calendar name |
| color | string | Yes | Calendar color |
| eventColor | string | Yes | Event color |
| icon | string | Yes | Calendar icon |

### Task

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| ghlTaskId | string | No | GHL task ID |
| locationId | string | No | Tenant isolation ID |
| title | string | No | Task title |
| description | string | Yes | Task description |
| contactId | string | No | Associated Contact._id |
| contactDetails | ContactDetails | Yes | Contact info |
| assignedTo | string \| null | Yes | Assigned user ID |
| assignedToUserDetails | UserDetails | Yes | Assignee info |
| status | 'pending' \| 'completed' | No | Task status |
| completed | boolean | No | Completion flag |
| dueDate | string | No | Due date |
| completedAt | string \| null | Yes | Completion date |
| deleted | boolean | No | Deletion flag |
| ghlCreatedAt | string | No | GHL creation date |
| ghlUpdatedAt | string | No | GHL update date |
| dateAdded | string | No | Addition date |
| dateUpdated | string | No | Update date |
| lastSyncedAt | string | No | Last sync timestamp |
| updatedAt | string | No | Update timestamp |
| createdAt | string | No | Creation timestamp |
| createdBySync | boolean | Yes | Created via sync |

---

## Configuration

### Location

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| locationId | string | No | GHL location ID |
| companyId | string | No | Parent company ID |
| appInstalled | boolean | No | App installed flag |
| installType | string | No | Installation type |
| installWebhookId | string | No | Install webhook ID |
| installedAt | string | Yes | Installation date |
| installedBy | string | Yes | Installer user ID |
| uninstalled | boolean | Yes | Uninstalled flag |
| uninstalledAt | string | Yes | Uninstall date |
| uninstalledBy | string \| null | Yes | Uninstaller ID |
| uninstallReason | string | Yes | Uninstall reason |
| uninstallWebhookId | string | Yes | Uninstall webhook |
| name | string | No | Location name |
| email | string | No | Location email |
| phone | string | No | Location phone |
| website | string \| null | No | Website URL |
| address | string | No | Street address |
| city | string | No | City |
| state | string | No | State/Province |
| country | string | No | Country |
| postalCode | string | No | ZIP/Postal code |
| timezone | string | No | Timezone |
| planId | string | No | Subscription plan |
| business | BusinessInfo | No | Business details |
| hasLocationOAuth | boolean | No | Has OAuth flag |
| hasCompanyOAuth | boolean | No | Company OAuth flag |
| ghlOAuth | OAuthDetails | Yes | OAuth tokens |
| settings | LocationSettings | No | Location settings |
| social | SocialLinks | No | Social media URLs |
| syncProgress | SyncProgress | No | Sync status |
| pipelines | any[] | No | Pipeline configs |
| pipelinesUpdatedAt | string | Yes | Pipeline update date |
| pipelineCount | number | No | Pipeline count |
| lastPipelineSync | string | Yes | Pipeline sync date |
| calendars | any[] | No | Calendar configs |
| calendarsUpdatedAt | string | Yes | Calendar update date |
| calendarCount | number | No | Calendar count |
| lastCalendarSync | string | Yes | Calendar sync date |
| customFieldMapping | any | No | Field mappings |
| customFieldsByModel | any | No | Model fields |
| ghlCustomFields | any | No | GHL fields |
| lastCustomFieldSync | string | Yes | Field sync date |
| tagCount | number | No | Tag count |
| lastTagSync | string | Yes | Tag sync date |
| customValues | any | No | Custom values |
| customValuesRaw | any[] | No | Raw values |
| lastCustomValuesSync | string | Yes | Values sync date |
| userCount | number | No | User count |
| contactCount | number | No | Contact count |
| taskCount | number | No | Task count |
| projectCount | number | No | Project count |
| appointmentCount | number | No | Appointment count |
| conversationCount | number | No | Conversation count |
| invoiceCount | number | No | Invoice count |
| contactSyncStatus | any | Yes | Contact sync status |
| lastContactSync | string | Yes | Contact sync date |
| conversationSyncStatus | any | Yes | Conv sync status |
| lastConversationSync | string | Yes | Conv sync date |
| appointmentSyncStatus | any | Yes | Appt sync status |
| lastAppointmentSync | string | Yes | Appt sync date |
| lastInvoiceSync | string | Yes | Invoice sync date |
| lastDetailSync | string | Yes | Detail sync date |
| emailTemplates | EmailTemplates | Yes | Email templates |
| termsAndConditions | string | Yes | Default terms |
| defaultsSetup | boolean | Yes | Defaults flag |
| defaultsSetupAt | string | Yes | Defaults date |
| lastSetupRun | string | Yes | Setup run date |
| setupCompleted | boolean | Yes | Setup complete flag |
| setupCompletedAt | string | Yes | Setup complete date |
| setupResults | any | Yes | Setup results |
| lastSetupWebhook | string | Yes | Setup webhook |
| createdAt | string | No | Creation timestamp |
| updatedAt | string | No | Update timestamp |

### Agency

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| companyId | string | No | GHL company ID |
| name | string | No | Agency name |
| locationCount | number | No | Number of locations |
| locationsLastSynced | string | No | Locations sync date |
| createdAt | string | No | Creation timestamp |
| updatedAt | string | No | Update timestamp |

### Template

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| isGlobal | boolean | No | Global template flag |
| locationId | string \| null | Yes | Location ID if not global |
| name | string | No | Template name |
| description | string | No | Template description |
| category | string | No | Template category |
| preview | string | No | Preview emoji/image |
| isDefault | boolean | No | Default flag |
| styling | TemplateStyling | No | Style configuration |
| companyOverrides | CompanyOverrides | No | Company branding |
| tabs | TemplateTab[] | No | Template tabs |
| createdAt | string | No | Creation timestamp |
| updatedAt | string | No | Update timestamp |
| createdBy | string | No | Creator user ID |

### Library

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| locationId | string | No | Tenant isolation ID |
| name | string | No | Library name |
| isDefault | boolean | No | Default flag |
| isShared | boolean | No | Shared flag |
| categories | LibraryCategory[] | No | Product categories |
| createdBy | string | No | Creator user ID |
| createdAt | string | No | Creation timestamp |
| updatedAt | string | No | Update timestamp |

### Tag

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | MongoDB ObjectId |
| locationId | string | No | Tenant isolation ID |
| name | string | No | Tag name |
| ghlTagId | string | No | GHL tag ID |
| slug | string | No | URL slug |
| color | string | No | Hex color code |
| isActive | boolean | No | Active flag |
| createdAt | string | No | Creation timestamp |
| updatedAt | string | No | Update timestamp |

---

## Supporting Types

### QuoteSection

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| id | string | No | Section ID |
| name | string | No | Section name |
| lineItems | QuoteLineItem[] | No | Line items |
| subtotal | number | No | Section subtotal |
| isCollapsed | boolean | Yes | UI collapsed state |

### QuoteLineItem

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| id | string | No | Line item ID |
| libraryItemId | string | Yes | Library reference |
| categoryId | string | Yes | Category reference |
| name | string | No | Item name |
| description | string | Yes | Item description |
| quantity | number | No | Quantity |
| unitPrice | number | No | Price per unit |
| totalPrice | number | No | Line total |
| unit | string | No | Unit of measure |
| sku | string | Yes | SKU code |
| isCustomItem | boolean | No | Custom item flag |

### Milestone

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| id | string | No | Milestone ID |
| title | string | No | Milestone title |
| description | string | Yes | Description |
| completed | boolean | No | Completion flag |
| completedAt | string | Yes | Completion date |
| dueDate | string | Yes | Due date |
| createdAt | string \| Date | No | Creation date |
| createdBy | string | Yes | Creator user ID |

### UserPreferences

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| dashboardType | string | Yes | Dashboard type |
| showGlobalTemplates | boolean | Yes | Show global flag |
| homeTabLabel | string | Yes | Custom home label |
| navigatorOrder | string[] | Yes | Nav item order |
| hiddenNavItems | string[] | Yes | Hidden nav items |
| showHomeLabel | boolean | Yes | Show home label |
| customDashboard | object | Yes | Dashboard config |
| theme | string | Yes | UI theme |
| notifications | boolean \| object | Yes | Notification prefs |
| defaultCalendarView | string | Yes | Calendar view |
| emailSignature | string | Yes | Email signature |

### DashboardWidget

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| id | string | No | Widget ID |
| type | string | No | Widget type |
| size | string | No | Widget size |
| position | number | No | Display position |
| config | object | Yes | Widget config |

### Pipeline

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| id | string | No | Pipeline ID |
| name | string | No | Pipeline name |
| stages | PipelineStage[] | Yes | Pipeline stages |
| isActive | boolean | Yes | Active flag |
| createdAt | string | Yes | Creation date |
| updatedAt | string | Yes | Update date |

### PipelineStage

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| id | string | No | Stage ID |
| name | string | No | Stage name |
| position | number | No | Display order |
| type | string | No | Stage type |

### SignedQuoteFile

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | GridFS file ID |
| length | number | No | File size |
| chunkSize | number | No | Chunk size |
| uploadDate | string | No | Upload date |
| filename | string | No | File name |
| metadata | SignedQuoteMetadata | No | File metadata |

### PaymentProofFile

| Field | Type | Optional | Description |
|-------|------|----------|-------------|
| _id | string | No | GridFS file ID |
| length | number | No | File size |
| chunkSize | number | No | Chunk size |
| uploadDate | string | No | Upload date |
| filename | string | No | File name |
| metadata | object | No | File metadata 