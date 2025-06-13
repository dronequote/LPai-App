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
    pipelineStageId?: string;
    monetaryValue?: number;
    quoteNumber?: string;
    signedDate?: string;
    contactEmail?: string;
    contactPhone?: string;
    ghlCreatedAt?: string;
    ghlUpdatedAt?: string;
    lastSyncedAt?: string;
    createdBySync?: boolean;
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
    fullName?: string;
    secondaryPhone?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    companyName?: string;
    website?: string;
    dateOfBirth?: string | null;
    dnd?: boolean;
    dndSettings?: any;
    tags?: string[];
    source?: string;
    type?: string;
    assignedTo?: string | null;
    customFields?: any[];
    additionalEmails?: string[];
    attributions?: Array<{
        utmSessionSource?: string;
        medium?: string;
        isFirst: boolean;
    }>;
    ghlCreatedAt?: string;
    ghlUpdatedAt?: string;
    lastSyncedAt?: string;
    updatedAt?: string;
    createdAt?: string;
    createdBySync?: boolean;
}
export interface User {
    _id?: string;
    userId: string;
    name: string;
    email: string;
    role: string;
    locationId: string;
    permissions: string[];
    preferences?: UserPreferences;
    hashedPassword?: string;
    apiKey?: string;
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
    reauthReason?: string;
    requiresReauth?: boolean;
    needsPasswordReset?: boolean;
    createdAt?: string;
    createdBySync?: boolean;
    createdByWebhook?: string;
    processedBy?: string;
    webhookId?: string;
    lastWebhookUpdate?: string;
    ghlUserId?: string;
    locationIds?: string[];
}
export interface UserPreferences {
    dashboardType?: 'service' | 'sales' | 'operations' | 'custom';
    showGlobalTemplates?: boolean;
    homeTabLabel?: string;
    navigatorOrder?: string[];
    hiddenNavItems?: string[];
    showHomeLabel?: boolean;
    customDashboard?: {
        layout: DashboardWidget[];
    };
    theme?: 'light' | 'dark' | 'system';
    notifications?: boolean | {
        push?: boolean;
        email?: boolean;
        sms?: boolean;
    };
    defaultCalendarView?: 'day' | 'week' | 'month';
    emailSignature?: string;
    timezone?: string;
    dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
    timeFormat?: '12h' | '24h';
    firstDayOfWeek?: 0 | 1 | 6;
    language?: string;
    workingHours?: {
        enabled: boolean;
        start: string;
        end: string;
        days: number[];
    };
    appointmentReminders?: {
        enabled: boolean;
        minutesBefore: number;
    };
    defaultAppointmentDuration?: number;
    communication?: {
        phoneProvider: 'native' | 'ghl_twilio' | 'disabled';
        defaultPhoneNumber?: string;
        showCallButton?: boolean;
        autoLogCalls?: boolean;
        smsProvider: 'native' | 'ghl_twilio' | 'disabled';
        smsSignature?: string;
        smsTemplatesEnabled?: boolean;
        autoLogSms?: boolean;
        emailProvider: 'default' | 'gmail' | 'outlook' | 'ghl';
        emailTracking?: boolean;
        emailTemplatesEnabled?: boolean;
        autoLogEmails?: boolean;
        videoProvider?: 'zoom' | 'googlemeet' | 'teams' | 'disabled';
        defaultMeetingDuration?: number;
        preferredContactMethod?: 'phone' | 'sms' | 'email' | 'whatsapp';
        communicationHours?: {
            enabled: boolean;
            start: string;
            end: string;
            days: number[];
            timezone: string;
        };
    };
    business?: {
        defaultProjectStatus?: string;
        autoSaveQuotes?: boolean;
        quoteExpirationDays?: number;
        signature?: {
            type: 'text' | 'draw' | 'upload';
            value: string;
        };
        defaultTaxRate?: number;
        measurementUnit?: 'imperial' | 'metric';
    };
    privacy?: {
        showPhoneNumber?: boolean;
        showEmail?: boolean;
        activityTracking?: boolean;
        dataRetentionDays?: number;
    };
    mobile?: {
        offlineMode?: boolean;
        syncOnWifiOnly?: boolean;
        compressImages?: boolean;
        biometricLogin?: boolean;
        stayLoggedIn?: boolean;
    };
}
export interface DashboardWidget {
    id: string;
    type: string;
    size: 'full' | 'half' | 'quarter';
    position: number;
    config?: Record<string, any>;
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
    status: 'draft' | 'published' | 'viewed' | 'signed' | 'recalled' | 'expired' | 'revised' | 'deposit_paid';
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
    depositType?: string;
    depositValue?: number;
    depositAmount?: number;
    paymentSummary?: {
        totalRequired: number;
        depositRequired: number;
        depositPaid: number;
        totalPaid: number;
        balance: number;
        paymentIds: string[];
        lastPaymentAt?: string;
        depositPaidAt?: string;
    };
    signedPdfUrl?: string;
    originalPdfUrl?: string;
    pdfGeneratedAt?: string;
    signedPdfFileId?: string;
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
        templateUsed?: string;
        isGlobalTemplate?: boolean;
        emailId?: string;
        sentTo?: string;
        sentAt?: string;
        success?: boolean;
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
export interface Payment {
    _id: string;
    projectId: string;
    quoteId: string;
    contactId: string;
    locationId: string;
    amount: number;
    type: string;
    method: string;
    description: string;
    status: string;
    ghlInvoiceId?: string;
    ghlInvoiceNumber?: string;
    ghlInvoiceUrl?: string;
    createdAt: string;
    createdBy: string;
    proofPhotoId?: string;
    proofPhotoUrl?: string;
    proofUploadedAt?: string;
    checkNumber?: string;
    completedAt?: string;
    ghlPaymentId?: string | null;
    paymentMethod?: string;
    updatedAt?: string;
}
export interface Invoice {
    _id: string;
    ghlInvoiceId: string;
    locationId: string;
    companyId: string;
    invoiceNumber: string;
    name: string;
    title: string;
    status: string;
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
        type: string;
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
    termsNotes: string;
    opportunityId: string | null;
    attachments: any[];
    sentBy: string;
    sentTo: {
        phoneNo: string[];
        email: string[];
        emailBcc: string[];
        emailCc: string[];
    };
    updatedBy: string;
    automaticTaxesCalculated: boolean;
    ghlCreatedAt: string;
    ghlUpdatedAt: string;
    lastSyncedAt: string;
    updatedAt: string;
    createdAt: string;
    createdBySync: boolean;
    tipsConfiguration?: any;
    tipsReceived?: any[];
    externalTransactions?: any[];
    lateFeesConfiguration?: any;
    remindersConfiguration?: {
        reminderExecutionDetailsList: any;
        reminderSettings: any;
    };
    opportunityDetails?: any | null;
    sentFrom?: any;
    manualStatusTransitions?: {
        [key: string]: boolean;
    };
    lastVisitedAt?: string;
    syncDetails?: any[];
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
    ghlAppointmentId: string;
    ghlEventId: string;
    locationId: string;
    title: string;
    notes: string;
    contactId: string;
    userId: string | null;
    calendarId: string;
    groupId: string;
    projectId?: string;
    quoteId?: string;
    start: string;
    end: string;
    duration: number;
    timezone: string;
    locationType: string;
    customLocation: string;
    address: string;
    meetingUrl?: string;
    status: string;
    appointmentStatus: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    calendarName: string;
    calendarColor?: string;
    calendarIcon?: string;
    assignedUserId: string | null;
    assignedResources: any[];
    isRecurring: boolean;
    recurringDetails?: any;
    recurringId?: string;
    createdBy: {
        source: string;
        userId?: string;
        contactId?: string;
    };
    reminders?: any[];
    followUpAppointmentId?: string;
    previousAppointmentId?: string;
    ghlCreatedAt: string;
    ghlUpdatedAt: string;
    lastSyncedAt: string;
    updatedAt: string;
    createdAt: string;
    createdBySync: boolean;
    tags?: string[];
    customFields?: {
        [key: string]: any;
    };
    metadata?: any;
    time?: string;
}
export interface Message {
    _id: string;
    ghlMessageId: string;
    conversationId: string;
    ghlConversationId: string;
    locationId: string;
    contactId: string;
    projectId: string | null;
    type: number;
    messageType: string;
    direction: 'inbound' | 'outbound';
    contentType: string | null;
    source: string;
    dateAdded: string;
    lastSyncedAt: string;
    updatedAt: string;
    createdAt: string;
    createdBySync: boolean;
    read: boolean;
    body?: string;
    meta: any;
    emailMessageId?: string;
    needsContentFetch?: boolean;
}
export interface Conversation {
    _id: string;
    ghlConversationId: string;
    locationId: string;
    contactId: string;
    projectId?: string;
    type: string;
    unreadCount: number;
    inbox: boolean;
    starred: boolean;
    lastMessageDate: string;
    lastMessageBody: string;
    lastMessageType: string;
    lastMessageDirection: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    dateAdded: string;
    dateUpdated: string;
    attributed: boolean;
    scoring: any[];
    followers: string[];
    tags: string[];
    lastSyncedAt: string;
    updatedAt: string;
    createdAt: string;
    createdBySync: boolean;
}
export interface Note {
    _id: string;
    ghlNoteId: string;
    locationId: string;
    contactId: string;
    opportunityId?: string | null;
    body: string;
    createdBy: string;
    createdAt: string;
    createdByWebhook?: string;
    processedBy?: string;
}
export interface EmailStat {
    _id: string;
    webhookId: string;
    locationId: string;
    emailId: string;
    event: string;
    timestamp: string;
    recipient: string;
    recipientDomain: string | null;
    primaryDomain: string | null;
    tags: string[];
    recipientProvider: string | null;
    campaigns: any[];
    deliveryStatus: any | null;
    envelope: any | null;
    lcOperations: {
        domain: string;
        email_message_id: string;
        email_type: string;
        lc_email_internal: string;
        location_id: string;
        company_id: string;
        email_type_id?: string;
        email_type_step_id?: string;
    };
    logLevel: string | null;
    metadata: {
        type: string;
        locationId: string;
        versionId: string;
        appId: string;
        companyId: string;
        webhookPayload: any;
        timestamp: string;
        webhookId: string;
    };
    processedAt: string;
    processedBy: string;
}
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
    ghlCreatedAt: string;
    ghlUpdatedAt: string;
    dateAdded: string;
    dateUpdated: string;
    lastSyncedAt: string;
    updatedAt: string;
    createdAt: string;
    createdBySync?: boolean;
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
export interface Template {
    _id: string;
    isGlobal: boolean;
    locationId?: string | null;
    name: string;
    description: string;
    category: 'plumbing' | 'hvac' | 'electrical' | 'roofing' | 'general' | string;
    preview: string;
    isDefault: boolean;
    styling: TemplateStyling;
    companyOverrides: CompanyOverrides;
    tabs: TemplateTab[];
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}
export interface TemplateStyling {
    primaryColor: string;
    accentColor: string;
    fontFamily: 'system' | 'serif' | 'sans-serif' | string;
    layout: 'standard' | 'modern' | 'classic' | string;
}
export interface CompanyOverrides {
    name?: string | null;
    logo?: string | null;
    tagline?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    establishedYear?: string;
    warrantyYears?: string;
}
export interface TemplateTab {
    id: string;
    title: string;
    icon: string;
    enabled: boolean;
    order: number;
    blocks: TemplateBlock[];
}
export interface TemplateBlock {
    id: string;
    type: 'hero' | 'benefit_cards' | 'contact_info' | 'quote_header' | 'quote_breakdown' | 'terms_section' | 'process_steps' | 'warranty_cards' | 'service_list' | 'scope_list' | 'specifications' | 'text_section';
    position: number;
    content: any;
}
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
        value: string;
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
    content: string;
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
    items: string[];
}
export interface ScopeListContent {
    title: string;
    items: string[];
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
            unit: string;
            sku: string;
            isActive: boolean;
            usageCount: number;
            createdAt: string;
            updatedAt: string;
        }>;
        createdAt: string;
        updatedAt: string;
    }>;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export interface Tag {
    _id: string;
    locationId: string;
    name: string;
    ghlTagId: string;
    slug: string;
    color: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface Agency {
    _id: string;
    companyId: string;
    name: string;
    locationCount: number;
    locationsLastSynced: string;
    createdAt: string;
    updatedAt: string;
}
export interface Location {
    _id: string;
    locationId: string;
    companyId: string;
    appInstalled: boolean;
    installType: string;
    installWebhookId: string;
    installedAt?: string;
    installedBy?: string;
    uninstalled?: boolean;
    uninstalledAt?: string;
    uninstalledBy?: string | null;
    uninstallReason?: string;
    uninstallWebhookId?: string;
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
    syncProgress: {
        conversations?: any;
        invoices?: any;
        defaults?: any;
        overall?: any;
    };
    pipelines: any[];
    pipelinesUpdatedAt?: string;
    pipelineCount: number;
    lastPipelineSync?: string;
    calendars: any[];
    calendarsUpdatedAt?: string;
    calendarCount: number;
    lastCalendarSync?: string;
    customFieldMapping: any;
    customFieldsByModel: any;
    ghlCustomFields: any;
    lastCustomFieldSync?: string;
    tagCount: number;
    lastTagSync?: string;
    customValues: any;
    customValuesRaw: any[];
    lastCustomValuesSync?: string;
    userCount: number;
    contactCount: number;
    taskCount: number;
    projectCount: number;
    appointmentCount: number;
    conversationCount: number;
    invoiceCount: number;
    contactSyncStatus?: any;
    lastContactSync?: string;
    conversationSyncStatus?: any;
    lastConversationSync?: string;
    appointmentSyncStatus?: any;
    lastAppointmentSync?: string;
    lastInvoiceSync?: string;
    lastDetailSync?: string;
    emailTemplates?: {
        contractSigned?: string;
    };
    termsAndConditions?: string;
    defaultsSetup?: boolean;
    defaultsSetupAt?: string;
    lastSetupRun?: string;
    setupCompleted?: boolean;
    setupCompletedAt?: string;
    setupResults?: any;
    lastSetupWebhook?: string;
    createdAt: string;
    updatedAt: string;
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
export interface SignedQuoteFile {
    _id: string;
    length: number;
    chunkSize: number;
    uploadDate: string;
    filename: string;
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
export interface PaymentProofFile {
    _id: string;
    length: number;
    chunkSize: number;
    uploadDate: string;
    filename: string;
    metadata: {
        paymentId: string;
        locationId: string;
        uploadedAt: string;
    };
}
export interface ServiceResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
}
export interface SyncResult {
    entity: string;
    created: number;
    updated: number;
    failed: number;
    errors?: string[];
    duration?: number;
    timestamp?: string;
}
export interface BatchOperationResult<T> {
    successful: T[];
    failed: Array<{
        item: any;
        error: string;
    }>;
    total: number;
    successCount: number;
    failedCount: number;
}
export interface BaseFilters {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
}
export interface ProjectFilters extends BaseFilters {
    status?: ProjectStatus | string;
    contactId?: string;
    pipelineId?: string;
    pipelineStageId?: string;
    startDate?: string;
    endDate?: string;
    hasQuotes?: boolean;
    userId?: string;
}
export interface ContactFilters extends BaseFilters {
    status?: string;
    source?: string;
    tags?: string[];
    hasProjects?: boolean;
    createdAfter?: string;
    createdBefore?: string;
}
export interface AppointmentFilters extends BaseFilters {
    calendarId?: string;
    userId?: string;
    contactId?: string;
    projectId?: string;
    status?: AppointmentStatus | string;
    startDate?: string;
    endDate?: string;
    includeRecurring?: boolean;
}
export interface QuoteFilters extends BaseFilters {
    status?: QuoteStatus | string;
    projectId?: string;
    contactId?: string;
    createdAfter?: string;
    createdBefore?: string;
    minAmount?: number;
    maxAmount?: number;
    hasSignatures?: boolean;
}
export interface ConversationFilters extends BaseFilters {
    contactId?: string;
    type?: 'sms' | 'email' | 'all';
    unreadOnly?: boolean;
    starred?: boolean;
    afterDate?: string;
    beforeDate?: string;
}
export interface PaymentFilters extends BaseFilters {
    projectId?: string;
    quoteId?: string;
    contactId?: string;
    status?: PaymentStatus | string;
    type?: PaymentType | string;
    method?: PaymentMethod | string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
}
export declare enum ProjectStatus {
    Open = "open",
    Won = "won",
    Lost = "lost",
    Abandoned = "abandoned"
}
export declare enum QuoteStatus {
    Draft = "draft",
    Published = "published",
    Viewed = "viewed",
    Signed = "signed",
    Recalled = "recalled",
    Expired = "expired",
    Revised = "revised",
    DepositPaid = "deposit_paid"
}
export declare enum AppointmentStatus {
    Scheduled = "scheduled",
    Completed = "completed",
    Cancelled = "cancelled",
    NoShow = "no_show",
    Rescheduled = "rescheduled"
}
export declare enum PaymentStatus {
    Pending = "pending",
    Completed = "completed",
    Failed = "failed",
    Refunded = "refunded",
    Cancelled = "cancelled"
}
export declare enum PaymentType {
    Deposit = "deposit",
    Progress = "progress",
    Final = "final",
    Additional = "additional"
}
export declare enum PaymentMethod {
    Card = "card",
    Cash = "cash",
    Check = "cheque",
    BankTransfer = "bank_transfer",
    Other = "other"
}
export declare enum MessageDirection {
    Inbound = "inbound",
    Outbound = "outbound"
}
export declare enum UserRole {
    Admin = "admin",
    User = "user",
    Technician = "technician",
    Manager = "manager"
}
export declare enum DashboardType {
    Service = "service",
    Sales = "sales",
    Operations = "operations",
    Custom = "custom"
}
export interface CreateProjectInput {
    title: string;
    contactId: string;
    userId: string;
    locationId: string;
    status?: string;
    notes?: string;
    scopeOfWork?: string;
    products?: string;
    pipelineId?: string;
    pipelineStageId?: string;
    customFields?: Record<string, any>;
}
export interface UpdateProjectInput {
    title?: string;
    status?: string;
    notes?: string;
    scopeOfWork?: string;
    products?: string;
    pipelineStageId?: string;
    milestones?: Milestone[];
    customFields?: Record<string, any>;
}
export interface CreateContactInput {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    notes?: string;
    locationId: string;
    source?: string;
    tags?: string[];
}
export interface UpdateContactInput {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    notes?: string;
    tags?: string[];
    status?: string;
}
export interface CreateAppointmentInput {
    title: string;
    contactId: string;
    userId: string;
    locationId: string;
    calendarId: string;
    start: string;
    end: string;
    duration?: number;
    notes?: string;
    locationType?: 'address' | 'custom' | 'phone' | 'googlemeet' | 'zoom';
    customLocation?: string;
    address?: string;
    projectId?: string;
    reminders?: Array<{
        type: 'email' | 'sms' | 'push';
        minutesBefore: number;
    }>;
}
export interface UpdateAppointmentInput {
    title?: string;
    start?: string;
    end?: string;
    notes?: string;
    status?: string;
    locationType?: string;
    customLocation?: string;
    address?: string;
}
export interface CreateQuoteInput {
    projectId: string;
    contactId: string;
    locationId: string;
    userId: string;
    title: string;
    description?: string;
    sections: QuoteSection[];
    taxRate?: number;
    discountAmount?: number;
    discountPercentage?: number;
    depositType?: 'percentage' | 'fixed';
    depositValue?: number;
    termsAndConditions?: string;
    paymentTerms?: string;
    notes?: string;
    validUntil?: string;
    templateId?: string;
}
export interface UpdateQuoteInput {
    title?: string;
    description?: string;
    sections?: QuoteSection[];
    taxRate?: number;
    discountAmount?: number;
    discountPercentage?: number;
    depositType?: string;
    depositValue?: number;
    termsAndConditions?: string;
    paymentTerms?: string;
    notes?: string;
    status?: string;
}
export interface LibraryItem {
    id: string;
    name: string;
    description: string;
    basePrice: number;
    markup: number;
    unit: string;
    sku: string;
    isActive: boolean;
    usageCount: number;
    categoryId?: string;
    libraryId?: string;
    createdAt: string;
    updatedAt: string;
}
export interface LibraryCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
    sortOrder: number;
    isActive: boolean;
    items: LibraryItem[];
    createdAt: string;
    updatedAt: string;
}
export interface InvoiceItem {
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
}
export interface Attribution {
    utmSessionSource?: string;
    medium?: string;
    isFirst: boolean;
}
export interface WebhookPayload {
    type: string;
    locationId: string;
    eventType: string;
    id: string;
    [key: string]: any;
}
export interface WebhookQueueItem {
    _id: string;
    webhookId: string;
    type: string;
    locationId: string;
    payload: any;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    attempts: number;
    lastAttempt?: string;
    error?: string;
    createdAt: string;
    processedAt?: string;
}
export interface ApiError {
    error: string;
    message: string;
    statusCode: number;
    details?: any;
}
export interface ValidationError extends ApiError {
    fields: Record<string, string[]>;
}
export interface SyncOptions {
    fullSync?: boolean;
    limit?: number;
    startDate?: string;
    endDate?: string;
    entities?: string[];
    forceUpdate?: boolean;
}
export interface SyncProgress {
    entity: string;
    status: 'pending' | 'syncing' | 'complete' | 'failed';
    current?: number;
    total?: number;
    percent?: number;
    message?: string;
    startedAt?: string;
    completedAt?: string;
}
export interface FullSyncResult {
    overall: {
        success: boolean;
        duration: string;
        timestamp: string;
    };
    entities: Record<string, SyncResult>;
    errors: string[];
}
export interface ProjectStats {
    total: number;
    byStatus: Record<string, number>;
    thisMonth: number;
    thisWeek: number;
    averageValue?: number;
    totalValue?: number;
}
export interface QuoteStats {
    total: number;
    byStatus: Record<string, number>;
    totalValue: number;
    averageValue: number;
    conversionRate: number;
    thisMonth: {
        count: number;
        value: number;
    };
}
export interface AppointmentStats {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    upcoming: number;
    completionRate: number;
    byCalendar?: Record<string, number>;
    byUser?: Record<string, number>;
}
export interface PaymentStats {
    totalCollected: number;
    pendingAmount: number;
    averagePayment: number;
    byType: Record<string, number>;
    byMethod: Record<string, number>;
    thisMonth: {
        count: number;
        amount: number;
    };
    outstanding: {
        count: number;
        amount: number;
    };
}
export interface SelectOption {
    value: string;
    label: string;
    icon?: string;
    color?: string;
    disabled?: boolean;
}
export interface TableColumn<T> {
    key: keyof T | string;
    label: string;
    sortable?: boolean;
    width?: number | string;
    align?: 'left' | 'center' | 'right';
    render?: (value: any, item: T) => React.ReactNode;
}
export interface ChartData {
    labels: string[];
    datasets: Array<{
        label: string;
        data: number[];
        backgroundColor?: string | string[];
        borderColor?: string | string[];
    }>;
}
export interface DateRange {
    start: Date | string;
    end: Date | string;
}
export interface TimeSlot {
    start: string;
    end: string;
    available: boolean;
    appointmentId?: string;
}
