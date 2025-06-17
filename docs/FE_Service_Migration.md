# Frontend Service Migration Guide
**Last Updated: 2025-01-17**

## 🎯 Overview
This document tracks all frontend files that need to be updated to use services instead of direct API calls. When editing a file, the complete updated file will be provided with no UI changes.

## 📊 Status Summary

### ✅ Already Using Services
- ContactsScreen.tsx
- CalendarScreen.tsx
- AddProjectForm.tsx
- AddContactForm.tsx
- CreateAppointmentModal.tsx
- ProjectsScreen.tsx (mostly complete)

### 🔴 Files Needing Updates
1. **HomeScreen.tsx** - Uses direct `api` calls for dashboard and search
2. **QuotePresentationScreen.tsx** - Uses direct `api` calls for quote operations
3. **SignatureScreen.tsx** - Uses direct `api` calls for signatures and project updates
4. **TemplateSelectionModal.tsx** - Uses direct `api` calls for template operations
5. **QuoteEditorScreen.tsx** - Uses direct `api` calls for library operations
6. **ProjectDetailScreen.tsx** - Mixed usage (partial service implementation)
7. **AppointmentDetail.tsx** - Uses direct `api` calls
8. **MockDashboardScreen.tsx** - May use direct `api` calls

## 🛠️ Services to Create

### 1. dashboardService.ts
```typescript
// services/dashboardService.ts
import { BaseService } from './baseService';

interface DashboardStats {
  projects: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
  };
  quotes: {
    total: number;
    draft: number;
    signed: number;
    totalValue: number;
  };
  appointments: {
    today: number;
    thisWeek: number;
    upcoming: any[];
  };
  revenue: {
    thisMonth: number;
    collected: number;
    pending: number;
  };
}

class DashboardService extends BaseService {
  async getStats(locationId: string): Promise<DashboardStats> {
    return this.get<DashboardStats>(
      `/api/stats/dashboard?locationId=${locationId}`,
      { cache: { priority: 'high', ttl: 5 * 60 * 1000 } }
    );
  }

  async getUpcomingAppointments(locationId: string, days: number = 7) {
    return this.get(`/api/appointments?locationId=${locationId}&upcoming=${days}`);
  }

  async getRecentActivity(locationId: string, limit: number = 10) {
    return this.get(`/api/activity?locationId=${locationId}&limit=${limit}`);
  }
}

export const dashboardService = new DashboardService();
```

### 2. signatureService.ts
```typescript
// services/signatureService.ts
import { BaseService } from './baseService';

interface SignatureData {
  type: 'consultant' | 'customer';
  signature: string;
  signedAt: string;
  name?: string;
  email?: string;
}

class SignatureService extends BaseService {
  async submitSignatures(
    quoteId: string,
    locationId: string,
    signatures: {
      consultant: SignatureData;
      customer: SignatureData;
    }
  ) {
    return this.post(`/api/quotes/${quoteId}/sign`, {
      locationId,
      signatures
    });
  }

  async generateSignedPDF(quoteId: string, locationId: string) {
    return this.post(`/api/quotes/${quoteId}/pdf`, { locationId });
  }

  async updateProjectStatus(projectId: string, locationId: string, status: string) {
    // Use projectService for this
    const { projectService } = await import('./projectService');
    return projectService.update(projectId, locationId, { status });
  }
}

export const signatureService = new SignatureService();
```

### 3. Update templateService.ts
Add this method to existing templateService:
```typescript
async saveUserPreferences(userId: string, preferences: any) {
  return this.patch(`/api/users/${userId}`, { preferences });
}
```

## 📝 File Update Instructions

### When Updating a File:
1. Add date comment at top: `// Updated: YYYY-MM-DD`
2. Import needed services
3. Remove direct `api` imports
4. Replace all `api.get/post/patch/delete` calls with service methods
5. Maintain exact same UI/UX behavior
6. Keep all styling unchanged
7. Preserve all existing functionality

### Service Method Mapping:
- `api.get('/api/contacts')` → `contactService.list(locationId)`
- `api.post('/api/projects')` → `projectService.create(data)`
- `api.patch('/api/quotes/123')` → `quoteService.update(id, data)`
- `api.get('/api/search/global')` → Use individual service search methods

## 🔄 Update Order (Recommended)

### Phase 1: Create Services
1. Create dashboardService.ts
2. Create signatureService.ts
3. Update templateService.ts with preferences method

### Phase 2: Simple Updates
1. **TemplateSelectionModal.tsx** - Use templateService
2. **MockDashboardScreen.tsx** - Use dashboardService

### Phase 3: Complex Updates
1. **HomeScreen.tsx** - Use dashboardService + individual search methods
2. **QuotePresentationScreen.tsx** - Use quoteService methods
3. **QuoteEditorScreen.tsx** - Use libraryService + templateService
4. **SignatureScreen.tsx** - Use signatureService + projectService

### Phase 4: Complete Transitions
1. **ProjectDetailScreen.tsx** - Complete service migration
2. **AppointmentDetail.tsx** - Use appointmentService throughout

## 🔍 Search Implementation Note

Each service already has search capabilities:
- `contactService.search(locationId, query)`
- `projectService.search(locationId, query)`
- `appointmentService.search(locationId, query)` (if implemented)
- `quoteService.search(locationId, query)` (if implemented)

For global search in HomeScreen, call each service's search method and combine results.

## ⚠️ Important Notes

1. **No UI Changes** - Service migration should be invisible to users
2. **Error Handling** - Services include built-in error handling, no need for try-catch in most cases
3. **Caching** - Services handle caching automatically
4. **Offline Support** - Services queue operations when offline
5. **Location ID** - Always pass locationId from user context

## 📋 Checklist for Each File

- [ ] Date comment added at top
- [ ] Service imports added
- [ ] Direct API import removed
- [ ] All API calls replaced with service methods
- [ ] Error handling maintained
- [ ] Loading states preserved
- [ ] No UI changes made
- [ ] Tested all functionality

## 🚀 Next Steps

1. Start with creating the missing services
2. Update files in recommended order
3. Test each update thoroughly
4. Commit after each file update with message: `refactor: migrate [FileName] to use services`