// lpai-backend/src/utils/filters.ts
import { ObjectId } from 'mongodb';

/**
 * Parse and validate common query parameters
 */
export interface ParsedQueryParams {
  locationId?: string;
  limit: number;
  offset: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
  startDate?: string;
  endDate?: string;
  
  // Payment specific
  method?: string;
  hasProof?: string;
  
  // Conversation specific  
  unreadOnly?: string;
  starred?: string;
  inbox?: string;
  tags?: string | string[];
  lastMessageDirection?: string;
  includeEmail?: string;
  includeProject?: string;
  includeMessageCount?: string;
  includeRecentMessages?: string;
  
  // Quote specific
  signed?: string;
  minAmount?: string;
  maxAmount?: string;
  
  // General
  includeDetails?: string;
  includeSummary?: string;
  includeDeleted?: string;
  includeUser?: string;
  includeContact?: string;
  includeCancelled?: string;
  
  [key: string]: any;
}

/**
 * Parse common query parameters with defaults
 * @param query - Next.js query object
 * @returns Parsed and validated query parameters
 */
export function parseQueryParams(query: any): ParsedQueryParams {
  const {
    locationId,
    limit = '50',
    offset = '0',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search,
    startDate,
    endDate,
    ...rest
  } = query;

  return {
    locationId: typeof locationId === 'string' ? locationId : undefined,
    limit: Math.min(Math.max(1, parseInt(limit as string, 10) || 50), 100),
    offset: Math.max(0, parseInt(offset as string, 10) || 0),
    sortBy: typeof sortBy === 'string' ? sortBy : 'createdAt',
    sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    search: typeof search === 'string' ? search : undefined,
    startDate: typeof startDate === 'string' ? startDate : undefined,
    endDate: typeof endDate === 'string' ? endDate : undefined,
    ...rest
  };
}

/**
 * Build MongoDB filter for projects
 */
export function buildProjectFilter(params: ParsedQueryParams): any {
  const filter: any = {};
  
  if (params.locationId) filter.locationId = params.locationId;
  if (params.status) filter.status = params.status;
  if (params.contactId) {
    filter.contactId = ObjectId.isValid(params.contactId) 
      ? new ObjectId(params.contactId) 
      : params.contactId;
  }
  if (params.pipelineId) filter.pipelineId = params.pipelineId;
  if (params.pipelineStageId) filter.pipelineStageId = params.pipelineStageId;
  if (params.userId) filter.userId = params.userId;
  
  // Exclude deleted projects by default
  if (!params.includeDeleted) {
    filter.status = { $ne: 'Deleted' };
  }
  
  return filter;
}

/**
 * Build MongoDB filter for contacts
 */
export function buildContactFilter(params: ParsedQueryParams): any {
  const filter: any = {};
  
  if (params.locationId) filter.locationId = params.locationId;
  if (params.status) filter.status = params.status;
  if (params.source) filter.source = params.source;
  if (params.tags && Array.isArray(params.tags)) {
    filter.tags = { $in: params.tags };
  }
  
  return filter;
}

/**
 * Build MongoDB filter for appointments
 */
export function buildAppointmentFilter(params: ParsedQueryParams): any {
  const filter: any = {};
  
  if (params.locationId) filter.locationId = params.locationId;
  if (params.calendarId) filter.calendarId = params.calendarId;
  if (params.userId) filter.userId = params.userId;
  if (params.contactId) {
    filter.contactId = ObjectId.isValid(params.contactId) 
      ? new ObjectId(params.contactId) 
      : params.contactId;
  }
  if (params.projectId) filter.projectId = params.projectId;
  if (params.status) filter.status = params.status;
  
  // Exclude cancelled appointments by default unless specifically requested
  if (!params.includeCancelled && !params.status) {
    filter.status = { $ne: 'cancelled' };
  }
  
  return filter;
}

/**
 * Build MongoDB filter for quotes
 */
