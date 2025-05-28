# Setup & Deployment Guide

## Prerequisites

- Node.js 18+ and Yarn
- MongoDB Atlas account (or local MongoDB)
- GoHighLevel account with API access
- Vercel account (for deployment) or alternative hosting
- Git repository access

## Local Development Setup

### 1. Clone Repository

```bash
git clone [repository-url]
cd lpai-backend
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Environment Configuration

Create `.env.local` file in the root directory:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/lpai?retryWrites=true&w=majority

# Security
JWT_SECRET=your-super-secret-key-minimum-32-characters-long
ENCRYPTION_KEY=64-character-hex-string-for-api-key-encryption

# Email Service (if using Resend)
RESEND_API_KEY=re_your_resend_api_key
ADMIN_EMAIL=admin@yourdomain.com

# Application URLs
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Development Settings
NODE_ENV=development
PORT=3000
```

### 4. MongoDB Setup

#### Atlas Configuration

1. Create a new cluster on MongoDB Atlas
2. Create database user with read/write permissions
3. Add your IP address to the whitelist (or allow all for development)
4. Get connection string and update `MONGODB_URI`

#### Create Indexes

Connect to your MongoDB and run:

```javascript
// Connect to 'lpai' database
use lpai;

// Contacts indexes
db.contacts.createIndex({ locationId: 1, email: 1 }, { unique: true });
db.contacts.createIndex({ locationId: 1, createdAt: -1 });
db.contacts.createIndex({ ghlContactId: 1 });
db.contacts.createIndex({ locationId: 1, "$**": "text" });

// Projects indexes
db.projects.createIndex({ locationId: 1, contactId: 1 });
db.projects.createIndex({ locationId: 1, status: 1 });
db.projects.createIndex({ locationId: 1, createdAt: -1 });
db.projects.createIndex({ ghlOpportunityId: 1 });

// Quotes indexes
db.quotes.createIndex({ locationId: 1, projectId: 1 });
db.quotes.createIndex({ locationId: 1, status: 1 });
db.quotes.createIndex({ webLinkToken: 1 });
db.quotes.createIndex({ quoteNumber: 1 }, { unique: true });

// Appointments indexes
db.appointments.createIndex({ locationId: 1, start: 1 });
db.appointments.createIndex({ locationId: 1, userId: 1 });
db.appointments.createIndex({ ghlAppointmentId: 1 });

// Users indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ locationId: 1 });

// Locations index
db.locations.createIndex({ locationId: 1 }, { unique: true });
```

### 5. Initial Data Setup

#### Create Test Location

```bash
# Run MongoDB shell or use MongoDB Compass
```

```javascript
db.locations.insertOne({
  locationId: "loc_test",
  name: "Test Company",
  apiKey: "your_ghl_api_key", // Optional for development
  branding: {
    phone: "+1234567890",
    email: "info@testcompany.com",
    address: "123 Main St, City, State 12345"
  },
  termsAndConditions: "Standard terms and conditions for {companyName}...",
  pipelines: [],
  calendars: [],
  features: {
    paymentsEnabled: false,
    invoicingEnabled: false,
    webQuotesEnabled: true
  },
  createdAt: new Date(),
  updatedAt: new Date()
});
```

#### Create Test User

```bash
yarn seed
# Or manually create:
```

```javascript
const bcrypt = require('bcryptjs');

db.users.insertOne({
  email: "admin@test.com",
  hashedPassword: await bcrypt.hash("password123", 10),
  name: "Test Admin",
  locationId: "loc_test",
  role: "admin",
  permissions: ["read", "write", "delete"],
  ghlUserId: "test_user_id", // Optional
  isActive: true,
  createdAt: new Date()
});
```

### 6. Run Development Server

```bash
yarn dev
```

Server will be available at `http://localhost:3000`

Test the API:
```bash
curl http://localhost:3000/api/health
```

## Production Deployment

### Option 1: Vercel Deployment (Recommended)

#### 1. Install Vercel CLI

```bash
npm i -g vercel
```

#### 2. Configure Project

Create `vercel.json`:

```json
{
  "buildCommand": "yarn build",
  "outputDirectory": ".next",
  "devCommand": "yarn dev",
  "installCommand": "yarn install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://your-frontend-domain.com"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Authorization, Content-Type"
        }
      ]
    }
  ]
}
```

#### 3. Deploy to Vercel

```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Set environment variables
vercel env add MONGODB_URI
vercel env add JWT_SECRET
vercel env add RESEND_API_KEY
vercel env add ADMIN_EMAIL
```

### Option 2: Docker Deployment

#### 1. Create Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json yarn.lock* ./
RUN yarn --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js
RUN yarn build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
      - RESEND_API_KEY=${RESEND_API_KEY}
      - ADMIN_EMAIL=${ADMIN_EMAIL}
    restart: unless-stopped
```

#### 3. Deploy with Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

### Option 3: Traditional VPS Deployment

#### 1. Server Setup (Ubuntu/Debian)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Yarn
npm install -g yarn

# Install PM2
npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

#### 2. Application Setup

```bash
# Clone repository
cd /var/www
sudo git clone [repository-url] lpai-backend
cd lpai-backend

# Install dependencies
yarn install

