// services/libraryService.ts
import { BaseService } from './baseService';
import { Library } from '../../packages/types';

interface LibraryCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  items: LibraryItem[];
  createdAt: string;
  updatedAt: string;
}

interface LibraryItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  markup: number;
  unit: string;
  sku: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateLibraryInput {
  name: string;
  categories?: Array<{
    name: string;
    description?: string;
    icon?: string;
    sortOrder?: number;
  }>;
  createdBy: string;
}

interface AddCategoryInput {
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
}

interface AddItemInput {
  name: string;
  description?: string;
  basePrice: number;
  markup?: number;
  unit?: string;
  sku?: string;
}

interface UpdateItemInput extends Partial<AddItemInput> {
  isActive?: boolean;
}

class LibraryService extends BaseService {
  /**
   * Get all libraries for location
   */
  async getLibraries(locationId: string): Promise<Library[]> {
    const endpoint = `/api/libraries/${locationId}`;
    
    return this.get<Library[]>(
      endpoint,
      {
        cache: { priority: 'high', ttl: 60 * 60 * 1000 }, // 1 hour
      },
      {
        endpoint,
        method: 'GET',
        entity: 'project',
      }
    );
  }

  /**
   * Create new library
   */
  async createLibrary(
    locationId: string,
    data: CreateLibraryInput
  ): Promise<Library> {
    const endpoint = `/api/libraries/${locationId}`;
    
    const newLibrary = await this.post<Library>(
      endpoint,
      data,
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'project',
        priority: 'medium',
      }
    );

    // Clear libraries cache
    await this.clearCache(`@lpai_cache_GET_/api/libraries/${locationId}`);
    
    return newLibrary;
  }

  /**
   * Add category to library
   */
  async addCategory(
    locationId: string,
    libraryId: string,
    category: AddCategoryInput
  ): Promise<{ success: boolean; categoryId?: string }> {
    const endpoint = `/api/libraries/${locationId}`;
    
    const result = await this.patch<any>(
      endpoint,
      {
        libraryId,
        action: 'add_category',
        category,
      },
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'project',
        priority: 'medium',
      }
    );

    // Clear cache
    await this.clearCache(`@lpai_cache_GET_/api/libraries/${locationId}`);
    
    return result;
  }

  /**
   * Add item to category
   */
  async addItem(
    locationId: string,
    libraryId: string,
    categoryId: string,
    item: AddItemInput
  ): Promise<{ success: boolean; itemId?: string }> {
    const endpoint = `/api/libraries/${locationId}`;
    
    const result = await this.patch<any>(
      endpoint,
      {
        libraryId,
        action: 'add_item',
        category: { id: categoryId },
        item,
      },
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'project',
        priority: 'high',
      }
    );

    // Clear cache
    await this.clearCache(`@lpai_cache_GET_/api/libraries/${locationId}`);
    
    return result;
  }

  /**
   * Update item
   */
  async updateItem(
    locationId: string,
    libraryId: string,
    categoryId: string,
    itemId: string,
    updates: UpdateItemInput
  ): Promise<{ success: boolean }> {
    const endpoint = `/api/libraries/${locationId}`;
    
    const result = await this.patch<any>(
      endpoint,
      {
        libraryId,
        action: 'update_item',
        category: { id: categoryId },
        item: { id: itemId, ...updates },
      },
      {
        offline: true,
        showError: true,
      },
      {
        endpoint,
        method: 'PATCH',
        entity: 'project',
        priority: 'medium',
      }
    );

    // Clear cache
    await this.clearCache(`@lpai_cache_GET_/api/libraries/${locationId}`);
    
    return result;
  }

  /**
   * Get default library (creates if doesn't exist)
   */
  async getDefaultLibrary(locationId: string): Promise<Library> {
    const libraries = await this.getLibraries(locationId);
    
    // Backend creates default if none exist
    const defaultLib = libraries.find(lib => lib.isDefault) || libraries[0];
    
    if (!defaultLib) {
      throw new Error('No library found');
    }
    
    return defaultLib;
  }

  /**
   * Search items across all libraries
   */
  async searchItems(
    locationId: string,
    query: string
  ): Promise<Array<{
    item: LibraryItem;
    category: string;
    categoryId: string;
    library: string;
    libraryId: string;
  }>> {
    const libraries = await this.getLibraries(locationId);
    const results: Array<any> = [];
    const searchLower = query.toLowerCase();
    
    libraries.forEach(library => {
      library.categories.forEach(category => {
        category.items
          .filter(item => 
            item.isActive &&
            (item.name.toLowerCase().includes(searchLower) ||
             item.description?.toLowerCase().includes(searchLower) ||
             item.sku?.toLowerCase().includes(searchLower))
          )
          .forEach(item => {
            results.push({
              item,
              category: category.name,
              categoryId: category.id,
              library: library.name,
              libraryId: library._id,
            });
          });
      });
    });
    
    // Sort by usage count
    return results.sort((a, b) => b.item.usageCount - a.item.usageCount);
  }

  /**
   * Get items by category
   */
  async getItemsByCategory(
    locationId: string,
    libraryId: string,
    categoryId: string
  ): Promise<LibraryItem[]> {
    const libraries = await this.getLibraries(locationId);
    const library = libraries.find(lib => lib._id === libraryId);
    
    if (!library) {
      throw new Error('Library not found');
    }
    
    const category = library.categories.find(cat => cat.id === categoryId);
    
    if (!category) {
      throw new Error('Category not found');
    }
    
    return category.items.filter(item => item.isActive);
  }

  /**
   * Get frequently used items
   */
  async getFrequentItems(
    locationId: string,
    limit = 10
  ): Promise<Array<{
    item: LibraryItem;
    category: string;
    library: string;
  }>> {
    const libraries = await this.getLibraries(locationId);
    const allItems: Array<any> = [];
    
    libraries.forEach(library => {
      library.categories.forEach(category => {
        category.items
          .filter(item => item.isActive && item.usageCount > 0)
          .forEach(item => {
            allItems.push({
              item,
              category: category.name,
              library: library.name,
            });
          });
      });
    });
    
    // Sort by usage and return top items
    return allItems
      .sort((a, b) => b.item.usageCount - a.item.usageCount)
      .slice(0, limit);
  }

  /**
   * Calculate item price with markup
   */
  calculatePrice(item: LibraryItem): number {
    return item.basePrice * (item.markup || 1);
  }

  /**
   * Batch add items
   */
  async batchAddItems(
    locationId: string,
    libraryId: string,
    categoryId: string,
    items: AddItemInput[]
  ): Promise<{ success: boolean; added: number; failed: number }> {
    let added = 0;
    let failed = 0;
    
    // Add items one by one (could be optimized with batch endpoint)
    for (const item of items) {
      try {
        await this.addItem(locationId, libraryId, categoryId, item);
        added++;
      } catch (error) {
        failed++;
        if (__DEV__) {
          console.error('Failed to add item:', item.name, error);
        }
      }
    }
    
    return { success: failed === 0, added, failed };
  }

  /**
   * Export library to CSV format
   */
  async exportToCSV(library: Library): Promise<string> {
    const rows: string[] = ['Category,Item Name,Description,SKU,Base Price,Markup,Unit'];
    
    library.categories.forEach(category => {
      category.items.forEach(item => {
        const row = [
          category.name,
          item.name,
          item.description || '',
          item.sku || '',
          item.basePrice.toString(),
          item.markup.toString(),
          item.unit,
        ].map(field => `"${field.replace(/"/g, '""')}"`).join(',');
        
        rows.push(row);
      });
    });
    
    return rows.join('\n');
  }
}

export const libraryService = new LibraryService();