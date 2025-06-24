# 📨 Conversations & Messages System - Complete Guide

## 🎯 Why Two Collections?

Think of it like **WhatsApp or iMessage**:
- **Conversations** = The chat thread/room itself (like your chat with "Mom")
- **Messages** = Individual texts within that chat

This separation allows for:
- Fast loading of conversation lists (without loading all messages)
- Unread counts per conversation
- Conversation-level features (starred, archived, muted)
- Efficient pagination of messages

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

## 📊 Database Schema

### conversations Collection
```javascript
{
  _id: ObjectId("6856519a479e5bdcc186db5a"),        // MongoDB ID
  ghlConversationId: "sSEd66uCPfGkM2nqfEjg",        // GHL's ID
  locationId: "5OuaTrizW5wkZMI1xtvX",              // Tenant ID
  
  // Contact reference (NEW NAMING)
  contactObjectId: ObjectId("6844d07b257a88ebfbd9be9b"), // MongoDB contact._id
  ghlContactId: "Z66RBjrLBWWqmKP43eBR",            // GHL contact ID
  
  // Conversation metadata
  type: "TYPE_PHONE",                                // TYPE_PHONE, TYPE_EMAIL, etc.
  inbox: true,                                       // Is in inbox
  starred: false,                                    // User starred it
  unreadCount: 0,                                    // Number of unread messages
  
  // Last message preview (for list view)
  lastMessageDate: ISODate("2025-06-24T03:55:21Z"),
  lastMessageBody: "Test sms",                      // First 200 chars
  lastMessageDirection: "outbound",                 // inbound/outbound
  lastMessageType: "TYPE_SMS",
  
  // Contact info (denormalized for performance)
  contactName: "Michael Dean",
  contactEmail: "michael@example.com",
  contactPhone: "+17603304890"
}
```

### messages Collection
```javascript
{
  _id: ObjectId("685a237ca3220ee53c1e3b0d"),
  conversationId: ObjectId("6856519a479e5bdcc186db5a"), // MUST BE OBJECTID!
  ghlMessageId: "3xHH82Tr2Uy68AP8PLTU",
  ghlConversationId: "sSEd66uCPfGkM2nqfEjg",
  locationId: "5OuaTrizW5wkZMI1xtvX",
  
  // Contact reference (NEW NAMING)
  contactObjectId: ObjectId("6844d07b257a88ebfbd9be9b"), // MongoDB contact._id
  ghlContactId: "Z66RBjrLBWWqmKP43eBR",            // GHL contact ID
  
  // Message details
  type: 1,                                          // 1=SMS, 3=Email, 2=Call, 25+=Activities
  messageType: "TYPE_SMS",                          // String version
  direction: "outbound",                            // inbound/outbound
  body: "Test sms",                                 // Message content
  status: "sent",                                   // sent/delivered/failed
  
  // Metadata
  dateAdded: ISODate("2025-06-24T03:10:05Z"),
  read: true,
  source: "app",                                    // app/ghl/webhook
  sentBy: "68564ce27eb5e1b3a7f2e149",              // User who sent it
  
  // Email specific (type 3)
  subject: "Your quote is ready",
  emailMessageId: "abc123",                         // For fetching full content
  needsContentFetch: true,                          // Email body not loaded yet
  
  // SMS specific (type 1)
  fromNumber: "+17603304890",
  toNumber: "+19097024889"
}
```

## 🔑 Key Field Naming Convention

To avoid confusion between MongoDB IDs and GHL IDs:

| Field | Type | Description |
|-------|------|-------------|
| `contactObjectId` | ObjectId | MongoDB contact._id reference |
| `ghlContactId` | String | GoHighLevel's contact ID |
| `conversationId` | ObjectId | MongoDB conversation._id reference |
| `ghlConversationId` | String | GoHighLevel's conversation ID |

