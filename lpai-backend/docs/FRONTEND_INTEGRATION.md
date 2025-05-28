# Frontend Integration Guide

## Overview

This guide explains how to integrate both React Native (mobile) and Next.js (web) frontends with the LPai backend. The backend is designed to serve both platforms with the same API endpoints.

## Core Integration Principles

1. **Single API, Multiple Clients**: Same endpoints serve both mobile and web
2. **Location-Based Isolation**: Every request must include `locationId`
3. **Token-Based Auth**: JWT tokens for stateless authentication
4. **Optimistic Updates**: Update UI immediately, sync in background
5. **Offline Support**: Cache data locally for offline access (mobile)

## API Client Setup

### React Native (Mobile)

#### 1. Install Dependencies

```bash
yarn add axios react-native-async-storage
yarn add react-query # Optional but recommended
```

#### 2. Create API Client

```javascript
// src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE_URL = Platform.select({
  ios: 'http://localhost:3000/api',
  android: 'http://10.0.2.2:3000/api', // Android emulator
  default: 'https://api.lpai.com/api'   // Production
});

class ApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        // Add auth token
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add locationId to all requests
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const { locationId } = JSON.parse(userData);
          
          // For GET requests, add to params
          if (config.method === 'get') {
            config.params = { ...config.params, locationId };
          } 
          // For other methods, add to body
          else if (config.data && typeof config.data === 'object') {
            config.data = { ...config.data, locationId };
          }
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response.data,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired - clear auth and redirect to login
          await this.clearAuth();
          // Navigate to login (you'll need to implement navigation)
          // NavigationService.navigate('Login');
        }
        
        return Promise.reject(error.response?.data || error);
      }
    );
  }

  async saveAuth(authData) {
    await AsyncStorage.setItem('authToken', authData.token);
    await AsyncStorage.setItem('userData', JSON.stringify({
      userId: authData.userId,
      locationId: authData.locationId,
      name: authData.name,
      role: authData.role,
      email: authData.email
    }));
  }

  async clearAuth() {
    await AsyncStorage.multiRemove(['authToken', 'userData']);
  }

  async getStoredAuth() {
    const token = await AsyncStorage.getItem('authToken');
    const userData = await AsyncStorage.getItem('userData');
    
    if (!token || !userData) return null;
    
    return {
      token,
      ...JSON.parse(userData)
    };
  }

  // Auth endpoints
  async login(email, password) {
    const response = await this.client.post('/login', { email, password });
    await this.saveAuth(response);
    return response;
  }

  async logout() {
    await this.clearAuth();
  }

  // Contact endpoints
  async getContacts(params = {}) {
    return this.client.get('/contacts', { params });
  }

  async createContact(data) {
    return this.client.post('/contacts', data);
  }

  async updateContact(id, data) {
    return this.client.patch(`/contacts/${id}`, data);
  }

  // Project endpoints
  async getProjects(params = {}) {
    return this.client.get('/projects', { params });
  }

  async getProject(id) {
    const auth = await this.getStoredAuth();
    return this.client.get(`/projects/${id}`, {
      params: { locationId: auth.locationId }
    });
  }

  async createProject(data) {
    return this.client.post('/projects', data);
  }

  async updateProject(id, data) {
    const auth = await this.getStoredAuth();
    return this.client.patch(`/projects/${id}?locationId=${auth.locationId}`, data);
  }

  // Quote endpoints
  async getQuotes(params = {}) {
    return this.client.get('/quotes', { params });
  }

  async createQuote(data) {
    return this.client.post('/quotes', data);
  }

  async signQuote(id, signatureData) {
    return this.client.post(`/quotes/${id}/sign`, signatureData);
  }

  async generateQuotePDF(id) {
    const auth = await this.getStoredAuth();
    return this.client.post(`/quotes/${id}/pdf`, {
      locationId: auth.locationId
    });
  }

  // Appointment endpoints
  async getAppointments(params = {}) {
    return this.client.get('/appointments', { params });
  }

  async createAppointment(data) {
    return this.client.post('/appointments', data);
  }

  async updateAppointment(id, data) {
    return this.client.patch(`/appointments/${id}`, data);
  }

  // Location data
  async getLocationData() {
    const auth = await this.getStoredAuth();
    return this.client.get('/locations/byLocation', {
      params: { locationId: auth.locationId }
    });
  }

  // GHL sync
  async syncPipelines() {
    const auth = await this.getStoredAuth();
    return this.client.get(`/ghl/pipelines/${auth.locationId}`);
  }

  async syncCalendars() {
    const auth = await this.getStoredAuth();
    return this.client.get(`/ghl/calendars/${auth.locationId}`);
  }
}

export default new ApiClient();
```

