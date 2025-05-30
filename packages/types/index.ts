// packages/types/index.ts
export interface Project {
  _id: string;
  title: string;
  status: string;
  createdAt: string;
  contactId: string;
  userId?: string;
  locationId: string;
  notes?: string;
  quoteId?: string;
  ghlOpportunityId?: string;
  
  // 🆕 NEW: Enhanced project management fields
  milestones?: Milestone[];
  photos?: ProjectPhoto[];
  documents?: ProjectDocument[];
  timeline?: ProjectTimelineEntry[];
  customFields?: { [key: string]: any };
  
  // 🆕 NEW: Computed fields (from API response)
  contact?: Contact;
  contactName?: string;
  otherProjects?: Project[];
  upcomingAppointments?: Appointment[];
  completedMilestones?: number;
  totalMilestones?: number;
  progressPercentage?: number;
  updatedAt?: string;
  
  // 🆕 NEW: Additional fields your API uses
  scopeOfWork?: string;
  products?: string;
  pipelineId?: string;
  pipelineName?: string;
  
  // Legacy field for UI metadata
  [key: string]: any;
}

export interface Contact {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  notes?: string;
  status: string;
  locationId: string;
  ghlContactId: string;
  projects?: Project[];
}

export interface User {
  _id?: string;        // Mongo ObjectId, optional for legacy support
  userId: string;      // GHL userId
  name: string;
  email: string;
  role: string;
  locationId: string;
  permissions: string[];
  
  // Add preferences field
  preferences?: UserPreferences;
}

// Add this new interface for preferences
export interface UserPreferences {
  // Dashboard customization
  dashboardType?: 'service' | 'sales' | 'operations' | 'custom';
  
  // Navigation customization
  navigatorOrder?: string[]; // Array of navigation item IDs ['home', 'quotes', 'projects']
  hiddenNavItems?: string[]; // Items user has explicitly hidden
  showHomeLabel?: boolean; // Whether to show "Home" label under icon
  
  // Widget preferences (for future custom dashboards)
  customDashboard?: {
    layout: DashboardWidget[];
  };
  
  // Other preferences
  theme?: 'light' | 'dark' | 'system';
  notifications?: {
    push?: boolean;
    email?: boolean;
    sms?: boolean;
  };
}

// For custom dashboard widgets (future feature)
export interface DashboardWidget {
  id: string;
  type: string;
  size: 'full' | 'half' | 'quarter';
  position: number;
  config?: Record<string, any>;
}

export interface Calendar {
  id: string;
  calendarId?: string;
  name: string;
  color?: string;
  eventColor?: string;
  icon?: string;
  // ...other fields
}

export interface Appointment {
  _id: string;
  title: string;
  contactId: string;
  calendarId: string;
  start: string;
  end: string;
  time?: string; // Legacy field
  notes?: string;
  status?: string;
  userId?: string;
  locationId: string;
  // ...other fields
}

// 🆕 NEW: Milestone interface
export interface Milestone {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  dueDate?: string;
  createdAt: string | Date; // Allow both for flexibility
  createdBy?: string;
}

// 🆕 NEW: Project photo interface
export interface ProjectPhoto {
  id: string;
  uri: string;
  filename?: string;
  caption?: string;
  timestamp: string;
  location?: {
    lat: number;
    lng: number;
  };
  uploadedBy?: string;
}

// 🆕 NEW: Project document interface
export interface ProjectDocument {
  id: string;
  name: string;
  originalName: string;
  uri: string;
  type: string; // mimeType
  size: number;
  uploadDate: string;
  uploadedBy?: string;
}

// 🆕 NEW: Project timeline entry
export interface ProjectTimelineEntry {
  id: string;
  event: string; // "created", "status_changed", "milestone_completed", etc.
  description: string;
  timestamp: string;
  userId: string;
  metadata?: { [key: string]: any };
}

// 🆕 UPDATED: Enhanced Quote interface with signature and publication features
export interface Quote {
  _id: string;
  quoteNumber: string; // Auto-generated: "Q-2024-001"
  projectId: string;
  contactId: string;
  locationId: string;
  userId: string; // Creator
  
