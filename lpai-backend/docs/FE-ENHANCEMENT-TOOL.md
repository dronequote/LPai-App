# Frontend Enhancement Tools Reference

## 🛠️ New Backend Features Available

### 1. **Pagination & Filtering**
All list endpoints now support:
```typescript
// Query Parameters
{
  limit?: number;      // Default: 50
  offset?: number;     // Default: 0
  sortBy?: string;     // Any field name
  sortOrder?: 'asc' | 'desc';
  search?: string;     // Text search
  // Plus entity-specific filters
}

// Response Format
{
  success: true,
  data: [...],
  pagination: {
    total: 150,
    limit: 50,
    offset: 0,
    hasMore: true
  }
}
```

### 2. **Global Search**
```typescript
// Search across all entities
POST /api/search/global
{
  query: "john",
  locationId: "xxx",
  entities: ["contacts", "projects", "quotes", "appointments"],
  limit: 10
}

// Returns grouped results
{
  contacts: [...],
  projects: [...],
  quotes: [...],
  appointments: [...],
  totalResults: 47,
  searchTime: 45
}
```

### 3. **Batch Operations**
Available for: contacts, projects, appointments, SMS
```typescript
POST /api/{entity}/batch
{
  action: "create" | "update" | "delete" | "tag",
  items: [...],
  options: { ... }
}
```

### 4. **Dashboard Statistics**
```typescript
GET /api/stats/dashboard?locationId=xxx&period=week|month|year

// Returns comprehensive metrics
{
  projects: { total, active, byStatus, growth },
  quotes: { total, conversionRate, totalValue },
  revenue: { total, collected, pending, growth },
  appointments: { upcoming, completionRate }
}
```

### 5. **Enhanced Data Available**

**See the updated TypeScript types file for ALL available fields: `packages/types/index.ts`**

Key new fields include:
- Projects: milestones, timeline, photos, documents, progress tracking
- Quotes: signatures, payment tracking, activity feed, web links
- Contacts: tags, source, full address, related data
- Appointments: calendar info, recurring details, custom fields
- And MUCH more - check the types file for complete field lists

---

## 📁 Service Pattern

### Base Service Template
```typescript
// services/baseService.ts
import api from '../lib/api';

export class BaseService {
  protected async request<T>(
    method: string,
    endpoint: string,
    params?: any
  ): Promise<T> {
    const response = await api[method](endpoint, params);
    return response.data;
  }
}
```

### Service Implementation Example
```typescript
// services/projectService.ts
export class ProjectService extends BaseService {
  async getProjects(locationId: string, params?: FilterParams) {
    return this.request('get', '/projects', { 
      params: { locationId, ...params } 
    });
  }
  
  async searchProjects(locationId: string, query: string) {
    return this.request('post', '/search/projects', {
      locationId,
      query
    });
  }
  
  async batchUpdate(items: any[], action: string) {
    return this.request('post', '/projects/batch', {
      action,
      items
    });
  }
}
```

---

## 🔧 Common UI Patterns

### Pagination Component
```typescript
const [data, setData] = useState([]);
const [pagination, setPagination] = useState({ offset: 0, hasMore: true });

const loadMore = async () => {
  const result = await service.getItems(locationId, {
    limit: 20,
    offset: pagination.offset + 20
  });
  setData([...data, ...result.data]);
  setPagination(result.pagination);
};
```

### Search with Debounce
```typescript
const [searchTerm, setSearchTerm] = useState('');

useEffect(() => {
  const delaySearch = setTimeout(() => {
    if (searchTerm) {
      searchItems(searchTerm);
    }
  }, 300);
  
  return () => clearTimeout(delaySearch);
}, [searchTerm]);
```

### Multi-Select for Batch
```typescript
const [selectedItems, setSelectedItems] = useState([]);
const [isSelectMode, setSelectMode] = useState(false);

const handleBatchAction = async (action: string) => {
  await service.batchUpdate(selectedItems, action);
  setSelectedItems([]);
  setSelectMode(false);
  refresh();
};
```

---

## 📋 Entity-Specific Filters

**Note: We can add more filters as needed - just ask!**

### Projects
- `status` - open, won, lost, abandoned
- `contactId` - Filter by contact
- `pipelineId` - Filter by pipeline
- `pipelineStageId` - Filter by stage
- `hasQuote` - true/false
- `startDate/endDate` - Date range
- *Custom filters can be added*

### Contacts
- `tags[]` - Filter by tags
- `source` - Lead source
- `hasProjects` - true/false
- `createdAfter/createdBefore` - Date range
- *More filters available on request*

### Appointments
- `calendarId` - Filter by calendar
- `userId` - Filter by assigned user
- `status` - scheduled, completed, cancelled
- `start/end` - Date range
- *Additional filters can be implemented*

### Quotes
- `status` - draft, published, viewed, signed
- `projectId` - Filter by project
- `hasSignatures` - true/false
- `amountMin/amountMax` - Value range
- *Open to adding more filters*

---

## 🚀 Quick Implementation Checklist

When updating any screen:

- [ ] Replace direct API calls with service methods
- [ ] Add pagination (limit/offset or infinite scroll)
- [ ] Add search functionality (with debounce)
- [ ] Add relevant filters for the entity
- [ ] Implement multi-select for batch operations
- [ ] Add loading states and error handling
- [ ] Update types to include new fields
- [ ] Add activity/timeline feeds where relevant
- [ ] Include progress indicators for projects/quotes
- [ ] Add quick action buttons

---

## 📝 API Documentation Reference

Full endpoint documentation: `/API-Documentation.md`

### Available API Endpoints:
- **Auth**: `/api/login`, `/api/oauth/*`
- **Contacts**: CRUD + `/api/contacts/batch`, `/api/contacts/withProjects`
- **Projects**: CRUD + `/api/projects/batch`, `/api/projects/byContact`
- **Appointments**: CRUD + `/api/appointments/batch`
- **Quotes**: Full lifecycle + `/api/quotes/[id]/sign`, `/api/quotes/[id]/pdf`, `/api/quotes/[id]/publish`
- **Payments**: `/api/payments/create-link`, `/api/payments/record-manual`, `/api/payments/upload-proof`
- **Search**: `/api/search/global`, `/api/search/contacts`, `/api/search/projects`
- **Stats**: `/api/stats/dashboard`, `/api/stats/projects`, `/api/stats/revenue`
- **SMS**: `/api/sms/send`, `/api/sms/batch`, `/api/sms/templates`
- **Email**: `/api/emails/send`, `/api/emails/send-contract`
- **Tasks**: Full CRUD + `/api/tasks/batch`
- **Libraries**: Product catalog management
- **Templates**: Quote/email templates
- **GHL Sync**: `/api/ghl/pipelines/[locationId]`, `/api/ghl/calendars/[locationId]`
- **And more...**

---

## 🎨 UI/UX Patterns

### Loading States
- Skeleton screens for lists
- Progress bars for long operations
- Optimistic updates for better UX

### Error Handling
- Toast notifications for errors
- Retry buttons for failed requests
- Offline mode detection

### Performance
- Debounced search (300ms)
- Virtual scrolling for long lists
- Image lazy loading
- Cache frequently accessed data

### Logging Pattern
```typescript
// Always use conditional logging
if (__DEV__) {
  console.log('[ServiceName] Action:', data);
}

// For errors
if (__DEV__) {
  console.error('[ServiceName] Error:', error);
}

// For debugging
if (__DEV__) {
  console.log('[ScreenName] State update:', { oldState, newState });
}
```