# Create .env.local
sudo nano .env.local
# Add your environment variables

# Build application
yarn build

# Start with PM2
pm2 start yarn --name "lpai-backend" -- start
pm2 save
pm2 startup
```

#### 3. Nginx Configuration

Create `/etc/nginx/sites-available/lpai-backend`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/lpai-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 4. SSL Setup with Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) | `your-32-character-secret-key` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `RESEND_API_KEY` | Resend email service key | - |
| `ADMIN_EMAIL` | Admin notification email | - |
| `ENCRYPTION_KEY` | For encrypting API keys | - |
| `NEXT_PUBLIC_API_URL` | Public API URL | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `http://localhost:3000` |

## Health Checks & Monitoring

### 1. Basic Health Check Endpoint

Create `pages/api/health.ts`:

```typescript
export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version
  });
}
```

### 2. Database Health Check

Create `pages/api/health/db.ts`:

```typescript
import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    await client.db().admin().ping();
    
    res.status(200).json({
      status: 'ok',
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
}
```

### 3. Monitoring Setup

#### Uptime Monitoring
- Use services like UptimeRobot, Pingdom, or Better Uptime
- Monitor `/api/health` endpoint
- Set up alerts for downtime

#### Application Monitoring
- Vercel Analytics (if using Vercel)
- Sentry for error tracking
- LogRocket for session replay

#### Example Sentry Setup

```bash
yarn add @sentry/nextjs
```

Create `sentry.client.config.js`:
```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

## Backup & Recovery

### 1. MongoDB Backup Strategy

#### Automated Backups (Atlas)
- Enable automated backups in Atlas
- Set retention period (7-30 days)
- Enable point-in-time recovery

#### Manual Backup Script

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
DB_NAME="lpai"

# Create backup
mongodump --uri="$MONGODB_URI" --db=$DB_NAME --out=$BACKUP_DIR/$DATE

# Compress
tar -czf $BACKUP_DIR/$DATE.tar.gz -C $BACKUP_DIR $DATE

# Remove uncompressed
rm -rf $BACKUP_DIR/$DATE

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

### 2. Restore Procedure

```bash
# Extract backup
tar -xzf backup_file.tar.gz

# Restore to MongoDB
mongorestore --uri="$MONGODB_URI" --db=lpai backup_directory/lpai
```

## Security Checklist

### Pre-Deployment

- [ ] Strong JWT_SECRET (32+ characters)
- [ ] All sensitive data in environment variables
- [ ] MongoDB connection uses SSL
- [ ] API keys encrypted if stored
- [ ] CORS configured for specific domains
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints

### Post-Deployment

- [ ] HTTPS enabled with valid certificate
- [ ] Security headers configured
- [ ] MongoDB IP whitelist configured
- [ ] Monitoring and alerts set up
- [ ] Backup strategy implemented
- [ ] Error logging configured
- [ ] Regular security updates scheduled

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Failed

```
Error: MongoServerError: bad auth
```

**Solution:**
- Verify connection string format
- Check username/password
- Ensure database user has correct permissions
- Check IP whitelist in Atlas

#### 2. JWT Token Invalid

```
Error: JsonWebTokenError: invalid signature
```

**Solution:**
- Ensure JWT_SECRET matches between environments
- Check token hasn't expired
- Verify token format (Bearer prefix)

#### 3. CORS Issues

```
Error: Access to fetch at 'api.domain.com' from origin 'app.domain.com' has been blocked by CORS policy
```

**Solution:**
- Add origin to CORS whitelist
- Check headers configuration
- Ensure preflight requests are handled

#### 4. File Upload Size Limit

```
Error: Request body larger than maxBodySize limit
```

**Solution:**
Add to API route:
```javascript
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
```

## Performance Optimization

### 1. Database Optimization

- Create appropriate indexes
- Use projection to limit returned fields
- Implement pagination for large datasets
- Use aggregation pipelines efficiently

### 2. API Optimization

- Implement caching for static data
- Use compression middleware
- Optimize images before storage
- Implement request batching where appropriate

### 3. Next.js Optimization

```javascript
// next.config.js
module.exports = {
  images: {
    domains: ['your-image-domain.com'],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
};
```

## Scaling Considerations

### Horizontal Scaling

1. **Stateless Design**: Ensure all endpoints are stateless
2. **Session Management**: Use JWT tokens, not server sessions
3. **File Storage**: Use GridFS or S3 for files
4. **Load Balancing**: Use Vercel auto-scaling or nginx

### Database Scaling

1. **Read Replicas**: For read-heavy workloads
2. **Sharding**: For multi-tenant scaling
3. **Caching Layer**: Redis for frequently accessed data
4. **Connection Pooling**: Optimize MongoDB connections

## Maintenance

### Regular Tasks

- **Weekly**: Review error logs, check disk space
- **Monthly**: Update dependencies, review security alerts
- **Quarterly**: Performance audit, backup restoration test
- **Yearly**: Major version upgrades, security audit

### Update Procedure

```bash
# 1. Backup current state
pm2 save

# 2. Pull latest code
git pull origin main

# 3. Install dependencies
yarn install

# 4. Build application
yarn build

# 5. Restart gracefully
pm2 reload lpai-backend
```