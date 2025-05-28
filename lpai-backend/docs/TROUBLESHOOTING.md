# Troubleshooting Guide

## Quick Diagnostics

### System Health Check

```bash
# 1. Check if backend is running
curl http://localhost:3000/api/health

# 2. Check database connection
curl http://localhost:3000/api/health/db

# 3. Check auth with test login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 4. Test authenticated endpoint
curl http://localhost:3000/api/contacts?locationId=loc_xxx \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Common Issues & Solutions

### Authentication Issues

#### Issue: "Invalid credentials" on login
```json
{
  "error": "Invalid credentials"
}
```

**Causes & Solutions:**

1. **Wrong email/password**
   ```javascript
   // Check if user exists in MongoDB
   db.users.findOne({ email: "user@example.com" })
   ```

2. **Password not hashed properly**
   ```javascript
   // Rehash password if needed
   const bcrypt = require('bcryptjs');
   const hashedPassword = await bcrypt.hash('newpassword', 10);
   db.users.updateOne(
     { email: "user@example.com" },
     { $set: { hashedPassword } }
   );
   ```

3. **User inactive or deleted**
   ```javascript
   // Check user status
   db.users.findOne({ email: "user@example.com", isActive: true })
   ```

#### Issue: "Access token required" (401)
```json
{
  "error": "Access token required"
}
```

**Solutions:**

1. **Missing Authorization header**
   ```javascript
   // Correct format
   headers: {
     'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIs...'
   }
   ```

2. **Token expired**
   ```javascript
   // Decode token to check expiry
   const jwt = require('jsonwebtoken');
   const decoded = jwt.decode(token);
   console.log('Token expires:', new Date(decoded.exp * 1000));
   ```

3. **Invalid JWT_SECRET**
   ```bash
   # Ensure JWT_SECRET matches between environments
   echo $JWT_SECRET
   ```

### Database Connection Issues

#### Issue: "MongoServerError: bad auth"
```
MongoServerError: bad auth : Authentication failed
```

**Solutions:**

1. **Check connection string format**
   ```bash
   # Correct format
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
   ```

2. **Verify database user permissions**
   - Go to MongoDB Atlas
   - Database Access → Edit user
   - Ensure "Read and write to any database" is selected

3. **IP Whitelist issues**
   - MongoDB Atlas → Network Access
   - Add current IP or allow all (0.0.0.0/0) for development

#### Issue: "MongoNetworkError: connection timed out"

**Solutions:**

1. **Check network connectivity**
   ```bash
   # Test MongoDB connection
   mongosh "your-connection-string"
   ```

2. **Firewall blocking MongoDB ports**
   - Check if port 27017 (or custom) is open
   - Try using a different network

3. **MongoDB service down**
   - Check MongoDB Atlas status page
   - Try connecting via MongoDB Compass

### API Request Issues

#### Issue: "Missing locationId"
```json
{
  "error": "Missing locationId"
}
```

**Solutions:**

1. **Frontend not sending locationId**
   ```javascript
   // Check request interceptor
   console.log('Request config:', config);
   
   // Manually add for testing
   const response = await api.get('/contacts', {
     params: { locationId: 'loc_xxx' }
   });
   ```

2. **User data not stored properly**
   ```javascript
   // Check stored auth data
   const userData = localStorage.getItem('userData');
   console.log('Stored user data:', JSON.parse(userData));
   ```

#### Issue: "Resource not found or access denied"
```json
{
  "error": "Contact not found or access denied"
}
```

**Solutions:**

1. **Wrong locationId in request**
   ```javascript
   // Verify resource belongs to location
   db.contacts.findOne({
     _id: ObjectId("..."),
     locationId: "correct_location_id"
   });
   ```

2. **Invalid ObjectId format**
   ```javascript
   // Validate ID format
   const { ObjectId } = require('mongodb');
   if (!ObjectId.isValid(id)) {
     console.error('Invalid ID format:', id);
   }
   ```

### GHL Integration Issues

#### Issue: "Failed to sync with GHL" (422)
```json
{
  "error": "Failed to sync with GHL",
  "ghlError": {
    "errors": {
      "status": ["Invalid status value"]
    }
  }
}
```

**Solutions:**

1. **Invalid field values**
   ```javascript
   // Check valid GHL statuses
   const VALID_STATUSES = ['open', 'won', 'lost', 'abandoned'];
   
   // Remove invalid fields before sending
   const ghlPayload = {
     name: project.title,
     status: 'open', // Use valid status
     // Don't include custom fields in creation
   };
   ```

2. **Wrong API version**
   ```javascript
   // Use correct version per endpoint
   headers: {
     'Version': '2021-07-28', // For contacts/opportunities
     // 'Version': '2021-04-15', // For calendars/appointments
   }
   ```

3. **Missing or invalid API key**
   ```javascript
   // Test API key
   curl -X GET "https://services.leadconnectorhq.com/locations/search" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Version: 2021-07-28"
   ```

#### Issue: "Contact not found" when syncing

**Solutions:**

1. **Using MongoDB ID instead of GHL ID**
   ```javascript
   // Get GHL contact ID first
   const contact = await db.collection('contacts').findOne({
     _id: ObjectId(mongoContactId)
   });
   const ghlContactId = contact.ghlContactId;
   ```

2. **Contact doesn't exist in GHL**
   ```javascript
   // Create in GHL first if missing
   if (!contact.ghlContactId) {
     const ghlId = await createContactInGHL(contact);
     // Update MongoDB with GHL ID
   }
   ```

### PDF Generation Issues

#### Issue: PDF only generates 1 page
```
Content gets cut off after first page
```

**Current Known Issue - Temporary Solutions:**

1. **Reduce content per section**
   ```javascript
   // Limit line items per section
   const MAX_ITEMS_PER_PAGE = 15;
   ```

2. **Check page boundaries**
   ```javascript
   // In pdfGenerator.js
   if (currentY < margin + 100) {
     // Add new page
     page = pdfDoc.addPage();
     currentY = pageHeight - margin;
   }
   ```

3. **Temporary workaround**
   ```javascript
   // Split into multiple PDFs if needed
   const pages = Math.ceil(lineItems.length / MAX_ITEMS_PER_PAGE);
   ```

### Email Issues

#### Issue: "Failed to send contract email"
```json
{
  "error": "Failed to send contract email",
  "details": "GHL email send failed: 400"
}
```

**Solutions:**

1. **PDF attachment URL not accessible**
   ```javascript
   // For local development, GHL can't access localhost
   // Deploy backend first or use ngrok for testing
   
   // Temporary: Send without attachment
   const payload = {
     type: 'Email',
     contactId: contact.ghlContactId,
     subject: subject,
     html: html,
     // attachments: [] // Comment out for local testing
   };
   ```

2. **Invalid email template variables**
   ```javascript
   // Check all variables are replaced
   console.log('Email HTML:', html);
   // Look for any remaining {variable} patterns
   ```

3. **Resend API issues**
   ```javascript
   // Test Resend connection
   const { Resend } = require('resend');
   const resend = new Resend(process.env.RESEND_API_KEY);
   
   await resend.emails.send({
     from: 'test@yourdomain.com',
     to: 'test@example.com',
     subject: 'Test',
     text: 'Test email'
   });
   ```

### Performance Issues

#### Issue: Slow API responses

**Solutions:**

1. **Missing database indexes**
   ```javascript
   // Check query performance
   db.contacts.find({ locationId: "loc_xxx" }).explain("executionStats");
   
   // Add missing indexes
   db.contacts.createIndex({ locationId: 1, createdAt: -1 });
   ```

2. **Large payload responses**
   ```javascript
   // Use projection to limit fields
   db.collection('projects').find(
     { locationId },
     { projection: { 
       title: 1, 
       status: 1, 
       contactId: 1 
     }}
   );
   ```

3. **No pagination**
   ```javascript
   // Implement pagination
   const page = parseInt(req.query.page) || 1;
   const limit = parseInt(req.query.limit) || 20;
   const skip = (page - 1) * limit;
   
   const results = await db.collection('contacts')
     .find({ locationId })
     .skip(skip)
     .limit(limit)
     .toArray();
   ```

### Deployment Issues

#### Issue: "Module not found" after deployment

**Solutions:**

1. **Missing dependencies**
   ```bash
   # Ensure all deps are in package.json
   yarn add missing-package
   
   # Clear cache and rebuild
   rm -rf node_modules .next
   yarn install
   yarn build
   ```

2. **Case sensitivity issues**
   ```javascript
   // Linux is case-sensitive, Windows/Mac aren't
   // Wrong: import from '@/Lib/mongodb'
   // Right: import from '@/lib/mongodb'
   ```

#### Issue: Environment variables not loading

**Solutions:**

1. **Vercel deployment**
   ```bash
   # Add all env vars via CLI or dashboard
   vercel env add MONGODB_URI production
   vercel env add JWT_SECRET production
   ```

2. **Check variable names**
   ```javascript
   // .env.local
   MONGODB_URI=...  // Not MONGO_URI
   
   // In code
   process.env.MONGODB_URI // Must match exactly
   ```

## Debugging Tools & Techniques

### 1. Enable Detailed Logging

```javascript
// Add to API routes for debugging
console.log('📥 Incoming request:', {
  method: req.method,
  url: req.url,
  headers: req.headers,
  body: req.body,
  query: req.query
});

