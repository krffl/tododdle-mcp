import { AxiosError } from 'axios';
import { logger } from '../utils/logger.js';

export interface ErrorContext {
  method?: string;
  url?: string;
  statusCode?: number;
  requestId?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  rateLimitLimit?: number;
}

export class MCPError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: ErrorContext
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export function mapApiErrorToMCP(
  error: unknown,
  context?: ErrorContext
): MCPError {
  // Handle Axios errors
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data as { message?: string; error?: string };
    const requestUrl = error.config?.url;
    const requestMethod = error.config?.method?.toUpperCase();

    const errorContext: ErrorContext = {
      ...context,
      method: requestMethod,
      url: requestUrl,
      statusCode: status,
    };

    if (status) {
      switch (status) {
        case 401:
          logger.error('Authentication failed', errorContext);
          return new MCPError(
            'Authentication failed. Please check your credentials.',
            'AUTH_ERROR',
            errorContext
          );
        case 403:
          logger.error('Access denied', errorContext);
          return new MCPError(
            `Access denied: ${data?.message || data?.error || 'Insufficient permissions'}`,
            'PERMISSION_ERROR',
            errorContext
          );
        case 404:
          logger.error('Resource not found', errorContext);
          return new MCPError(
            `Resource not found: ${data?.message || data?.error || 'The requested resource does not exist'}`,
            'NOT_FOUND',
            errorContext
          );
        case 429:
          // Extract rate limit headers if available
          const rateLimitRemaining = error.response?.headers['x-ratelimit-remaining'];
          const rateLimitReset = error.response?.headers['x-ratelimit-reset'];
          const rateLimitLimit = error.response?.headers['x-ratelimit-limit'];
          
          const enhancedContext: ErrorContext = {
            ...errorContext,
            rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
            rateLimitReset: rateLimitReset ? parseInt(rateLimitReset, 10) : undefined,
            rateLimitLimit: rateLimitLimit ? parseInt(rateLimitLimit, 10) : undefined,
          };

          let message = 'Rate limit exceeded.';
          if (rateLimitReset) {
            const resetDate = new Date(rateLimitReset * 1000);
            message += ` Please try again after ${resetDate.toISOString()}.`;
          } else {
            message += ' Please try again later.';
          }

          logger.error('Rate limit exceeded', enhancedContext);
          return new MCPError(message, 'RATE_LIMIT_ERROR', enhancedContext);
        case 500:
        case 502:
        case 503:
        case 504:
          logger.error('Server error', errorContext);
          return new MCPError(
            `Server error: ${data?.message || data?.error || 'Internal server error. Please try again later.'}`,
            'SERVER_ERROR',
            errorContext
          );
        default:
          logger.error('API error', { ...errorContext, data });
          return new MCPError(
            `API error: ${data?.message || data?.error || `HTTP ${status}`}`,
            'API_ERROR',
            errorContext
          );
      }
    }

    // Network error (no response)
    if (error.request && !error.response) {
      logger.error('Network error', errorContext);
      return new MCPError(
        'Network error: Unable to reach the API server. Please check your connection.',
        'NETWORK_ERROR',
        errorContext
      );
    }
  }

  // Handle MCPError (re-throw as-is)
  if (error instanceof MCPError) {
    return error;
  }

  // Handle generic Error
  if (error instanceof Error) {
    logger.error('Unexpected error', { ...context, message: error.message });
    return new MCPError(
      `Unexpected error: ${error.message}`,
      'UNKNOWN_ERROR',
      context
    );
  }

  // Handle unknown error types
  logger.error('Unknown error', { ...context, error });
  return new MCPError(
    'An unknown error occurred',
    'UNKNOWN_ERROR',
    context
  );
}
