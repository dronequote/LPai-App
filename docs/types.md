// In packages/types/index.ts, add all of these:

// ==================== NOTES ====================
export interface Note {
  _id: string;
  ghlNoteId: string;
  locationId: string;
  contactId: string;
  opportunityId?: string | null;
  body: string;
  createdBy: string;
  createdAt: string;
  
  // System fields (backend only)
  createdByWebhook?: string;
  processedBy?: string;
}

// ==================== TASKS ====================
export interface Task {
  _id: string;
  ghlTaskId: string;
  locationId: string;
  title: string;
  description?: string;
  contactId: string;
  contactDetails?: {
    firstName: string;
    lastName: string;
  };
  assignedTo?: string | null;
  assignedToUserDetails?: {
    id: string | null;
    firstName: string | null;
    lastName: string | null;
    profilePhoto?: string;
  };
  status: 'pending' | 'completed';
  completed: boolean;
  dueDate: string;
  completedAt?: string | null;
  deleted: boolean;
  
  // Date tracking
  ghlCreatedAt: string;
  ghlUpdatedAt: string;
  dateAdded: string;
  dateUpdated: string;
  lastSyncedAt: string;
  updatedAt: string;
  createdAt: string;
  createdBySync?: boolean;
}

// ==================== TAGS ====================
export interface Tag {
  _id: string;
  locationId: string;
  name: string;
  ghlTagId: string;
  slug: string;
  color: string; // Hex color like "#DDA0DD"
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==================== TEMPLATES ====================
export interface Template {
  _id: string;
  isGlobal: boolean;
  locationId?: string | null; // null for global templates
  name: string;
  description: string;
  category: 'plumbing' | 'hvac' | 'electrical' | 'roofing' | 'general' | string;
  preview: string; // Emoji or preview image
  isDefault: boolean;
  styling: TemplateStyling;
  companyOverrides: CompanyOverrides;
  tabs: TemplateTab[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TemplateStyling {
  primaryColor: string; // Hex color
  accentColor: string; // Hex color
  fontFamily: 'system' | 'serif' | 'sans-serif' | string;
  layout: 'standard' | 'modern' | 'classic' | string;
}

export interface CompanyOverrides {
  name?: string | null;
  logo?: string | null; // URL or emoji
  tagline?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  establishedYear?: string;
  warrantyYears?: string;
}

export interface TemplateTab {
  id: string;
  title: string; // Can include {variables}
  icon: string; // Emoji
  enabled: boolean;
  order: number;
  blocks: TemplateBlock[];
}

export interface TemplateBlock {
  id: string;
  type: 'hero' | 'benefit_cards' | 'contact_info' | 'quote_header' | 
        'quote_breakdown' | 'terms_section' | 'process_steps' | 
        'warranty_cards' | 'service_list' | 'scope_list' | 
        'specifications' | 'text_section';
  position: number;
  content: any; // Content varies by type - see below
}

// Block content types
export interface HeroBlockContent {
  title: string;
  subtitle: string;
  icon: string;
}

export interface BenefitCardsContent {
  cards: Array<{
    icon: string;
    title: string;
    subtitle: string;
    description: string;
  }>;
}

export interface ContactInfoContent {
  title: string;
  items: Array<{
    icon: string;
    label: string;
    value: string; // Can include {variables}
  }>;
}

export interface QuoteHeaderContent {
  title: string;
  subtitle: string;
  customerLabel: string;
}

export interface QuoteBreakdownContent {
  title: string;
  labels: {
    subtotal: string;
    tax: string;
    total: string;
    quantity: string;
    sectionTotal: string;
  };
}

export interface TermsSectionContent {
  title: string;
  content: string; // Can include {variables}
}

export interface ProcessStepsContent {
  steps: Array<{
    stepNumber: number;
    title: string;
    time: string;
    description: string;
  }>;
}

export interface WarrantyCardsContent {
  cards: Array<{
    icon: string;
    title: string;
    subtitle: string;
    description: string;
  }>;
}

export interface ServiceListContent {
  title: string;
  items: string[]; // Array of strings with checkmarks/bullets
}

export interface ScopeListContent {
  title: string;
  items: string[]; // Array of strings with bullets
}

export interface SpecificationsContent {
  specs: Array<{
    title: string;
    items: string[];
  }>;
}

export interface TextSectionContent {
  title: string;
  content: string;
}

// ==================== UPDATED USER TYPE ====================
// Update the existing User interface to match the database:
export interface User {
  _id?: string;
  userId: string;      // This is ghlUserId in the DB
  name: string;
  email: string;
  role: 'user' | 'admin' | 'agency';
  locationId: string;
  permissions: string[];
  
  // Enhanced fields from DB
  hashedPassword?: string; // Backend only
  apiKey?: string;
  preferences?: UserPreferences;
  updatedAt?: string;
  avatar?: string;
  dateAdded?: string | null;
  extension?: string;
  firstName?: string;
  isActive?: boolean;
  lastLogin?: string | null;
  lastName?: string;
  lastSyncedAt?: string;
  phone?: string;
  roles?: {
    type: 'account' | 'agency';
    role: 'admin' | 'user';
    locationIds: string[];
  };
  
  // Auth status
  reauthReason?: string;
  requiresReauth?: boolean;
  needsPasswordReset?: boolean;
  
  // System fields
  createdAt?: string;
  createdBySync?: boolean;
  createdByWebhook?: string;
  processedBy?: string;
  webhookId?: string;
  lastWebhookUpdate?: string;
}

// Update UserPreferences to match what's in the DB
export interface UserPreferences {
  // Dashboard customization
  dashboardType?: 'service' | 'sales' | 'operations' | 'custom';
  showGlobalTemplates?: boolean;
  homeTabLabel?: string;
  navigatorOrder?: string; // JSON string like "['Home', 'Projects', 'Quotes']"
  
  // Navigation customization
  hiddenNavItems?: string[];
  showHomeLabel?: boolean;
  
  // Widget preferences
  customDashboard?: {
    layout: DashboardWidget[];
  };
  
  // Other preferences
  theme?: 'light' | 'dark' | 'system';
  notifications?: boolean | {
    push?: boolean;
    email?: boolean;
    sms?: boolean;
  };
  defaultCalendarView?: 'day' | 'week' | 'month';
  emailSignature?: string;
}
// ==================== SIGNED QUOTES FILES (GridFS) ====================
// This is metadata for PDF files stored in GridFS
export interface SignedQuoteFile {
  _id: string;
  length: number;
  chunkSize: number;
  uploadDate: string;
  filename: string; // Format: quote_{quoteId}_signed_{timestamp}.pdf
  metadata: SignedQuoteMetadata;
}

export interface SignedQuoteMetadata {
  quoteId: string;
  fileType: 'signed_pdf' | 'unsigned_pdf';
  createdAt: string;
  size: number;
  quoteNumber: string;
  customerName?: string | null;
  locationId: string;
  hasSignatures: boolean;
  generatedAt: string;
}

// Note: The signed_quotes.chunks collection contains the actual binary data
// Frontend doesn't need to interact with chunks directly - just use the file ID

// ==================== QUOTES (ACTUAL) ====================
export interface Quote {
  _id: string;
  quoteNumber: string; // 'Q-2025-001'
  projectId: string;
  contactId: string;
  locationId: string;
  userId: string;
  title: string;
  description: string;
  sections: Array<{
    id: string;
    name: string;
    lineItems: Array<{
      id: string;
      libraryItemId: string | null;
      categoryId: string | null;
      name: string;
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      unit: string;
      sku: string;
      isCustomItem: boolean;
    }>;
    subtotal: number;
    isCollapsed: boolean;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  discountPercentage: number;
  total: number;
  depositType: string; // 'percentage'
  depositValue: number;
  depositAmount: number;
  paymentSummary: {
    totalRequired: number;
    depositRequired: number;
    depositPaid: number;
    totalPaid: number;
    balance: number;
    paymentIds: string[];
    lastPaymentAt: string;
    depositPaidAt: string;
  };
  status: string; // 'deposit_paid'
  version: number;
  validUntil: string | null;
  termsAndConditions: string;
  paymentTerms: string;
  notes: string;
  activityFeed: Array<{
    id?: string;
    action: string;
    timestamp: string;
    userId: string | null;
    success?: boolean;
    metadata?: any;
    templateUsed?: string;
    templateId?: string;
    isGlobalTemplate?: boolean;
    emailId?: string;
    sentTo?: string;
    sentAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  signatures?: {
    consultant?: {
      signature: string;
      signedAt: string;
      signedBy: string;
      deviceInfo: string;
    };
    customer?: {
      signature: string;
      signedAt: string;
      signedBy: string;
      deviceInfo: string;
    };
  };
  signedAt?: string;
  pdfGeneratedAt?: string;
  signedPdfFileId?: string;
  signedPdfUrl?: string;
}

// ==================== PROJECTS (ACTUAL) ====================
export interface Project {
  _id: string;
  ghlOpportunityId: string;
  locationId: string;
  title: string;
  status: string; // 'won'
  contactId: string;
  userId: string | null;
  pipelineId: string;
  pipelineStageId: string;
  monetaryValue: number;
  quoteNumber: string;
  signedDate: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  ghlCreatedAt: string;
  ghlUpdatedAt: string;
  lastSyncedAt: string;
  updatedAt: string;
  createdAt: string;
  createdBySync: boolean;
  timeline: Array<{
    id: string;
    event: string;
    description: string;
    timestamp: string;
    metadata?: {
      syncedFrom?: string;
    };
  }>;
  milestones: any[];
  photos: any[];
  documents: any[];
}

// ==================== PAYMENTS (ACTUAL) ====================
export interface Payment {
  _id: string;
  projectId: string;
  quoteId: string;
  contactId: string;
  locationId: string;
  amount: number;
  type: string; // 'deposit'
  method: string; // 'card'
  description: string;
  status: string; // 'completed', 'pending'
  ghlInvoiceId: string;
  ghlInvoiceNumber: string;
  ghlInvoiceUrl: string;
  createdAt: string;
  createdBy: string;
  
  // These fields only exist on completed payments:
  proofPhotoId?: string;
  proofPhotoUrl?: string;
  proofUploadedAt?: string;
  checkNumber?: string;
  completedAt?: string;
  ghlPaymentId?: string | null;
  paymentMethod?: string; // 'cheque'
  updatedAt?: string;
}

// ==================== PAYMENT PROOFS FILES (ACTUAL) ====================
export interface PaymentProofFile {
  _id: string;
  length: number;
  chunkSize: number;
  uploadDate: string;
  filename: string; // 'payment_683881acab6d917b980cb265_proof_1748533786570.jpg'
  metadata: {
    paymentId: string;
    locationId: string;
    uploadedAt: string;
  };
}

// ==================== PAYMENT PROOF CHUNKS (ACTUAL) ====================
export interface PaymentProofChunk {
  _id: string;
  files_id: string;
  n: number;
  data: {
    $binary: {
      base64: string;
      subType: string;
    };
  };
}

// ==================== MESSAGES (ACTUAL) ====================
export interface Message {
  _id: string;
  ghlMessageId: string;
  conversationId: string;
  ghlConversationId: string;
  locationId: string;
  contactId: string;
  projectId: string | null;
  type: number; // 3, 28, etc.
  messageType: string; // "TYPE_EMAIL", "TYPE_ACTIVITY_OPPORTUNITY"
  direction: 'inbound' | 'outbound';
  contentType: string | null; // "text/html" or null
  source: string; // 'app'
  dateAdded: string;
  lastSyncedAt: string;
  updatedAt: string;
  createdAt: string;
  createdBySync: boolean;
  read: boolean;
  body?: string; // Present for some messages
  meta: any; // Empty object in examples
  emailMessageId?: string; // For email messages
  needsContentFetch?: boolean; // For emails
}

// ==================== CONVERSATIONS (ACTUAL) ====================
export interface Conversation {
  _id: string;
  ghlConversationId: string;
  locationId: string;
  contactId: string;
  projectId?: string; // Optional - not all conversations have this
  type: string; // 'TYPE_PHONE'
  unreadCount: number;
  inbox: boolean;
  starred: boolean;
  lastMessageDate: string;
  lastMessageBody: string;
  lastMessageType: string; // 'TYPE_EMAIL', 'TYPE_SMS', 'TYPE_NO_SHOW'
  lastMessageDirection: string; // 'inbound', 'outbound'
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  dateAdded: string;
  dateUpdated: string;
  attributed: boolean;
  scoring: any[]; // Empty array in all examples
  followers: string[]; // Array of user IDs
  tags: string[];
  lastSyncedAt: string;
  updatedAt: string;
  createdAt: string;
  createdBySync: boolean;
}

// ==================== LOCATIONS (ACTUAL) ====================
export interface Location {
  _id: string;
  locationId: string;
  companyId: string;
  
  // Installation Status
  appInstalled: boolean;
  installType: string; // 'Location'
  installWebhookId: string;
  installedAt?: string;
  installedBy?: string;
  uninstalled?: boolean;
  uninstalledAt?: string;
  uninstalledBy?: string | null;
  uninstallReason?: string;
  uninstallWebhookId?: string;
  
  // Basic Info
  name: string;
  email: string;
  phone: string;
  website: string | null;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  timezone: string;
  planId: string;
  
  // Business Info
  business: {
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    timezone: string;
    email: string;
  };
  
  // OAuth Status
  hasLocationOAuth: boolean;
  hasCompanyOAuth: boolean;
  ghlOAuth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    tokenType: string;
    userType: string;
    scope: string;
    derivedFromCompany?: boolean;
    installedAt?: string;
  };
  
  // Settings
  settings: {
    allowDuplicateContact: boolean;
    allowDuplicateOpportunity: boolean;
    allowFacebookNameMerge: boolean;
    disableContactTimezone: boolean;
    contactUniqueIdentifiers: string[];
    saasSettings?: {
      saasMode: string;
      customerId: string;
      planDetails: {
        priceId: string;
        productId: string;
        subscriptionId: string;
        subscriptionStatus: string;
      };
      twilioRebilling?: {
        enabled: boolean;
        markup: number;
      };
      mailgunRebilling?: {
        enabled: boolean;
        markup: number;
      };
      saasPlanId: string;
    };
  };
  
  // Social Media
  social: {
    facebookUrl: string;
    googlePlus: string;
    linkedIn: string;
    foursquare: string;
    twitter: string;
    yelp: string;
    instagram: string;
    youtube: string;
    pinterest: string;
    blogRss: string;
    googlePlacesId: string;
  };
  
  // Sync Progress
  syncProgress: {
    conversations?: any;
    invoices?: any;
    defaults?: any;
    overall?: any;
  };
  
  // Pipelines
  pipelines: any[];
  pipelinesUpdatedAt?: string;
  pipelineCount: number;
  lastPipelineSync?: string;
  
  // Calendars  
  calendars: any[];
  calendarsUpdatedAt?: string;
  calendarCount: number;
  lastCalendarSync?: string;
  
  // Custom Fields
  customFieldMapping: any;
  customFieldsByModel: any;
  ghlCustomFields: any;
  lastCustomFieldSync?: string;
  
  // Tags
  tagCount: number;
  lastTagSync?: string;
  
  // Custom Values
  customValues: any;
  customValuesRaw: any[];
  lastCustomValuesSync?: string;
  
  // Entity Counts
  userCount: number;
  contactCount: number;
  taskCount: number;
  projectCount: number;
  appointmentCount: number;
  conversationCount: number;
  invoiceCount: number;
  
  // Sync Status
  contactSyncStatus?: any;
  lastContactSync?: string;
  conversationSyncStatus?: any;
  lastConversationSync?: string;
  appointmentSyncStatus?: any;
  lastAppointmentSync?: string;
  lastInvoiceSync?: string;
  lastDetailSync?: string;
  
  // Email Templates
  emailTemplates?: {
    contractSigned?: string;
  };
  
  // Defaults
  termsAndConditions?: string;
  defaultsSetup?: boolean;
  defaultsSetupAt?: string;
  
  // Setup
  lastSetupRun?: string;
  setupCompleted?: boolean;
  setupCompletedAt?: string;
  setupResults?: any;
  lastSetupWebhook?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ==================== LIBRARIES (ACTUAL) ====================
export interface Library {
  _id: string;
  locationId: string;
  name: string;
  isDefault: boolean;
  isShared: boolean;
  categories: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    sortOrder: number;
    isActive: boolean;
    items: Array<{
      id: string;
      name: string;
      description: string;
      basePrice: number;
      markup: number;
      unit: string; // 'each', 'hour'
      sku: string;
      isActive: boolean;
      usageCount: number;
      createdAt: string;
      updatedAt: string;
    }>;
    createdAt: string;
    updatedAt: string;
  }>;
  createdBy: string; // 'system'
  createdAt: string;
  updatedAt: string;
}
// ==================== INVOICES (ACTUAL) ====================
export interface Invoice {
  _id: string;
  ghlInvoiceId: string;
  locationId: string;
  companyId: string;
  invoiceNumber: string;
  name: string;
  title: string; // 'INVOICE'
  status: string; // 'sent'
  liveMode: boolean;
  contactId: string;
  contactDetails: {
    id: string;
    name: string;
    phoneNo: string;
    email: string;
  };
  businessDetails: {
    name: string;
    website: string;
  };
  issueDate: string;
  dueDate: string;
  sentAt: string;
  invoiceItems: Array<{
    ghlItemId: string;
    productId: string | null;
    priceId: string | null;
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
    currency: string;
    taxes: any[];
    taxInclusive: boolean;
    itemTotalTax: number;
    itemTotalDiscount: number;
    itemUnitDiscount: number;
  }>;
  currency: string;
  currencyOptions: {
    code: string;
    symbol: string;
  };
  subtotal: number;
  discount: {
    type: string; // 'percentage'
    value: number;
    amount: number;
  };
  totalTax: number;
  total: number;
  invoiceTotal: number;
  amountPaid: number;
  amountDue: number;
  paymentMethods: {
    stripe?: {
      enableBankDebitOnly: boolean;
    };
  };
  tipsConfiguration: any; // Empty object
  tipsReceived: any[];
  externalTransactions: any[];
  termsNotes: string;
  lateFeesConfiguration: any; // Empty object
  remindersConfiguration: {
    reminderExecutionDetailsList: any;
    reminderSettings: any;
  };
  opportunityId: string | null;
  opportunityDetails: any | null;
  attachments: any[];
  sentBy: string;
  sentFrom: any; // Empty object
  sentTo: {
    phoneNo: string[];
    email: string[];
    emailBcc: string[];
    emailCc: string[];
  };
  updatedBy: string;
  automaticTaxesCalculated: boolean;
  manualStatusTransitions: {
    [key: string]: boolean; // e.g., { sent: true }
  };
  lastVisitedAt: string;
  syncDetails: any[];
  ghlCreatedAt: string;
  ghlUpdatedAt: string;
  lastSyncedAt: string;
  updatedAt: string;
  createdAt: string;
  createdBySync: boolean;
}

// ==================== EMAIL STATS (ACTUAL) ====================
export interface EmailStat {
  _id: string;
  webhookId: string;
  locationId: string;
  emailId: string;
  event: string; // 'accepted', 'delivered', 'opened'
  timestamp: string;
  recipient: string;
  recipientDomain: string | null;
  primaryDomain: string | null;
  tags: string[];
  recipientProvider: string | null; // 'Google Workspace' or null
  campaigns: any[]; // Empty array in examples
  deliveryStatus: any | null; // Complex object for delivered events
  envelope: any | null; // Complex object for delivered events
  lcOperations: {
    domain: string;
    email_message_id: string;
    email_type: string; // 'other', 'workflow'
    lc_email_internal: string; // Encrypted string
    location_id: string;
    company_id: string;
    email_type_id?: string; // For workflow emails
    email_type_step_id?: string; // For workflow emails
  };
  logLevel: string | null; // 'info' or null
  metadata: {
    type: string; // 'LCEmailStats'
    locationId: string;
    versionId: string;
    appId: string;
    companyId: string;
    webhookPayload: any; // The full webhook data
    timestamp: string;
    webhookId: string;
  };
  processedAt: string;
  processedBy: string; // 'queue'
}

// ==================== CONVERSATIONS (ACTUAL) ====================
export interface Conversation {
  _id: string;
  ghlConversationId: string;
  locationId: string;
  contactId: string;
  projectId?: string; // Optional - not all conversations have this
  type: string; // 'TYPE_PHONE'
  unreadCount: number;
  inbox: boolean;
  starred: boolean;
  lastMessageDate: string;
  lastMessageBody: string;
  lastMessageType: string; // 'TYPE_EMAIL', 'TYPE_SMS', 'TYPE_NO_SHOW'
  lastMessageDirection: string; // 'inbound', 'outbound'
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  dateAdded: string;
  dateUpdated: string;
  attributed: boolean;
  scoring: any[]; // Empty array in all examples
  followers: string[]; // Array of user IDs
  tags: string[];
  lastSyncedAt: string;
  updatedAt: string;
  createdAt: string;
  createdBySync: boolean;
}

// ==================== CONTACTS (ACTUAL) ====================
export interface Contact {
  _id: string;
  ghlContactId: string;
  locationId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  secondaryPhone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  companyName: string;
  website: string;
  dateOfBirth: string | null;
  dnd: boolean;
  dndSettings: any; // Empty object in examples
  tags: string[];
  source: string;
  type: string; // 'lead'
  assignedTo: string | null;
  customFields: any[]; // Empty array in examples
  additionalEmails: string[];
  attributions: Array<{
    utmSessionSource?: string;
    medium?: string;
    isFirst: boolean;
  }>;
  ghlCreatedAt: string;
  ghlUpdatedAt: string;
  lastSyncedAt: string;
  updatedAt: string;
  createdAt: string;
  createdBySync: boolean;
}

// ==================== APPOINTMENTS ====================
// Calendar appointments/events synced from GHL
export interface Appointment {
  _id: string;
  
  // GHL Integration
  ghlAppointmentId: string;
  ghlEventId: string; // Usually same as appointmentId
  locationId: string;
  
  // Basic Info
  title: string;
  notes: string;
  
  // Relationships
  contactId: string;
  userId: string | null; // Assigned team member
  calendarId: string;
  groupId: string; // Calendar group ID
  projectId?: string; // If linked to opportunity
  quoteId?: string; // If linked to quote
  
  // Time Details
  start: string; // ISO date
  end: string; // ISO date
  duration: number; // Minutes
  timezone: string;
  
  // Location Details
  locationType: AppointmentLocationType;
  customLocation: string; // Custom location text
  address: string; // Physical address
  meetingUrl?: string; // For virtual meetings
  
  // Status
  status: AppointmentStatus;
  appointmentStatus: AppointmentConfirmationStatus;
  
  // Contact Info (denormalized)
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  
  // Calendar Info (denormalized)
  calendarName: string;
  calendarColor?: string;
  calendarIcon?: string;
  
  // Assignment
  assignedUserId: string | null; // Primary assigned user
  assignedResources: AppointmentResource[]; // Additional resources/team members
  
  // Recurring
  isRecurring: boolean;
  recurringDetails?: RecurringAppointmentDetails;
  recurringId?: string; // Parent recurring appointment ID
  
  // Creation Info
  createdBy: {
    source: AppointmentCreationSource;
    userId?: string;
    contactId?: string;
  };
  
  // Reminders
  reminders?: AppointmentReminder[];
  
  // Follow-up
  followUpAppointmentId?: string;
  previousAppointmentId?: string;
  
  // Timestamps
  ghlCreatedAt: string;
  ghlUpdatedAt: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
  createdBySync: boolean;
  
  // Additional fields
  tags?: string[];
  customFields?: { [key: string]: any };
  metadata?: AppointmentMetadata;
}

export type AppointmentLocationType = 
  | 'address'       // In-person at address
  | 'custom'        // Custom location text
  | 'phone'         // Phone call
  | 'video'         // Video call
  | 'zoom'          // Zoom meeting
  | 'google_meet'   // Google Meet
  | 'teams'         // Microsoft Teams
  | 'webinar';      // Webinar

export type AppointmentStatus = 
  | 'scheduled'     // Appointment is scheduled
  | 'completed'     // Appointment completed
  | 'cancelled'     // Appointment cancelled
  | 'no_show'       // Contact didn't show
  | 'rescheduled';  // Appointment was rescheduled

export type AppointmentConfirmationStatus = 
  | 'confirmed'     // Contact confirmed attendance
  | 'unconfirmed'   // Awaiting confirmation
  | 'cancelled';    // Contact cancelled

export type AppointmentCreationSource = 
  | 'calendar_page'     // Created via calendar booking page
  | 'crm_ui'           // Created in CRM
  | 'api'              // Created via API
  | 'workflow'         // Created by workflow
  | 'import'           // Imported
  | 'recurring'        // Created from recurring appointment
  | 'reschedule';      // Created from rescheduling

export interface AppointmentResource {
  resourceId: string;
  resourceType: 'user' | 'room' | 'equipment';
  resourceName: string;
}

export interface RecurringAppointmentDetails {
  pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every X days/weeks/months
  daysOfWeek?: number[]; // For weekly: 0 = Sunday, 6 = Saturday
  dayOfMonth?: number; // For monthly
  endDate?: string; // When recurrence ends
  occurrenceCount?: number; // Number of occurrences
  exceptions?: string[]; // Dates to skip
}

export interface AppointmentReminder {
  type: 'email' | 'sms' | 'push';
  timing: number; // Minutes before appointment
  sent: boolean;
  sentAt?: string;
  templateId?: string;
}

export interface AppointmentMetadata {
  source?: string;
  campaign?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
  confirmationToken?: string;
  rescheduleToken?: string;
  cancellationReason?: string;
  noShowReason?: string;
  completionNotes?: string;
}

// ==================== APPOINTMENTS (ACTUAL) ====================
export interface Appointment {
  _id: string;
  ghlAppointmentId: string;
  ghlEventId: string;
  locationId: string;
  title: string;
  notes: string;
  contactId: string;
  userId: string | null;
  calendarId: string;
  groupId: string;
  start: string;
  end: string;
  duration: number;
  timezone: string;
  locationType: string; // 'address'
  customLocation: string;
  address: string;
  status: string; // 'scheduled'
  appointmentStatus: string; // 'confirmed'
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  calendarName: string;
  assignedUserId: string | null;
  assignedResources: any[];
  isRecurring: boolean;
  createdBy: {
    source: string; // 'calendar_page'
    userId: string;
  };
  ghlCreatedAt: string;
  ghlUpdatedAt: string;
  lastSyncedAt: string;
  updatedAt: string;
  createdAt: string;
  createdBySync: boolean;
}

// ==================== COMPANIES ====================
// Company/Agency records - parent of locations (ACTUAL VERSION)
export interface Company {
  _id: string;
  companyId: string; // GHL company ID
  name: string;
  locationCount: number;
  locationsLastSynced: string;
  createdAt: string;
  updatedAt: string;
}

