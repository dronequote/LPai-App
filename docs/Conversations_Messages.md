# 📨 LPai Messaging System - Complete Implementation Guide

## 🎯 Current Status Summary

### ✅ What's Working
- **SMS (Type 1)**: Fully functional with real-time updates
- **Real-time Updates**: Polling every 2 seconds with cache clearing
- **Optimistic UI**: Messages appear instantly when sent
- **Retry Logic**: Failed messages can be retried
- **Message Filtering**: Tabs for All/SMS/Email/Calls
- **Pagination**: Load more messages on scroll

### ⏳ What Needs Work
- **Email (Type 3)**: UI exists but needs content fetching implementation
- **Calls (Type 2)**: Tab exists but no call log display
- **Activities (Types 25-31)**: Not displayed properly yet
- **Social Messages**: Facebook, Live Chat not implemented

## 📊 Complete Message Type Reference

Based on actual MongoDB data + conversations analysis:

| Type | messageType | Description | Status |
|------|-------------|-------------|---------|
| 1 | TYPE_CALL | Voice calls/voicemail | ⏳ Needs UI |
| 2 | TYPE_SMS | Text messages | ✅ Working |
| 3 | TYPE_EMAIL | Regular emails | ⏳ Partial |
| 4 | TYPE_WHATSAPP | WhatsApp messages | 🔍 Need discovery |
| 5 | TYPE_GMB | Google My Business | 🔍 Need discovery |
| 6 | TYPE_FB | Facebook (possibly old) | 🔍 Need discovery |
| 7 | TYPE_IG | Instagram DMs | 🔍 Need discovery |
| 8 | Unknown | - | 🔍 Need discovery |
| 9 | TYPE_CAMPAIGN_EMAIL | Marketing emails | ⏳ No UI |
| 10 | Unknown | - | 🔍 Need discovery |
| 11 | TYPE_FACEBOOK | Facebook Messenger | ⏳ No UI |
| 12-20 | Unknown | - | 🔍 Need discovery |
| 21 | TYPE_CUSTOM_EMAIL | Custom email templates | ⏳ No UI |
| 22-24 | Unknown | - | 🔍 Need discovery |
| 25 | TYPE_ACTIVITY_CONTACT | Contact activities | ⏳ No UI |
| 26 | TYPE_ACTIVITY_INVOICE | Invoice activities | ⏳ No UI |
| 27 | TYPE_ACTIVITY_PAYMENT | Payment activities | ⏳ No UI |
| 28 | TYPE_ACTIVITY_OPPORTUNITY | Project updates | ⏳ No UI |
| 29 | TYPE_LIVE_CHAT | Website live chat | ⏳ No UI |
| 30 | TYPE_LIVE_CHAT_INFO | Chat system messages | ⏳ No UI |
| 31 | TYPE_ACTIVITY_APPOINTMENT | Appointment activities | ⏳ No UI |
| 32-40+ | Unknown | Possibly more activities | 🔍 Need discovery |
| N/A | TYPE_NO_SHOW | No-show appointments | 🆕 Found in convos |
| N/A | TYPE_PHONE | Generic phone conversation | 🆕 Found in convos |

**Legend:**
- ✅ Working - Fully implemented
- ⏳ Partial/No UI - Have data but needs implementation
- 🔍 Need discovery - Unknown type, needs investigation
- 🆕 Found in convos - Discovered in conversations collection

**New Discoveries from Conversations:**
1. **TYPE_NO_SHOW** - Appears in conversations when appointments are missed
   - Shows empty `lastMessageBody`
   - Used for tracking no-show appointments
   
2. **TYPE_PHONE** - Generic conversation type for all phone-based communications
   - Most conversations have this as their `type`
   - Individual messages within have specific types (SMS, CALL, etc.)

**Notes from research:**
- GHL doesn't publicly document numeric type codes
- API uses string constants (TYPE_SMS, TYPE_EMAIL, etc.)
- Types 4-7 likely match their string names based on integration docs
- Types 8, 10, 12-20, 22-24, 32+ are completely unknown
- Discovery system needed to identify these as they appear

## 🏗️ Architecture Overview

```
GoHighLevel (CRM)                    LPai App (MongoDB)
┌─────────────────┐                 ┌─────────────────────┐
│ Conversations   │ ──webhooks──→   │ conversations       │
│ - SMS threads   │                 │ - Thread metadata   │
│ - Email threads │                 │ - Unread counts     │
│ - Call logs     │                 │ - Last message info │
└─────────────────┘                 └─────────────────────┘
        │                                      │
        │                                      │
┌─────────────────┐                 ┌─────────────────────┐
│ Messages        │ ──webhooks──→   │ messages            │
│ - SMS content   │                 │ - Full content      │
│ - Email content │                 │ - Read status       │
│ - Activities    │                 │ - Timestamps        │
└─────────────────┘                 └─────────────────────┘
```

## 📋 Implementation Plan