**Why this matters:**
- `contactObjectId` as ObjectId = Fast queries and joins
- Clear distinction between our IDs and GHL's IDs
- No more confusion about what "contactId" means

## 🔢 Message Types Reference

```javascript
const MESSAGE_TYPES = {
  1: "SMS",
  2: "CALL", 
  3: "EMAIL",
  4: "WHATSAPP",
  5: "GMB",           // Google My Business
  6: "FB",            // Facebook
  7: "IG",            // Instagram
  24: "LIVE_CHAT",
  25: "ACTIVITY_CONTACT",      // Contact was created/updated
  26: "ACTIVITY_INVOICE",      // Invoice activity
  27: "ACTIVITY_OPPORTUNITY",  // Project/opportunity activity
  28: "ACTIVITY_APPOINTMENT"   // Appointment activity
};
```

## 🔄 Data Flow

### 1. **Sending SMS from App**
```
User types message → POST /api/sms/send
                    ↓
                    → Create/update conversation (type: TYPE_PHONE)
                    → Insert message (type: 1, conversationId: ObjectId)
                    → Send to GHL API
                    → Update conversation lastMessage fields
```

### 2. **Receiving Message via Webhook**
```
GHL sends webhook → POST /api/webhooks/ghl/native
                   ↓
                   → Queue in webhook_queue
                   → MessagesProcessor picks it up
                   → Find/create conversation
                   → Insert message with conversationId as ObjectId
                   → Update conversation metadata
```

### 3. **Loading Conversations in App**
```
App opens contact → GET /api/conversations?contactId=xxx
                   ↓
                   → Returns all conversations for contact
                   → Shows last message preview
                   → User taps conversation
                   ↓
                   GET /api/conversations/{id}/messages
                   → Returns paginated messages
                   → Marks messages as read
                   → Updates unread count
```

## ⚠️ Critical Rules

### 1. **conversationId MUST be ObjectId**
```javascript
// ❌ WRONG - Will break queries
conversationId: "6856519a479e5bdcc186db5a"  // String

// ✅ CORRECT
conversationId: ObjectId("6856519a479e5bdcc186db5a")
```

### 2. **contactObjectId MUST be ObjectId**
```javascript
// ❌ WRONG - Old naming
contactId: "6844d07b257a88ebfbd9be9b"  // String

// ✅ CORRECT - New naming
contactObjectId: ObjectId("6844d07b257a88ebfbd9be9b")
```

### 3. **Message type field is numeric**
```javascript
// ❌ WRONG
type: "sms"

// ✅ CORRECT  
type: 1  // Numeric!
```

### 4. **Always filter by locationId**
```javascript
// Every query must include locationId for multi-tenant isolation
db.messages.find({ 
  conversationId: ObjectId("..."),
  locationId: "5OuaTrizW5wkZMI1xtvX"  // REQUIRED
})
```

## 🐛 Common Issues & Solutions

### "No messages showing"
1. Check conversationId is ObjectId in messages collection
2. Verify message has `type: 1` (numeric) not `type: "sms"`
3. Ensure `body` field exists on message
4. Check locationId matches
5. Verify contactObjectId points to correct contact

### "Messages in wrong conversation"
- Check if contactObjectId in conversation matches the messages
- Verify conversationId is consistent across messages
- Ensure GHL webhook processor is using correct field mapping

### "Messages in wrong order"
- Sort by `dateAdded` not `createdAt`
- Frontend shows newest first (inverted FlatList)

### "Unread count wrong"
- Update conversation.unreadCount when marking messages read
- Webhook processor sets `read: false` for inbound
- Fetching messages marks them as read

## 📝 Implementation Checklist

When implementing messaging features:

- [ ] Store conversationId as ObjectId, not string
- [ ] Use contactObjectId (ObjectId) not contactId (string)
- [ ] Include numeric type field (1 for SMS, 3 for Email)
- [ ] Update conversation lastMessage fields
- [ ] Handle unread counts properly
- [ ] Always filter by locationId
- [ ] Use proper field names (body not message)
- [ ] Set read status appropriately
- [ ] Include dateAdded timestamp
- [ ] Store both ghlContactId and contactObjectId for reference

