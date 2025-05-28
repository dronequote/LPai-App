# Authentication & Security

## Overview

LPai uses JWT (JSON Web Token) based authentication with location-based access control for multi-tenant security. Every request must be authenticated and authorized for the specific location (tenant).

## Authentication Flow

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Client     │     │   Backend   │     │   MongoDB    │
│ (Mobile/Web) │     │   API       │     │              │
└──────┬───────┘     └──────┬──────┘     └──────┬───────┘
       │                     │                    │
       │  1. POST /api/login │                    │
       │  {email, password}  │                    │
       ├────────────────────>│                    │
       │                     │  2. Find user      │
       │                     ├───────────────────>│
       │                     │                    │
       │                     │  3. Return user    │
       │                     │<───────────────────│
       │                     │                    │
       │                     │ 4. Verify password │
       │                     │    Generate JWT    │
       │                     │                    │
       │  5. Return token    │                    │
       │<────────────────────│                    │
       │                     │                    │
       │  6. Include token   │                    │
       │  in all requests    │                    │
       ├────────────────────>│                    │
       │                     │                    │
```

## JWT Token Structure

### Token Payload

```javascript
{
  // User identification
  userId: "ghl_user_id",        // GHL user ID
  _id: "mongodb_user_id",       // MongoDB ObjectId
  email: "user@example.com",
  name: "John Doe",
  
  // Multi-tenant isolation
  locationId: "loc_xxx",        // CRITICAL: Tenant identifier
  
  // Permissions
  role: "admin",                // "admin", "user", "viewer"
  permissions: ["read", "write"],
  
  // Token metadata
  iat: 1735391400,              // Issued at
  exp: 1735996200               // Expires at (7 days)
}
```

### Token Generation

```javascript
// Backend: /api/login endpoint
const JWT_SECRET = process.env.JWT_SECRET; // Minimum 32 characters

const payload = {
  userId: user.ghlUserId,
  locationId: user.locationId,
  name: user.name,
  permissions: user.permissions || [],
  role: user.role || 'user',
  _id: user._id,
  email: user.email
};

const token = jwt.sign(payload, JWT_SECRET, { 
  expiresIn: '7d' 
});
```

## Security Implementation

### 1. Password Security

```javascript
// Password hashing with bcrypt
const bcrypt = require('bcryptjs');

// When creating/updating user
const hashedPassword = await bcrypt.hash(plainPassword, 10);

// When verifying login
const isMatch = await bcrypt.compare(plainPassword, user.hashedPassword);
```

### 2. Token Validation Middleware

```javascript
// Middleware for protected routes
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}
```

### 3. Location-Based Access Control

```javascript
// CRITICAL: Every API endpoint must validate locationId
async function validateLocationAccess(req, res, next) {
  const requestLocationId = req.query.locationId || req.body.locationId;
  const userLocationId = req.user.locationId;
  
  if (!requestLocationId) {
    return res.status(400).json({ error: 'Missing locationId' });
  }
  
  if (requestLocationId !== userLocationId) {
    return res.status(403).json({ error: 'Access denied to this location' });
  }
  
  next();
}
```

### 4. Role-Based Permissions

```javascript
// Permission levels
const ROLES = {
  admin: ['read', 'write', 'delete', 'manage_users', 'manage_settings'],
  user: ['read', 'write'],
  viewer: ['read']
};

// Check specific permission
function hasPermission(user, permission) {
  const rolePermissions = ROLES[user.role] || [];
  return rolePermissions.includes(permission) || 
         (user.permissions && user.permissions.includes(permission));
}

// Middleware for permission check
function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
```

## Frontend Implementation

### 1. Storing Token (React Native)

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// After successful login
const loginResponse = await api.post('/api/login', { email, password });
await AsyncStorage.setItem('authToken', loginResponse.token);
await AsyncStorage.setItem('userData', JSON.stringify({
  userId: loginResponse.userId,
  locationId: loginResponse.locationId,
  name: loginResponse.name,
  role: loginResponse.role
}));
```

### 2. Including Token in Requests