// Log outgoing responses
console.log('📤 Sending response:', {
  status: res.statusCode,
  data: responseData
});
```

### 2. MongoDB Query Debugging

```javascript
// Enable MongoDB query logging
const { MongoClient } = require('mongodb');

const client = new MongoClient(uri, {
  monitorCommands: true
});

client.on('commandStarted', (event) => {
  console.log('MongoDB Query:', event);
});
```

### 3. API Request Debugging

```javascript
// Add request ID for tracing
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  console.log(`[${req.id}] ${req.method} ${req.url}`);
  next();
});

// Log response time
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.id}] Completed in ${duration}ms`);
  });
  next();
});
```

### 4. Memory Leak Detection

```javascript
// Monitor memory usage
setInterval(() => {
  const used = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
  });
}, 30000);
```

## Error Recovery Procedures

### 1. Database Recovery

```bash
# If database is corrupted
# 1. Stop application
pm2 stop lpai-backend

# 2. Restore from backup
mongorestore --uri="$MONGODB_URI" --drop backup/

# 3. Verify data integrity
mongo "$MONGODB_URI" --eval "db.contacts.count()"

# 4. Restart application
pm2 start lpai-backend
```

### 2. Clear Application Cache

```javascript
// Clear all caches
const clearAllCaches = async () => {
  // Clear pipeline cache
  pipelineCache.clear();
  
  // Clear calendar cache  
  calendarCache.clear();
  
  // Clear user sessions
  activeSessions.clear();
  
  console.log('All caches cleared');
};
```

