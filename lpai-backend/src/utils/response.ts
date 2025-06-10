// lpai-backend/src/utils/response.ts
import { NextApiResponse } from 'next';

interface SuccessResponse<T = any> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: any;
  timestamp: string;
}

/**
 * Send a successful response
 * @param res - Next.js API response object
 * @param data - Response data
 * @param message - Success message
 * @param pagination - Optional pagination metadata
 */
export function sendSuccess<T = any>(
  res: NextApiResponse,
  data: T,
  message = 'Success',
  pagination?: SuccessResponse<T>['pagination']
): void {
  const response: SuccessResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };

  if (pagination) {
    response.pagination = pagination;
  }

  res.status(200).json(response);
}

/**
 * Send a paginated success response
 * @param res - Next.js API response object
 * @param data - Array of items
 * @param pagination - Pagination metadata
 * @param message - Success message
 */
export function sendPaginatedSuccess<T = any>(
  res: NextApiResponse,
  data: T[],
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  },
  message = 'Success'
): void {
  sendSuccess(res, data, message, pagination);
}

/**
 * Send an error response
 * @param res - Next.js API response object
 * @param error - Error message
 * @param status - HTTP status code
 * @param details - Optional error details
 */
export function sendError(
  res: NextApiResponse,
  error: string,
  status = 400,
  details?: any
): void {
  const response: ErrorResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString()
  };

  if (details) {
    response.details = details;
  }

  res.status(status).json(response);
}

/**
 * Send a validation error response
 * @param res - Next.js API response object
 * @param errors - Validation errors
 */
export function sendValidationError(
  res: NextApiResponse,
  errors: Record<string, string | string[]>
): void {
  sendError(res, 'Validation failed', 422, errors);
}

/**
 * Send a not found error response
 * @param res - Next.js API response object
 * @param resource - Resource type that wasn't found
 */
export function sendNotFound(
  res: NextApiResponse,
  resource = 'Resource'
): void {
  sendError(res, `${resource} not found`, 404);
}

/**
 * Send an unauthorized error response
 * @param res - Next.js API response object
 * @param message - Optional custom message
 */
export function sendUnauthorized(
  res: NextApiResponse,
  message = 'Unauthorized access'
): void {
  sendError(res, message, 401);
}

/**
 * Send a forbidden error response
 * @param res - Next.js API response object
 * @param message - Optional custom message
 */
export function sendForbidden(
  res: NextApiResponse,
  message = 'Access forbidden'
): void {
  sendError(res, message, 403);
}

/**
 * Send a server error response
 * @param res - Next.js API response object
 * @param error - The error object or message
 * @param message - User-friendly error message
 */
export function sendServerError(
  res: NextApiResponse,
  error: any,
  message = 'Internal server error'
): void {
  // Log the actual error for debugging
  console.error('[Server Error]', error);
  
  // Don't expose internal errors to the client in production
  const isDev = process.env.NODE_ENV === 'development';
  const details = isDev ? (error?.message || error) : undefined;
  
  sendError(res, message, 500, details);
}

/**
 * Send a method not allowed error
 * @param res - Next.js API response object
 * @param allowedMethods - Array of allowed HTTP methods
 */
export function sendMethodNotAllowed(
  res: NextApiResponse,
  allowedMethods: string[]
): void {
  res.setHeader('Allow', allowedMethods);
  sendError(res, `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}`, 405);
}