```javascript
// Axios interceptor for automatic token inclusion
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.lpai.com'
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Always include locationId
    const userData = await AsyncStorage.getItem('userData');
    if (userData) {
      const { locationId } = JSON.parse(userData);
      if (config.method === 'get') {
        config.params = { ...config.params, locationId };
      } else {
        config.data = { ...config.data, locationId };
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      // Navigate to login screen
      navigationRef.current?.navigate('Login');
    }
    return Promise.reject(error);
  }
);
```

### 3. Web Application (Next.js)

```javascript
// For web apps, use httpOnly cookies or localStorage
// utils/auth.js
export const setAuthToken = (token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', token);
  }
};

export const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken');
  }
  return null;
};

export const clearAuth = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
  }
};

// API client setup
const apiClient = {
  async request(method, endpoint, data = null) {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
    
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const locationId = userData.locationId;
    
    // Include locationId in all requests
    if (method === 'GET' && locationId) {
      endpoint += `${endpoint.includes('?') ? '&' : '?'}locationId=${locationId}`;
    } else if (data && locationId) {
      data.locationId = locationId;
    }
    
    const response = await fetch(`/api${endpoint}`, {
      method,
      headers,
      ...(data && { body: JSON.stringify(data) })
    });
    
    if (response.status === 401) {
      clearAuth();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
      throw await response.json();
    }
    
    return response.json();
  }
};
```

## Security Best Practices

### 1. Environment Variables

```bash
# .env.local
JWT_SECRET=your-super-secret-key-minimum-32-characters
MONGODB_URI=mongodb+srv://...
BCRYPT_ROUNDS=10
TOKEN_EXPIRY=7d
```

### 2. HTTPS Only

- Always use HTTPS in production
- Set secure headers
- Enable CORS only for trusted origins

```javascript
// Next.js API route security headers
export default async function handler(req, res) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // CORS for specific origins
  const allowedOrigins = [
    'https://app.lpai.com',
    'https://web.lpai.com'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  // ... rest of handler
}
```

### 3. Rate Limiting

```javascript
// Implement rate limiting for login attempts
const loginAttempts = new Map();

function rateLimitLogin(email) {
  const key = email.toLowerCase();
  const attempts = loginAttempts.get(key) || { count: 0, resetAt: Date.now() + 900000 }; // 15 min
  
  if (Date.now() > attempts.resetAt) {
    attempts.count = 0;
    attempts.resetAt = Date.now() + 900000;
  }
  
  attempts.count++;
  loginAttempts.set(key, attempts);
  
  if (attempts.count > 5) {
    throw new Error('Too many login attempts. Please try again later.');
  }
}
```

### 4. Input Validation

```javascript
// Validate all inputs
const { body, validationResult } = require('express-validator');

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).trim(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
```

### 5. Session Management

```javascript
// Track active sessions
const activeSessions = new Map();

// On login
function createSession(userId, token) {
  const sessions = activeSessions.get(userId) || new Set();
  sessions.add(token);
  activeSessions.set(userId, sessions);
}

// On logout
function destroySession(userId, token) {
  const sessions = activeSessions.get(userId);
  if (sessions) {
    sessions.delete(token);
  }
}

// Validate session
function isSessionValid(userId, token) {
  const sessions = activeSessions.get(userId);
  return sessions && sessions.has(token);
}
```

## Multi-Tenant Security

### 1. Data Isolation

```javascript
// NEVER query without locationId
// BAD
const contacts = await db.collection('contacts').find({}).toArray();

// GOOD
const contacts = await db.collection('contacts').find({ 
  locationId: req.user.locationId 
}).toArray();

// BETTER - Use middleware
async function scopeToLocation(req, res, next) {
  req.locationFilter = { locationId: req.user.locationId };
  next();
}

// In route
const contacts = await db.collection('contacts').find(req.locationFilter).toArray();
```

### 2. Cross-Tenant Prevention

```javascript
// Validate resource ownership
async function validateResourceOwnership(collection, resourceId, locationId) {
  const resource = await db.collection(collection).findOne({
    _id: new ObjectId(resourceId),
    locationId: locationId
  });
  
  if (!resource) {
    throw new Error('Resource not found or access denied');
  }
  
  return resource;
}

// Use in endpoints
app.patch('/api/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const contact = await validateResourceOwnership(
      'contacts', 
      req.params.id, 
      req.user.locationId
    );
    
    // Proceed with update...
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});
```