### 3. Reset User Authentication

```javascript
// Force logout all users
async function forceLogoutAllUsers(locationId) {
  // Clear all sessions for location
  await db.collection('sessions').deleteMany({ locationId });
  
  // Optionally update users
  await db.collection('users').updateMany(
    { locationId },
    { $set: { forceReauth: true } }
  );
}
```

## Monitoring Checklist

### Daily Checks
- [ ] API health endpoint responding
- [ ] Database connection stable
- [ ] No error spikes in logs
- [ ] Disk space > 20% free
- [ ] Memory usage < 80%

### Weekly Checks
- [ ] Backup integrity test
- [ ] GHL sync success rate > 95%
- [ ] Average response time < 500ms
- [ ] Failed login attempts review
- [ ] Error log analysis

### Monthly Checks
- [ ] Security updates applied
- [ ] Dependencies updated
- [ ] Database indexes optimized
- [ ] Unused data cleaned up
- [ ] Performance metrics review

## Emergency Contacts

### System Down
1. Check service status: `pm2 status`
2. Check error logs: `pm2 logs --err`
3. Restart service: `pm2 restart lpai-backend`
4. If persists, check MongoDB connection

### Data Loss
1. Stop all writes immediately
2. Identify last good backup
3. Restore from backup
4. Verify data integrity
5. Investigate root cause

### Security Breach
1. Revoke all API keys
2. Force logout all users
3. Change JWT_SECRET
4. Audit access logs
5. Notify affected users

## Useful Commands

```bash
# View real-time logs
pm2 logs lpai-backend --lines 100

# Check MongoDB connection
mongosh "$MONGODB_URI" --eval "db.serverStatus()"

# Test API endpoint
time curl -X GET "http://localhost:3000/api/health"

# Check process memory
ps aux | grep node

# Find large files
find . -type f -size +10M

# Clear Next.js cache
rm -rf .next

# Rebuild and restart
yarn build && pm2 restart lpai-backend
```

## Getting Help

### Before Asking for Help

1. **Check logs** - Most issues are revealed in logs
2. **Reproduce the issue** - Can you make it happen again?
3. **Isolate the problem** - Which component is failing?
4. **Try basic fixes** - Restart, clear cache, check connections

### Information to Provide

When reporting issues, include:

1. **Error message** (exact text)
2. **Steps to reproduce**
3. **Environment** (local/staging/production)
4. **Recent changes** (deployments, config updates)
5. **Relevant logs** (API, database, server)
6. **Browser/device** (for frontend issues)

### Support Channels

1. **GitHub Issues** - For bugs and feature requests
2. **Slack** - For quick questions
3. **Email** - For security issues
4. **Documentation** - Always check docs first!