### Phase 1: Complete Core Messaging (Current Sprint)

#### 1.1 Email Implementation ⏳
- [ ] Fix email content fetching with `emailMessageId`
- [ ] Handle `needsContentFetch: true` flag
- [ ] Display HTML emails properly in viewer
- [ ] Implement email sending through UI
- [ ] Handle campaign emails (type 9) and custom emails (type 21)

```javascript
// Email types to handle:
// Type 3: Regular emails with emailMessageId
// Type 9: Campaign emails with meta.email.messageIds[0]
// Type 21: Custom emails with meta.email.messageIds[0]
```

#### 1.2 Call Log Display ⏳
- [ ] Display call logs (type 1) in conversation
- [ ] Show voicemail indicator when `status: "voicemail"`
- [ ] Add call duration if available
- [ ] Implement "Call Back" button
- [ ] Show missed/incoming/outgoing indicators

#### 1.3 Activity Messages ⏳
- [ ] Create activity message UI (gray background, italic text)
- [ ] Group consecutive activities
- [ ] Add appropriate icons for each activity type
- [ ] Consider filtering activities by default

### Phase 2: Social & Live Chat

#### 2.1 Facebook Messages ⏳
- [ ] Handle type 11 (Facebook Messenger)
- [ ] Show Facebook icon/branding
- [ ] Link to Facebook profile if available

#### 2.2 Live Chat ⏳
- [ ] Handle type 29 (Live Chat messages)
- [ ] Handle type 30 (Chat system messages)
- [ ] Show chat widget indicator
- [ ] Display chat session start/end

### Phase 3: Real-time Improvements

#### 3.1 Current Real-time (Polling) ✅
- [x] Polls every 2 seconds
- [x] Clears AsyncStorage cache
- [x] Direct API calls bypass service cache
- [x] Shows connection indicator

#### 3.2 Future Real-time (SSE/WebSocket) ⏳
- [ ] Implement SSE endpoint for push updates
- [ ] Add MongoDB change streams
- [ ] Create WebSocket connection for bidirectional
- [ ] Add typing indicators
- [ ] Show read receipts

### Phase 4: Backend Field Migration

#### 4.1 ContactObjectId Migration ⏳
Current issue: Using `contactId` (string) instead of `contactObjectId` (ObjectId)

**Backend files to update:**
- [ ] `/api/conversations/index.ts`
- [ ] `/api/conversations/[conversationId]/messages.ts`
- [ ] `/api/contacts/[contactId]/conversations.ts`
- [ ] `/api/sms/send.ts`
- [ ] `/api/emails/send.ts`
- [ ] `/utils/webhooks/processors/messages.ts` ⚡ CRITICAL
- [ ] `/utils/sync/syncConversations.ts`
- [ ] `/utils/sync/syncMessages.ts`

**Frontend files to update:**
- [x] `src/services/conversationService.ts` ✅
- [ ] `src/components/ConversationsList.tsx`
- [ ] `src/screens/ContactDetailsScreen.tsx`
- [ ] Update TypeScript types

### Phase 5: Message Type Discovery System

#### 5.1 Backend Discovery Mechanism
Create a system to capture and analyze unknown message types:

- [ ] Add `unknown_message_types` collection in MongoDB
- [ ] Update webhook processor to log unknown types:
  - When type > 31 or not in known list
  - Store full message payload
  - Include timestamp and locationId
  - Flag for manual review
- [ ] Create discovery endpoint `/api/admin/message-types`
  - List all unknown types found
  - Group by type number
  - Show sample payloads
  - Allow marking as "identified"

#### 5.2 Frontend Discovery UI
Add admin tools to review unknown types:

- [ ] Admin section in app (if user is admin)
- [ ] Show unknown message types dashboard
- [ ] Display sample messages for each type
- [ ] Allow naming/documenting new types
- [ ] Export discoveries as JSON

#### 5.3 Automated Notifications
Alert when new types discovered:

- [ ] Email notification to admin when new type found
- [ ] Daily summary of unknown types
- [ ] Webhook to Slack/Discord for real-time alerts
- [ ] Include message count and first occurrence

#### 5.4 Discovery Implementation Steps

1. **Modify webhook processor**:
   ```
   - Check if message.type is in KNOWN_TYPES array
   - If unknown, insert into unknown_message_types collection
   - Include full webhook payload for analysis
   - Continue processing normally (don't block)
   ```

2. **Create monitoring dashboard**:
   ```
   - Query unknown_message_types collection
   - Group by type number
   - Show messageType string if available
   - Display sample message content
   - Track frequency and patterns
   ```

3. **Build type mapping**:
   ```
   - As types are identified, update MESSAGE_TYPES constant
   - Document purpose and structure
   - Add to main implementation guide
   - Update UI to handle new types
   ```

### Phase 6: Additional Features

- [ ] Message search functionality
- [ ] Conversation archiving
- [ ] Message reactions
- [ ] File attachments
- [ ] Voice messages
- [ ] Message templates
- [ ] Bulk messaging
- [ ] Message scheduling