### 3. API Key Management (GHL)

```javascript
// Store encrypted API keys
const crypto = require('crypto');

const algorithm = 'aes-256-gcm';
const secretKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes

function encryptApiKey(apiKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decryptApiKey(encryptedData) {
  const decipher = crypto.createDecipheriv(
    algorithm, 
    secretKey, 
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

## Security Checklist

### Backend Security

- [ ] JWT secret is strong (32+ characters)
- [ ] Passwords are bcrypt hashed (never plain text)
- [ ] All endpoints require authentication (except /login)
- [ ] All endpoints validate locationId
- [ ] Rate limiting on login attempts
- [ ] Input validation on all endpoints
- [ ] HTTPS enforced in production
- [ ] CORS configured properly
- [ ] Security headers set
- [ ] API keys encrypted in database
- [ ] MongoDB connection uses SSL
- [ ] Environment variables not in git

### Frontend Security

- [ ] Token stored securely (AsyncStorage/localStorage)
- [ ] Token included in all API requests
- [ ] LocationId included in all requests
- [ ] Token cleared on logout
- [ ] Auto-logout on 401 responses
- [ ] Sensitive data not logged
- [ ] Deep linking validates auth
- [ ] No hardcoded credentials
- [ ] API base URL from environment

### Operational Security

- [ ] Regular security audits
- [ ] Dependency updates
- [ ] Access logs monitored
- [ ] Failed login monitoring
- [ ] Session management
- [ ] Password reset flow secure
- [ ] 2FA implementation (planned)
- [ ] Security incident response plan

## Common Security Issues & Solutions

### Issue 1: Token Expiration Handling

```javascript
// Solution: Implement token refresh or graceful re-login
class AuthManager {
  async makeAuthenticatedRequest(method, url, data) {
    try {
      return await this.apiCall(method, url, data);
    } catch (error) {
      if (error.status === 401) {
        // Token expired
        await this.refreshToken();
        // Retry request
        return await this.apiCall(method, url, data);
      }
      throw error;
    }
  }
}
```

### Issue 2: Cross-Site Request Forgery (CSRF)

```javascript
// Solution: Use CSRF tokens for state-changing operations
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

app.post('/api/sensitive-action', csrfProtection, (req, res) => {
  // Action protected by CSRF token
});
```

### Issue 3: SQL/NoSQL Injection

```javascript
// Solution: Always use parameterized queries
// BAD
const user = await db.collection('users').findOne({
  email: req.body.email // Direct insertion
});

// GOOD
const user = await db.collection('users').findOne({
  email: { $eq: req.body.email } // Explicit operator
});

// Use MongoDB ObjectId validation
if (!ObjectId.isValid(id)) {
  return res.status(400).json({ error: 'Invalid ID format' });
}
```

## Monitoring & Alerts

### Security Events to Monitor

1. **Failed login attempts** - Alert on multiple failures
2. **Token validation failures** - Could indicate attack
3. **Cross-tenant access attempts** - Critical security breach
4. **Unusual API patterns** - Potential data scraping
5. **Password reset requests** - Account takeover attempts

### Logging Best Practices

```javascript
// Security event logging
function logSecurityEvent(event, userId, details) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    userId,
    details,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  }));
  
  // Send to monitoring service
  // await sendToDatadog(event, details);
}

// Usage
logSecurityEvent('failed_login', email, { reason: 'invalid_password' });
logSecurityEvent('cross_tenant_attempt', userId, { 
  attempted: targetLocationId,
  authorized: userLocationId 
});
```

## Future Security Enhancements

1. **Two-Factor Authentication (2FA)**
   - SMS or authenticator app
   - Backup codes
   - Remember device option

2. **OAuth Integration**
   - Google OAuth
   - Microsoft OAuth
   - SSO for enterprise

3. **Advanced Session Management**
   - Device tracking
   - Session invalidation
   - Concurrent session limits

4. **API Key Management**
   - Per-user API keys
   - Key rotation
   - Usage analytics

5. **Audit Logging**
   - Complete audit trail
   - Compliance reporting
   - Data retention policies