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
    milestones?: Milestone[];
    photos?: ProjectPhoto[];
    documents?: ProjectDocument[];
    timeline?: ProjectTimelineEntry[];
    customFields?: {
        [key: string]: any;
    };
    contact?: Contact;
    contactName?: string;
    otherProjects?: Project[];
    upcomingAppointments?: Appointment[];
    completedMilestones?: number;
    totalMilestones?: number;
    progressPercentage?: number;
    updatedAt?: string;
    scopeOfWork?: string;
    products?: string;
    pipelineId?: string;
    pipelineName?: string;
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
    _id?: string;
    userId: string;
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
}
export interface Appointment {
    _id: string;
    title: string;
    contactId: string;
    calendarId: string;
    start: string;
    end: string;
    time?: string;
    notes?: string;
    status?: string;
    userId?: string;
    locationId: string;
}
export interface Milestone {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    completedAt?: string;
    dueDate?: string;
    createdAt: string | Date;
    createdBy?: string;
}
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
export interface ProjectDocument {
    id: string;
    name: string;
    originalName: string;
    uri: string;
    type: string;
    size: number;
    uploadDate: string;
    uploadedBy?: string;
}
export interface ProjectTimelineEntry {
    id: string;
    event: string;
    description: string;
    timestamp: string;
    userId: string;
    metadata?: {
        [key: string]: any;
    };
}
export interface Quote {
    _id: string;
    quoteNumber: string;
    projectId: string;
    contactId: string;
    locationId: string;
    userId: string;
    title: string;
    description?: string;
    sections: QuoteSection[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    discountAmount?: number;
    discountPercentage?: number;
    total: number;
    status: 'draft' | 'published' | 'viewed' | 'signed' | 'recalled' | 'expired' | 'revised';
    version: number;
    parentQuoteId?: string;
    publishedAt?: string;
    publishedBy?: string;
    viewedAt?: string;
    lastViewedAt?: string;
    webLinkToken?: string;
    webLinkExpiry?: string;
    signatures?: {
        consultant?: {
            signature: string;
            signedAt: string;
            signedBy: string;
            deviceInfo?: string;
        };
        customer?: {
            signature: string;
            signedAt: string;
            signedBy: string;
            ipAddress?: string;
            deviceInfo?: string;
        };
    };
    signedPdfUrl?: string;
    originalPdfUrl?: string;
    activityFeed?: QuoteActivity[];
    emailsSent?: QuoteEmail[];
    validUntil?: string;
    termsAndConditions?: string;
    paymentTerms?: string;
    notes?: string;
    sentAt?: string;
    respondedAt?: string;
    signatureImageUrl?: string;
    signedAt?: string;
    signedBy?: string;
    ghlOpportunityId?: string;
    ghlWorkflowTriggered?: boolean;
    createdAt: string;
    updatedAt: string;
    contact?: Contact;
    project?: Project;
    contactName?: string;
    projectTitle?: string;
}
export interface QuoteActivity {
    id: string;
    action: 'published' | 'viewed' | 'signed' | 'recalled' | 'emailed' | 'pdf_generated' | 'link_copied' | 'revised';
    timestamp: string;
    userId?: string;
    metadata?: {
        emailRecipient?: string;
        ipAddress?: string;
        deviceInfo?: string;
        errorMessage?: string;
        templateId?: string;
        [key: string]: any;
    };
}
export interface QuoteEmail {
    id: string;
    type: 'quote_link' | 'quote_pdf' | 'signed_pdf' | 'quote_both';
    sentAt: string;
    sentBy: string;
    recipient: string;
    subject: string;
    bodyPreview: string;
    ghlMessageId?: string;
    templateId?: string;
    status: 'sent' | 'delivered' | 'opened' | 'failed';
    failureReason?: string;
}
export interface QuoteSection {
    id: string;
    name: string;
    lineItems: QuoteLineItem[];
    subtotal: number;
    isCollapsed?: boolean;
}
export interface QuoteLineItem {
    id: string;
    libraryItemId?: string;
    categoryId?: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    unit: string;
    sku?: string;
    isCustomItem: boolean;
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
