# LPai Backend - Unified API for Mobile & Web

A multi-tenant CRM backend built with Next.js, MongoDB, and GoHighLevel integration. This backend serves both the React Native mobile app and the upcoming web application.

## 🚀 Quick Start

1. **Clone and Install**
   ```bash
   git clone [repository-url]
   cd lpai-backend
   yarn install
   ```

2. **Environment Setup**
   ```bash
   cp .env.local.example .env.local
   # Update with your credentials:
   # MONGODB_URI=your_mongodb_connection_string
   # JWT_SECRET=your_jwt_secret
   # RESEND_API_KEY=your_resend_api_key
   # ADMIN_EMAIL=your_admin_email
   ```

3. **Run Development Server**
   ```bash
   yarn dev
   # API available at http://localhost:3000/api
   ```

## 📖 Documentation

- [API Reference](./docs/API_REFERENCE.md) - Complete endpoint documentation
- [Database Schema](./docs/DATABASE_SCHEMA.md) - MongoDB structure and relationships
- [Authentication](./docs/AUTHENTICATION.md) - JWT auth implementation
- [GHL Integration](./docs/GHL_INTEGRATION.md) - GoHighLevel sync patterns
- [Setup & Deployment](./docs/SETUP_DEPLOYMENT.md) - Environment and deployment guide
- [Frontend Integration](./docs/FRONTEND_INTEGRATION.md) - Mobile & web integration patterns
- [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues and fixes

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐
│  React Native   │     │   Web App       │
│     Mobile      │     │  (Next.js)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │  Next.js    │
              │  API Routes │
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐ ┌───▼───┐ ┌────▼────┐
    │ MongoDB │ │GridFS │ │   GHL   │
    │  Atlas  │ │Storage│ │   API   │
    └─────────┘ └───────┘ └─────────┘
```

## 🔑 Key Principles

1. **MongoDB First**: All data flows through MongoDB - it's the single source of truth
2. **Multi-Tenant**: Every request requires `locationId` for data isolation
3. **GHL Sync**: Backend handles all GHL synchronization - frontends never call GHL directly
4. **Modular APIs**: One endpoint per resource, RESTful patterns
5. **Security**: JWT authentication + location-based access control

## 🎯 Current Features

### ✅ Completed
- Complete authentication system with JWT
- Contact management with GHL sync
- Project/Opportunity management
- Appointment scheduling
- Quote creation and presentation
- Digital signature capture
- PDF generation with signatures
- Email automation with templates
- GridFS document storage
- Multi-tenant data isolation

### 🚧 In Progress
- Payment collection integration
- Invoice generation system
- Enhanced reporting

### ⚠️ Known Issues
- PDF generation limited to 1 page (content gets cut off on longer quotes)
- PDF attachments require deployment for GHL email access

## 📁 Project Structure

```
lpai-backend/
├── pages/
│   └── api/           # API routes
├── src/
│   ├── lib/          # Shared utilities
│   └── services/     # Business logic
├── scripts/          # Database seeders
├── .env.local        # Environment variables
├── package.json      # Dependencies
└── tsconfig.json     # TypeScript config
```

## 🛠️ Available Scripts

```bash
yarn dev              # Start development server
yarn build           # Build for production
yarn start           # Start production server
yarn lint            # Run ESLint
yarn seed            # Seed test user
yarn seed:contacts   # Seed test contacts
```

## 🔒 Security Model

1. **Authentication**: JWT tokens with 7-day expiry
2. **Authorization**: Location-based access control
3. **Data Isolation**: All queries filtered by `locationId`
4. **API Security**: All endpoints except `/login` require auth
5. **GHL Integration**: API keys stored per location

## 🚀 Performance Targets

- Signature capture: < 2 seconds
- PDF generation: ~3 seconds
- Email sending: ~2 seconds
- Total quote-to-contract flow: < 2 minutes

## 📊 Success Metrics

- 95%+ signature capture success rate
- Zero unauthorized data access
- Complete audit trails for all actions
- Automatic sync with GHL

## 🤝 Contributing

1. Create feature branch from `main`
2. Follow existing patterns for new endpoints
3. Ensure all queries include `locationId`
4. Update documentation for new features
5. Test with both mobile and web frontends

## 📞 Support

- Technical Issues: Check [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)
- Architecture Questions: See [Frontend Integration](./docs/FRONTEND_INTEGRATION.md)
- API Questions: Refer to [API Reference](./docs/API_REFERENCE.md)