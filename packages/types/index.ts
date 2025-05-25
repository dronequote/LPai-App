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
// Add these to your existing packages/types/index.ts file:

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
  
  // Status & Lifecycle
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired' | 'revised';
  version: number; // For revisions
  parentQuoteId?: string; // If this is a revision
  
  // Terms & Conditions
  validUntil?: string;
  termsAndConditions?: string;
  paymentTerms?: string;
  notes?: string;
  
  // Timestamps & Tracking
  sentAt?: string;
  viewedAt?: string;
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