#### 3. Using with React Query (Recommended)

```javascript
// src/hooks/useContacts.js
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';

export function useContacts() {
  return useQuery('contacts', () => api.getContacts(), {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  
  return useMutation(
    (data) => api.createContact(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('contacts');
      },
    }
  );
}

// Usage in component
function ContactList() {
  const { data: contacts, isLoading, error } = useContacts();
  const createContact = useCreateContact();
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <FlatList
      data={contacts}
      renderItem={({ item }) => <ContactCard contact={item} />}
    />
  );
}
```

### Next.js (Web)

#### 1. Create API Client

```typescript
// lib/api-client.ts
import axios, { AxiosInstance } from 'axios';

interface AuthData {
  token: string;
  userId: string;
  locationId: string;
  name: string;
  role: string;
  email: string;
}

class ApiClient {
  private client: AxiosInstance;
  private authData: AuthData | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadAuthFromStorage();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token
        if (this.authData?.token) {
          config.headers.Authorization = `Bearer ${this.authData.token}`;
        }

        // Add locationId
        if (this.authData?.locationId) {
          if (config.method === 'get') {
            config.params = { ...config.params, locationId: this.authData.locationId };
          } else if (config.data) {
            config.data = { ...config.data, locationId: this.authData.locationId };
          }
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response?.status === 401) {
          this.clearAuth();
          window.location.href = '/login';
        }
        return Promise.reject(error.response?.data || error);
      }
    );
  }

  private loadAuthFromStorage() {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('userData');
      
      if (token && userData) {
        this.authData = {
          token,
          ...JSON.parse(userData),
        };
      }
    }
  }

  saveAuth(data: AuthData) {
    this.authData = data;
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('userData', JSON.stringify({
        userId: data.userId,
        locationId: data.locationId,
        name: data.name,
        role: data.role,
        email: data.email,
      }));
    }
  }

  clearAuth() {
    this.authData = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
    }
  }

  // API methods (same as mobile)
  async login(email: string, password: string) {
    const response = await this.client.post('/login', { email, password });
    this.saveAuth(response as AuthData);
    return response;
  }

  // ... rest of methods same as mobile
}

export const apiClient = new ApiClient();
```

#### 2. Server-Side Data Fetching

```typescript
// pages/contacts.tsx (Pages Router)
import { GetServerSideProps } from 'next';
import { Contact } from '@/types';

interface Props {
  contacts: Contact[];
}

export default function ContactsPage({ contacts }: Props) {
  return (
    <div>
      {contacts.map(contact => (
        <ContactCard key={contact._id} contact={contact} />
      ))}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Get auth from cookies
  const token = context.req.cookies.authToken;
  const userData = context.req.cookies.userData;
  
  if (!token || !userData) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }
  
  const { locationId } = JSON.parse(userData);
  
  try {
    const response = await fetch(`${process.env.API_URL}/api/contacts?locationId=${locationId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    const contacts = await response.json();
    
    return {
      props: { contacts },
    };
  } catch (error) {
    return {
      props: { contacts: [] },
    };
  }
};
```

#### 3. Client-Side Data Fetching with SWR

```typescript
// hooks/useContacts.ts
import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