## 🔍 Key Findings from Data Analysis

### Conversation Types vs Message Types
From analyzing the conversations collection, we discovered:

1. **Conversation `type` is always generic**:
   - `TYPE_PHONE` - Used for ALL conversations (SMS, calls, emails, everything)
   - This is different from individual message types

2. **`lastMessageType` reveals the actual message type**:
   - `TYPE_SMS` - Text messages
   - `TYPE_EMAIL` - Email messages
   - `TYPE_CAMPAIGN_EMAIL` - Marketing campaigns
   - `TYPE_LIVE_CHAT_INFO_MESSAGE` - Chat system messages
   - `TYPE_FACEBOOK` - Facebook messages
   - `TYPE_NO_SHOW` - Appointment no-shows (special case)

3. **Field Naming Inconsistencies**:
   - Some conversations have `contactObjectId` (correct)
   - Some only have GHL IDs stored as strings
   - Mix of `lastMessageDate` and `lastMessageAt`
   - Some have `ghlContactId`, others don't

4. **Email Content in Conversations**:
   - Email preview includes tracking pixels and long URLs
   - Subject line often included in body preview
   - Marketing emails show template structure

5. **Special Cases**:
   - TYPE_NO_SHOW appears with empty `lastMessageBody`
   - Live chat conversations show system messages
   - Some conversations created by sync vs webhook

### Database Inconsistencies Found
- Mixed use of `contactId` vs `contactObjectId`
- Some conversations missing `ghlContactId`
- Inconsistent timestamp field names
- Some using old schema, some using new

### Real-time Hook (`useRealtimeMessages.ts`)
```javascript
// Currently implemented:
- Polls every 2 seconds
- Clears all caches before polling
- Returns isConnected status
- Handles new messages callback
```

### ConversationsList Component
```javascript
// Currently implemented:
- Message filtering (All/SMS/Email/Calls tabs)
- Optimistic UI updates
- Retry failed messages
- Email viewer modal
- Pagination support
- Real-time integration
```

## 🐛 Known Issues

1. **Email Content Not Loading**
   - `needsContentFetch: true` messages show placeholder
   - Need to implement `/api/messages/email/[emailMessageId]` call

2. **Activities Showing as Regular Messages**
   - Types 25-31 need different UI treatment
   - Should be styled as system messages

3. **No Call Log UI**
   - Type 1 messages just show empty body
   - Need to display call information properly

4. **ContactId vs ContactObjectId**
   - Backend uses mixed field names
   - Causes query failures in some cases

## 📝 Database Schema (Current)

### conversations Collection
```javascript
{
  _id: ObjectId("..."),
  ghlConversationId: "string",
  locationId: "string",
  contactObjectId: ObjectId("..."), // Should be this
  contactId: "string",              // Sometimes this (WRONG)
  type: "TYPE_PHONE",
  unreadCount: 0,
  lastMessageDate: Date,
  lastMessageBody: "string",
  // ... etc
}
```

### messages Collection
```javascript
{
  _id: ObjectId("..."),
  conversationId: ObjectId("..."),  // MUST be ObjectId
  ghlMessageId: "string",
  type: 1,                          // Numeric type
  messageType: "TYPE_SMS",          // String type
  body: "content",
  emailMessageId: "string",         // For email content fetch
  needsContentFetch: true,          // Email not loaded
  // ... etc
}
```

## 🚀 Quick Wins

1. **Today**
   - Fix email content loading
   - Add call log display
   - Style activity messages differently

2. **This Week**
   - Complete email sending
   - Add social message icons
   - Implement message search

3. **Next Week**
   - Start SSE implementation
   - Add typing indicators
   - Implement read receipts

## 📊 Testing Checklist

- [ ] Send/receive SMS ✅
- [ ] Send/receive emails
- [ ] View call logs
- [ ] See activity messages
- [ ] Real-time updates work ✅
- [ ] Pagination works ✅
- [ ] Search messages
- [ ] Filter by type ✅
- [ ] Retry failed messages ✅
- [ ] Mark as read
- [ ] Unread counts update

## 🔍 Debugging Commands

```javascript
// Find all message types in system
db.messages.aggregate([
  { $group: { _id: "$type", count: { $sum: 1 } }},
  { $sort: { _id: 1 }}
])

// Check for email messages needing fetch
db.messages.find({ 
  type: { $in: [3, 9, 21] },
  needsContentFetch: true 
}).limit(5)

// Find conversations with wrong contactId type
db.conversations.find({
  contactId: { $type: "string" },
  contactObjectId: { $exists: false }
})
```

## 📚 Resources

- **Backend API Docs**: `/lpai-backend/docs/API_REFERENCE.md`
- **GHL Message Types**: Not officially documented
- **MongoDB Collections**: `messages`, `conversations`
- **Test Location**: `5OuaTrizW5wkZMI1xtvX` (LeadProspecting.AI)