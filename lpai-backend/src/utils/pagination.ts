// lpai-backend/src/utils/pagination.ts
import { Collection, Document } from 'mongodb';

export interface PaginationOptions {
  limit?: number | string;
  offset?: number | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Generic pagination helper for MongoDB collections
 * @param collection - MongoDB collection to paginate
 * @param filter - MongoDB filter object
 * @param options - Pagination options
 * @returns Paginated response with data and metadata
 */
export async function paginate<T extends Document>(
  collection: Collection<T>,
  filter: any,
  options: PaginationOptions
): Promise<PaginatedResponse<T>> {
  const { 
    limit = 50, 
    offset = 0, 
    sortBy = 'createdAt', 
    sortOrder = 'desc' 
  } = options;

  // Convert string params to numbers
  const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
  const offsetNum = typeof offset === 'string' ? parseInt(offset, 10) : offset;

  // Validate pagination params
  const finalLimit = Math.min(Math.max(1, limitNum), 100); // Max 100 items per page
  const finalOffset = Math.max(0, offsetNum);

  // Build sort object
  const sort: any = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const [data, total] = await Promise.all([
    collection
      .find(filter)
      .sort(sort)
      .limit(finalLimit)
      .skip(finalOffset)
      .toArray(),
    collection.countDocuments(filter)
  ]);

  return {
    data,
    pagination: {
      total,
      limit: finalLimit,
      offset: finalOffset,
      hasMore: (finalOffset + data.length) < total
    }
  };
}

/**
 * Build date range filter for MongoDB queries
 * @param fieldName - The field to filter on
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns MongoDB date filter object
 */
export function buildDateRangeFilter(
  fieldName: string,
  startDate?: string | Date,
  endDate?: string | Date
): any {
  if (!startDate && !endDate) return {};

  const filter: any = {};
  const dateFilter: any = {};

  if (startDate) {
    dateFilter.$gte = typeof startDate === 'string' ? new Date(startDate) : startDate;
  }
  
  if (endDate) {
    // Add 1 day to include the entire end date
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    end.setDate(end.getDate() + 1);
    dateFilter.$lt = end;
  }

  if (Object.keys(dateFilter).length > 0) {
    filter[fieldName] = dateFilter;
  }

  return filter;
}

/**
 * Build search filter for text fields
 * @param search - Search query
 * @param fields - Fields to search in
 * @returns MongoDB $or filter for text search
 */
export function buildSearchFilter(search: string | undefined, fields: string[]): any {
  if (!search || search.trim() === '') return {};

  const searchRegex = { $regex: search.trim(), $options: 'i' };
  const orConditions = fields.map(field => ({ [field]: searchRegex }));

  return { $or: orConditions };
}