export function useContacts() {
  const { data, error, mutate } = useSWR(
    'contacts',
    () => apiClient.getContacts(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    contacts: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

// Usage in component
export default function ContactsPage() {
  const { contacts, isLoading, isError } = useContacts();
  
  if (isLoading) return <Spinner />;
  if (isError) return <ErrorMessage />;
  
  return <ContactList contacts={contacts} />;
}
```

## Data Management Patterns

### 1. Optimistic Updates

```javascript
// React Native Example
async function updateProjectStatus(projectId, newStatus) {
  // 1. Update UI immediately
  setProjects(prev => 
    prev.map(p => p._id === projectId ? { ...p, status: newStatus } : p)
  );
  
  try {
    // 2. Send to backend
    await api.updateProject(projectId, { status: newStatus });
  } catch (error) {
    // 3. Revert on failure
    setProjects(prev => 
      prev.map(p => p._id === projectId ? { ...p, status: p.status } : p)
    );
    Alert.alert('Error', 'Failed to update project status');
  }
}
```

### 2. Offline Support (Mobile)

```javascript
// src/services/offlineQueue.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

class OfflineQueue {
  constructor() {
    this.QUEUE_KEY = 'offline_queue';
    this.setupNetworkListener();
  }

  setupNetworkListener() {
    NetInfo.addEventListener(state => {
      if (state.isConnected) {
        this.processQueue();
      }
    });
  }

  async addToQueue(request) {
    const queue = await this.getQueue();
    queue.push({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...request
    });
    await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  }

  async getQueue() {
    const queue = await AsyncStorage.getItem(this.QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  }

  async processQueue() {
    const queue = await this.getQueue();
    const failed = [];

    for (const request of queue) {
      try {
        await this.executeRequest(request);
      } catch (error) {
        failed.push(request);
      }
    }

    // Save failed requests back to queue
    await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(failed));
  }

  async executeRequest(request) {
    const { method, endpoint, data } = request;
    return api[method](endpoint, data);
  }
}

export default new OfflineQueue();
```

### 3. Real-Time Updates (Future)

```javascript
// WebSocket connection for real-time updates
class RealtimeService {
  constructor() {
    this.ws = null;
    this.subscribers = new Map();
  }

  connect(locationId, token) {
    this.ws = new WebSocket(`wss://api.lpai.com/ws?token=${token}`);
    
    this.ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      this.notifySubscribers(type, data);
    };
    
    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ 
        type: 'subscribe', 
        locationId 
      }));
    };
  }

  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(event)?.delete(callback);
    };
  }

  notifySubscribers(event, data) {
    this.subscribers.get(event)?.forEach(callback => {
      callback(data);
    });
  }
}

// Usage
const realtime = new RealtimeService();

// In component
useEffect(() => {
  const unsubscribe = realtime.subscribe('project.updated', (data) => {
    // Update local state
    updateProject(data.projectId, data.updates);
  });
  
  return unsubscribe;
}, []);
```

## State Management

### React Native with Context

```javascript
// src/contexts/AppContext.js
import React, { createContext, useContext, useReducer } from 'react';

const AppContext = createContext();

const initialState = {
  user: null,
  location: null,
  contacts: [],
  projects: [],
  appointments: [],
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_LOCATION':
      return { ...state, location: action.payload };
    case 'SET_CONTACTS':
      return { ...state, contacts: action.payload };
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.payload] };
    case 'UPDATE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.map(c => 
          c._id === action.payload._id ? action.payload : c
        ),
      };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
```

### Next.js with Zustand

```typescript
// stores/appStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AppState {
  user: User | null;
  location: Location | null;
  contacts: Contact[];
  projects: Project[];
  
  // Actions
  setUser: (user: User | null) => void;
  setLocation: (location: Location) => void;
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        location: null,
        contacts: [],
        projects: [],
        
        setUser: (user) => set({ user }),
        setLocation: (location) => set({ location }),
        setContacts: (contacts) => set({ contacts }),
        addContact: (contact) => set((state) => ({ 
          contacts: [...state.contacts, contact] 
        })),
        updateContact: (id, updates) => set((state) => ({
          contacts: state.contacts.map(c => 
            c._id === id ? { ...c, ...updates } : c
          ),
        })),
      }),
      {
        name: 'app-store',
        partialize: (state) => ({ user: state.user }),
      }
    )
  )
);
```

## File Uploads

### Mobile File Upload

```javascript
// React Native with react-native-image-picker
import { launchImageLibrary } from 'react-native-image-picker';