  // Quote Details
  title: string;
  description?: string;
  sections: QuoteSection[];
  
  // Pricing
  subtotal: number;
  taxRate: number; // 0.08 = 8%
  taxAmount: number;
  discountAmount?: number;
  discountPercentage?: number;
  total: number;
  
  // Status & Lifecycle - ENHANCED for signature workflow
  status: 'draft' | 'published' | 'viewed' | 'signed' | 'recalled' | 'expired' | 'revised';
  version: number; // For revisions
  parentQuoteId?: string; // If this is a revision
  
  // 🆕 NEW: Publication & Web Link Fields
  publishedAt?: string; // ISO date when published
  publishedBy?: string; // userId who published
  viewedAt?: string; // First time customer viewed
  lastViewedAt?: string; // Most recent customer view
  webLinkToken?: string; // Secure token for public access
  webLinkExpiry?: string; // Auto-expire date
  
  // 🆕 NEW: Signature Tracking
  signatures?: {
    consultant?: {
      signature: string; // base64 signature image
      signedAt: string; // ISO date
      signedBy: string; // userId
      deviceInfo?: string; // iPad info, browser, etc.
    };
    customer?: {
      signature: string; // base64 signature image
      signedAt: string; // ISO date
      signedBy: string; // customer name
      ipAddress?: string; // for remote signing
      deviceInfo?: string; // browser/device info
    };
  };
  
  // 🆕 NEW: File Storage
  signedPdfUrl?: string; // GridFS file reference
  originalPdfUrl?: string; // unsigned PDF for reference
  
  // 🆕 NEW: Activity Tracking
  activityFeed?: QuoteActivity[];
  
  // 🆕 NEW: Email Integration
  emailsSent?: QuoteEmail[];
  
  // Terms & Conditions
  validUntil?: string;
  termsAndConditions?: string;
  paymentTerms?: string;
  notes?: string;
  
  // Legacy signature fields (keeping for backward compatibility)
  sentAt?: string;
  respondedAt?: string;
  signatureImageUrl?: string;
  signedAt?: string;
  signedBy?: string;
  
  // GHL Integration
  ghlOpportunityId?: string;
  ghlWorkflowTriggered?: boolean;
  
  createdAt: string;
  updatedAt: string;
  
  // Computed fields (from API response)
  contact?: Contact;
  project?: Project;
  contactName?: string;
  projectTitle?: string;
}

// 🆕 NEW: Activity tracking interface
export interface QuoteActivity {
  id: string;
  action: 'published' | 'viewed' | 'signed' | 'recalled' | 'emailed' | 'pdf_generated' | 'link_copied' | 'revised';
  timestamp: string; // ISO date
  userId?: string; // Who performed the action (null for customer actions)
  metadata?: {
    emailRecipient?: string;
    ipAddress?: string;
    deviceInfo?: string;
    errorMessage?: string;
    templateId?: string;
    [key: string]: any;
  };
}

// 🆕 NEW: Email tracking interface  
export interface QuoteEmail {
  id: string;
  type: 'quote_link' | 'quote_pdf' | 'signed_pdf' | 'quote_both';
  sentAt: string; // ISO date
  sentBy: string; // userId
  recipient: string; // email address
  subject: string;
  bodyPreview: string; // First 100 chars of email body
  ghlMessageId?: string; // GHL message tracking ID
  templateId?: string; // GHL template used
  status: 'sent' | 'delivered' | 'opened' | 'failed';
  failureReason?: string;
}

export interface QuoteSection {
  id: string;
  name: string; // "Materials", "Labor", "Permits", etc.
  lineItems: QuoteLineItem[];
  subtotal: number;
  isCollapsed?: boolean;
}

export interface QuoteLineItem {
  id: string;
  libraryItemId?: string; // Reference to library item (optional for custom items)
  categoryId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number; // Price after markup
  totalPrice: number; // quantity * unitPrice
  unit: string;
  sku?: string;
  isCustomItem: boolean; // true if not from library
}

export interface Pipeline {
  id: string;
  name: string;
  stages?: PipelineStage[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  type: string;
}