export function buildQuoteFilter(params: ParsedQueryParams): any {
  const filter: any = {};
  
  if (params.locationId) filter.locationId = params.locationId;
  if (params.status) filter.status = params.status;
  if (params.projectId) {
    filter.projectId = ObjectId.isValid(params.projectId) 
      ? new ObjectId(params.projectId) 
      : params.projectId;
  }
  if (params.contactId) {
    filter.contactId = ObjectId.isValid(params.contactId) 
      ? new ObjectId(params.contactId) 
      : params.contactId;
  }
  if (params.userId) filter.userId = params.userId;
  
  return filter;
}

/**
 * Build MongoDB filter for payments
 */
export function buildPaymentFilter(params: ParsedQueryParams): any {
  const filter: any = {};
  
  if (params.locationId) filter.locationId = params.locationId;
  if (params.type) filter.type = params.type;
  if (params.method) filter.method = params.method;
  if (params.status) filter.status = params.status;
  if (params.projectId) {
    filter.projectId = new ObjectId(params.projectId);
  }
  if (params.quoteId) {
    filter.quoteId = new ObjectId(params.quoteId);
  }
  if (params.contactId) {
    filter.contactId = new ObjectId(params.contactId);
  }
  
  // Has proof photo filter
  if (params.hasProof !== undefined) {
    if (params.hasProof === 'true') {
      filter.proofPhotoId = { $exists: true };
    } else if (params.hasProof === 'false') {
      filter.proofPhotoId = { $exists: false };
    }
  }
  
  return filter;
}

/**
 * Build MongoDB filter for conversations
 */
export function buildConversationFilter(params: ParsedQueryParams): any {
  const filter: any = {};
  
  if (params.locationId) filter.locationId = params.locationId;
  if (params.type) filter.type = params.type;
  if (params.contactId) {
    filter.contactId = new ObjectId(params.contactId);
  }
  
  // Unread only filter
  if (params.unreadOnly === 'true') {
    filter.unreadCount = { $gt: 0 };
  }
  
  // Starred filter
  if (params.starred !== undefined) {
    filter.starred = params.starred === 'true';
  }
  
  // Inbox filter (not archived)
  if (params.inbox !== undefined) {
    filter.inbox = params.inbox === 'true';
  }
  
  // Project ID filter
  if (params.projectId) {
    filter.projectId = params.projectId;
  }
  
  // Tags filter
  if (params.tags) {
    const tags = Array.isArray(params.tags) ? params.tags : params.tags.split(',');
    filter.tags = { $in: tags };
  }
  
  // Last message direction filter
  if (params.lastMessageDirection) {
    filter.lastMessageDirection = params.lastMessageDirection;
  }
  
  // Include both SMS and Email by default unless specified
  if (!params.type && params.includeEmail !== 'false') {
    // This matches the existing behavior
    filter.type = { $in: ['sms', 'email'] };
  }
  
  return filter;
}

/**
 * Build MongoDB filter for invoices
 */
export function buildInvoiceFilter(params: ParsedQueryParams): any {
  const filter: any = {};
  
  if (params.locationId) filter.locationId = params.locationId;
  if (params.status) filter.status = params.status;
  if (params.contactId) filter.contactId = params.contactId;
  if (params.opportunityId) filter.opportunityId = params.opportunityId;
  
  // Amount range filter
  if (params.minAmount || params.maxAmount) {
    filter.total = {};
    if (params.minAmount) filter.total.$gte = parseFloat(params.minAmount);
    if (params.maxAmount) filter.total.$lte = parseFloat(params.maxAmount);
  }
  
  return filter;
}

/**
 * Safely parse ObjectId or return the original string
 * @param id - The ID to parse
 * @returns ObjectId or original string
 */
export function parseObjectId(id: string): ObjectId | string {
  return ObjectId.isValid(id) ? new ObjectId(id) : id;
}