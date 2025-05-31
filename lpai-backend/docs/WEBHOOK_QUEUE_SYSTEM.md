# Webhook Queue System Documentation

## Overview

The LPai webhook queue system provides scalable, reliable processing of GoHighLevel (GHL) webhooks with built-in deduplication, retry logic, and non-blocking responses.

## Architecture

### Components

1. **Webhook Endpoint** (`/api/webhooks/ghl/unified.ts`)
   - Receives webhooks from GHL
   - Validates payload
   - Queues for async processing
   - Returns immediately (non-blocking)

2. **Queue Processor** (`/api/cron/process-webhooks.ts`)
   - Runs every minute via Vercel cron
   - Processes pending webhooks in batches
   - Handles retries for failed webhooks
   - Updates MongoDB with changes

3. **Webhook Processor** (`/src/utils/webhookProcessor.ts`)
   - Contains business logic for each webhook type
   - Smart diffing to detect actual changes
   - Updates only changed fields

4. **Deduplication System** (`/src/utils/deduplication.ts`)
   - Prevents processing duplicate webhooks
   - Uses MD5 hashing of key fields
   - Auto-expires hashes after 5 minutes

## Database Collections

### webhook_queue
Stores incoming webhooks for processing
```javascript
{
  _id: ObjectId,
  webhookId: string,
  type: string,
  payload: object,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  attempts: number,
  createdAt: Date,
  processAfter: Date,
  startedAt?: Date,
  completedAt?: Date,
  lastError?: string
}
```

### webhook_hashes
Prevents duplicate processing
```javascript
{
  hash: string,
  createdAt: Date,
  expireAt: Date  // TTL index
}
```

## MongoDB Indexes

Run `npm run setup-indexes` to create:
- `webhook_queue`: status + processAfter (compound), createdAt (TTL)
- `webhook_hashes`: hash, expireAt (TTL)
- `contacts`: ghlContactId, email, locationId
- `appointments`: ghlAppointmentId, locationId + start
- `projects`: ghlOpportunityId, locationId + status

## Configuration

### Environment Variables
```bash
MONGODB_URI=your-mongodb-connection-string
CRON_SECRET=your-super-secret-cron-key-123456
```

### Vercel Configuration
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/process-webhooks",
      "schedule": "* * * * *"
    }
  ],
  "functions": {
    "pages/api/cron/process-webhooks.ts": {
      "maxDuration": 60
    }
  }
}
```

## Testing

### Local Testing

1. **Send test webhook:**
```bash
curl -X POST http://localhost:3000/api/webhooks/ghl/unified \
  -H "Content-Type: application/json" \
  -d '{
    "triggerData": {"name": "Contact Created"},
    "contact": {
      "id": "test123",
      "firstName": "Test",
      "lastName": "User",
      "email": "test@example.com"
    }
  }'
```

2. **Check queue in MongoDB:**
   - Look in `webhook_queue` collection
   - Should see entry with `status: "pending"`

3. **Process queue manually:**
```bash
curl http://localhost:3000/api/cron/process-webhooks \
  -H "Authorization: Bearer your-super-secret-cron-key-123456"
```

4. **Verify processing:**
   - Queue entry should show `status: "completed"`
   - Check relevant collection (contacts, appointments, etc.)

### Production Testing

After deployment:
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/ghl/unified \
  -H "Content-Type: application/json" \
  -d '{
    "triggerData": {"name": "Contact Created"},
    "contact": {
      "id": "prod-test123",
      "firstName": "Production",
      "lastName": "Test"
    }
  }'
```

## Adding New Webhook Types

1. **Update type detection** in `/api/webhooks/ghl/unified.ts`:
```typescript
function determineEventType(payload: any): string {
  if (payload.contact) return 'contact_changed';
  if (payload.opportunity) return 'opportunity_changed';
  if (payload.yourNewType) return 'your_new_type';
  return 'unknown';
}
```

2. **Add processor** in `/src/utils/webhookProcessor.ts`:
```typescript
case 'your_new_type':
  await processYourNewType(db, payload, webhookId);
  break;
```

3. **Implement handler:**
```typescript
async function processYourNewType(db: any, payload: any, webhookId: string) {
  // Your processing logic
}
```

## Monitoring

### Check Queue Health
```typescript
// Count pending webhooks
db.webhook_queue.countDocuments({ status: 'pending' })

// Find failed webhooks
db.webhook_queue.find({ status: 'failed' }).sort({ createdAt: -1 })

// Check processing times
db.webhook_queue.aggregate([
  { $match: { status: 'completed' } },
  { $project: {
    processingTime: { $subtract: ['$completedAt', '$startedAt'] }
  }},
  { $group: {
    _id: null,
    avgTime: { $avg: '$processingTime' }
  }}
])
```

### Common Issues

1. **Webhooks not processing:**
   - Check CRON_SECRET is set correctly
   - Verify cron job is running (Vercel Pro plan required)
   - Check MongoDB connection

2. **Duplicate processing:**
   - Verify deduplication indexes exist
   - Check webhook_hashes TTL is working

3. **Slow processing:**
   - Increase batch size in processor
   - Add more specific indexes
   - Consider splitting into multiple queues

## Performance Optimization

1. **Batch Processing:**
   - Current: 50 webhooks per minute
   - Adjust in `process-webhooks.ts`: `.limit(50)`

2. **Retry Strategy:**
   - Current: 3 attempts with 5-minute delays
   - Adjust in `webhookProcessor.ts`

3. **TTL Settings:**
   - Queue entries expire after 24 hours
   - Hashes expire after 5 minutes
   - Adjust based on your needs

## Security

- Webhook endpoint accepts all requests (GHL doesn't support authentication)
- Cron endpoint protected by Bearer token
- All data filtered by locationId for multi-tenancy
- No sensitive data logged

## Future Enhancements

1. **Priority Queue:** Add priority field for urgent webhooks
2. **Dead Letter Queue:** Store permanently failed webhooks
3. **Webhook Analytics:** Track processing times, success rates
4. **Real-time Monitoring:** Dashboard for queue status
5. **Selective Processing:** Filter which events to process per location

## Troubleshooting Commands

```bash
# View recent webhooks
mongo lpai --eval "db.webhook_queue.find().sort({createdAt: -1}).limit(10).pretty()"

# Retry failed webhooks
mongo lpai --eval "db.webhook_queue.updateMany({status: 'failed'}, {\$set: {status: 'pending', attempts: 0}})"

# Clear old webhooks
mongo lpai --eval "db.webhook_queue.deleteMany({createdAt: {\$lt: new Date(Date.now() - 7*24*60*60*1000)}})"
```