async function uploadProjectPhoto(projectId, photo) {
  const formData = new FormData();
  formData.append('photo', {
    uri: photo.uri,
    type: photo.type,
    name: photo.fileName,
  });
  formData.append('projectId', projectId);
  formData.append('locationId', auth.locationId);
  
  const response = await fetch(`${API_URL}/projects/${projectId}/photos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.token}`,
    },
    body: formData,
  });
  
  return response.json();
}
```

### Web File Upload

```typescript
// Next.js file upload
async function uploadFile(file: File, projectId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectId', projectId);
  
  const response = await fetch(`/api/projects/${projectId}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  return response.json();
}

// Component
function FileUpload({ projectId }) {
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      await uploadFile(file, projectId);
      toast.success('File uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload file');
    }
  };
  
  return (
    <input
      type="file"
      onChange={handleFileChange}
      accept=".pdf,.doc,.docx,.jpg,.png"
    />
  );
}
```

## Error Handling

### Consistent Error Display

```javascript
// Mobile Error Boundary
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text>Something went wrong</Text>
          <Button title="Try Again" onPress={() => this.setState({ hasError: false })} />
        </View>
      );
    }
    
    return this.props.children;
  }
}
```

### API Error Handling

```javascript
// Centralized error handler
function handleApiError(error) {
  const message = error?.message || 'An unexpected error occurred';
  
  // Check for specific error types
  if (error?.code === 'NETWORK_ERROR') {
    return 'Please check your internet connection';
  }
  
  if (error?.code === 'VALIDATION_ERROR') {
    return error.details || 'Please check your input';
  }
  
  if (error?.status === 403) {
    return 'You do not have permission to perform this action';
  }
  
  return message;
}

// Usage
try {
  await api.createContact(data);
} catch (error) {
  const errorMessage = handleApiError(error);
  // Mobile
  Alert.alert('Error', errorMessage);
  // Web
  toast.error(errorMessage);
}
```

## Performance Optimization

### 1. Data Caching

```javascript
// Mobile with React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

### 2. Pagination

```javascript
// Infinite scroll implementation
function ContactList() {
  const [page, setPage] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  
  const loadMore = async () => {
    if (!hasMore) return;
    
    const response = await api.getContacts({ 
      page, 
      limit: 20 
    });
    
    if (response.data.length < 20) {
      setHasMore(false);
    }
    
    setContacts(prev => [...prev, ...response.data]);
    setPage(prev => prev + 1);
  };
  
  return (
    <FlatList
      data={contacts}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      renderItem={({ item }) => <ContactCard contact={item} />}
    />
  );
}
```

### 3. Image Optimization

```javascript
// Mobile image caching
import FastImage from 'react-native-fast-image';

<FastImage
  source={{ 
    uri: imageUrl,
    priority: FastImage.priority.normal,
  }}
  style={styles.image}
  resizeMode={FastImage.resizeMode.cover}
/>

// Web image optimization
import Image from 'next/image';

<Image
  src={imageUrl}
  alt="Description"
  width={300}
  height={200}
  loading="lazy"
  placeholder="blur"
/>
```

## Testing Integration

### Mobile Testing

```javascript
// __tests__/api.test.js
import MockAdapter from 'axios-mock-adapter';
import api from '../src/services/api';

describe('API Client', () => {
  let mock;
  
  beforeEach(() => {
    mock = new MockAdapter(api.client);
  });
  
  afterEach(() => {
    mock.restore();
  });
  
  test('should add locationId to GET requests', async () => {
    mock.onGet('/contacts').reply(200, []);
    
    await api.getContacts();
    
    expect(mock.history.get[0].params).toHaveProperty('locationId');
  });
});
```

### Web Testing

```typescript
// __tests__/api-client.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useContacts } from '@/hooks/useContacts';
import { SWRConfig } from 'swr';

const wrapper = ({ children }) => (
  <SWRConfig value={{ dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

describe('useContacts', () => {
  it('should fetch contacts', async () => {
    const { result } = renderHook(() => useContacts(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.contacts).toBeDefined();
    });
  });
});
```

## Migration Guide

### From Direct GHL Integration

If migrating from direct GHL API calls:

```javascript
// OLD: Direct GHL call
const response = await fetch('https://rest.gohighlevel.com/v1/contacts', {
  headers: { Authorization: `Bearer ${ghlApiKey}` }
});

// NEW: Use LPai backend
const response = await api.getContacts();
// Backend handles GHL sync automatically
```

### From Other CRM Systems

1. **Export existing data** to CSV/JSON
2. **Map fields** to LPai schema
3. **Use bulk import endpoints** (if available)
4. **Verify data integrity** after import

## Troubleshooting

### Common Integration Issues

1. **"Missing locationId" errors**
   - Ensure auth data includes locationId
   - Check interceptor is adding locationId
   - Verify locationId in localStorage/AsyncStorage

2. **CORS errors (web)**
   - Check backend CORS configuration
   - Ensure correct origin is whitelisted
   - Use proxy in development

3. **Token expiration**
   - Implement token refresh logic
   - Handle 401 responses gracefully
   - Clear auth and redirect to login

4. **Slow API responses**
   - Implement loading states
   - Use optimistic updates
   - Cache frequently accessed data

5. **File upload failures**
   - Check file size limits
   - Verify multipart form data
   - Ensure proper headers