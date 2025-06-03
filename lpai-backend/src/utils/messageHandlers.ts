// src/utils/messageHandlers.ts
import { Db, ObjectId } from 'mongodb';

export interface MessageData {
  ghlMessageId: string;
  conversationId: string;
  ghlConversationId: string;
  locationId: string;
  contactId: string;
  projectId?: string;
  type: number;
  messageType: string;
  direction: string;
  dateAdded: Date;
  source: string;
  [key: string]: any;
}

// Handle SMS messages (type 1)
export function handleSMSMessage(ghlMessage: any, baseData: MessageData): MessageData {
  return {
    ...baseData,
    body: ghlMessage.body || '',
    status: ghlMessage.status || 'delivered',
    // SMS specific fields
    segments: ghlMessage.segments || 1,
    cost: ghlMessage.cost || 0
  };
}

// Handle Email messages (type 3)
export function handleEmailMessage(ghlMessage: any, baseData: MessageData): MessageData {
  const messageData: MessageData = {
    ...baseData,
    contentType: ghlMessage.contentType || 'text/html'
  };

  // Store email reference for on-demand fetching
  if (ghlMessage.meta?.email?.messageIds?.[0]) {
    messageData.emailMessageId = ghlMessage.meta.email.messageIds[0];
    messageData.needsContentFetch = true;
    // Don't store body/subject - fetch on demand
  }

  return messageData;
}

// Handle Activity messages (types 25, 26, etc)
export function handleActivityMessage(ghlMessage: any, baseData: MessageData): MessageData {
  return {
    ...baseData,
    body: ghlMessage.body || '',
    activityType: ghlMessage.messageType,
    // Activity specific metadata
    activityMeta: ghlMessage.meta || {}
  };
}

// Handle WhatsApp messages (if needed)
export function handleWhatsAppMessage(ghlMessage: any, baseData: MessageData): MessageData {
  return {
    ...baseData,
    body: ghlMessage.body || '',
    status: ghlMessage.status || 'delivered',
    // WhatsApp specific fields
    mediaUrl: ghlMessage.mediaUrl,
    mediaType: ghlMessage.mediaType
  };
}

// Main message handler dispatcher
export function processMessage(ghlMessage: any, commonData: Omit<MessageData, 'ghlMessageId'>): MessageData {
  const baseData: MessageData = {
    ...commonData,
    ghlMessageId: ghlMessage.id,
    type: ghlMessage.type,
    messageType: ghlMessage.messageType || '',
    direction: ghlMessage.direction || 'inbound',
    dateAdded: ghlMessage.dateAdded ? new Date(ghlMessage.dateAdded) : new Date(),
    source: ghlMessage.source || 'unknown'
  };

  switch (ghlMessage.type) {
    case 1: // SMS
      return handleSMSMessage(ghlMessage, baseData);
      
    case 3: // Email
      return handleEmailMessage(ghlMessage, baseData);
      
    case 25: // Activity - Contact
    case 26: // Activity - Invoice
    case 24: // Activity - Appointment
    case 27: // Activity - Opportunity
      return handleActivityMessage(ghlMessage, baseData);
      
    case 4: // WhatsApp (if supported)
      return handleWhatsAppMessage(ghlMessage, baseData);
      
    default:
      // Unknown type - store what we have
      console.warn(`[Message Handler] Unknown message type: ${ghlMessage.type}`);
      return {
        ...baseData,
        body: ghlMessage.body || '',
        meta: ghlMessage.meta || {}
      };
  }
}