## 🔧 Debugging Commands

```javascript
// Check conversation exists with new field
db.conversations.findOne({ 
  contactObjectId: ObjectId("6844d07b257a88ebfbd9be9b"),
  locationId: "locationId",
  type: "TYPE_PHONE" 
})

// Count messages with correct structure  
db.messages.count({
  conversationId: { $type: "objectId" },
  contactObjectId: { $type: "objectId" },
  type: { $type: "number" }
})

// Find conversations still using old contactId field
db.conversations.find({
  contactId: { $exists: true },
  contactObjectId: { $exists: false }
})

// Migration: Convert contactId to contactObjectId
db.conversations.find({ contactId: { $exists: true } }).forEach(function(doc) {
  db.conversations.updateOne(
    { _id: doc._id },
    {
      $set: { 
        contactObjectId: ObjectId(doc.contactId),
        ghlContactId: doc.ghlContactId || "" 
      },
      $unset: { contactId: "" }
    }
  );
});

// Fix messages with string contactId
db.messages.find({ contactId: { $exists: true } }).forEach(function(doc) {
  db.messages.updateOne(
    { _id: doc._id },
    {
      $set: { 
        contactObjectId: ObjectId(doc.contactId)
      },
      $unset: { contactId: "" }
    }
  );
});
```

## 🚀 Future Improvements
- Real-time updates via WebSocket
- Message search functionality  
- Conversation archiving
- Message reactions
- Read receipts
- Typing indicators
- Push notifications

## 📋 Backend Updates Needed

To fully implement the new naming convention:

1. **Update `/api/sms/send`**:
   - Use `contactObjectId` when creating conversations
   - Store as ObjectId, not string

2. **Update webhook processors**:
   - `MessagesProcessor` should use `contactObjectId`
   - Ensure ObjectId type consistency

3. **Update API endpoints**:
   - `/api/conversations` queries should use `contactObjectId`
   - `/api/messages` should include `contactObjectId`

4. **Add database indexes**:
   ```javascript
   db.conversations.createIndex({ contactObjectId: 1, locationId: 1 })
   db.messages.createIndex({ contactObjectId: 1, conversationId: 1 })
   ```

   Searched project for “api conversations messages contactId endpoint”
4 results








Based on my search, here are all the files that need to be updated for the contactObjectId change:

📝 Backend Files to Update
1. API Endpoints
/api/conversations/index.ts - Main conversations endpoint
/api/conversations/[conversationId]/messages.ts - Messages endpoint
/api/contacts/[contactId]/conversations.ts - Contact's conversations endpoint
/api/sms/send.ts - SMS sending (creates conversations/messages)
/api/emails/send.ts - Email sending (creates conversations/messages)
2. Webhook Processors
/utils/webhooks/processors/messages.ts - Processes message webhooks ⚡ CRITICAL
/utils/webhooks/directProcessor.ts - Direct message processing
3. Sync Functions
/utils/sync/syncConversations.ts - Syncs conversations from GHL
/utils/sync/syncMessages.ts - Syncs messages from GHL
4. Other Backend Files
/utils/reports/enhancedDailyReport.ts - May query conversations
Any other files that query conversations/messages
📱 Frontend Files to Update
1. Services
src/services/conversationService.ts - Main conversation service
src/services/smsService.ts - SMS service (if it references contactId)
2. Components
src/components/ConversationsList.tsx - Displays conversations
src/components/MessagesList.tsx - Displays messages (if exists)
Any components that display conversation/message data
3. Screens
src/screens/ConversationScreen.tsx - Individual conversation view
src/screens/ContactDetailsScreen.tsx - Shows contact's conversations
Any other screens showing messages