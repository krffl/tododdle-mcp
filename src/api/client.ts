import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { authManager } from './auth.js';
import { logger } from '../utils/logger.js';
import { mapApiErrorToMCP, ErrorContext } from '../errors/handler.js';

class ApiClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // Initial delay in ms

  constructor() {
    this.baseUrl = process.env.TRACKINGTIME_API_BASE_URL || 'https://api.trackingti.me';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: Inject token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const token = await authManager.getToken();
          config.headers.Authorization = `Bearer ${token}`;
          logger.debug('API request', {
            method: config.method?.toUpperCase(),
            url: config.url,
          });
        } catch (error) {
          logger.error('Failed to get token for request', { error });
          throw error;
        }
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor: Handle errors and log rate limit info
    this.client.interceptors.response.use(
      (response) => {
        const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
        const rateLimitReset = response.headers['x-ratelimit-reset'];
        const rateLimitLimit = response.headers['x-ratelimit-limit'];

        logger.debug('API response', {
          status: response.status,
          url: response.config.url,
          ...(rateLimitRemaining && { rateLimitRemaining }),
          ...(rateLimitReset && { rateLimitReset }),
          ...(rateLimitLimit && { rateLimitLimit }),
        });
        return response;
      },
      async (error) => {
        const context: ErrorContext = {
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
        };

        // Handle 401 by clearing token and retrying once
        if (error.response?.status === 401 && error.config && !error.config._retry) {
          error.config._retry = true;
          authManager.clearToken();
          logger.warn('Token expired, refreshing and retrying', context);
          try {
            const token = await authManager.getToken();
            error.config.headers.Authorization = `Bearer ${token}`;
            return this.client.request(error.config);
          } catch (refreshError) {
            logger.error('Failed to refresh token', { error: refreshError });
            throw mapApiErrorToMCP(refreshError, context);
          }
        }

        throw mapApiErrorToMCP(error, context);
      }
    );
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async retryRequest<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    retryCount: number = 0
  ): Promise<AxiosResponse<T>> {
    try {
      return await requestFn();
    } catch (error) {
      // Check if error is retryable
      const isRetryable =
        error instanceof Error &&
        (!('response' in error) ||
          (error as { response?: { status?: number } }).response?.status === undefined ||
          ((error as { response?: { status?: number } }).response?.status ?? 0) >= 500);

      if (isRetryable && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        logger.warn(`Request failed, retrying in ${delay}ms`, {
          retryCount: retryCount + 1,
          maxRetries: this.maxRetries,
        });
        await this.sleep(delay);
        return this.retryRequest(requestFn, retryCount + 1);
      }
      throw error;
    }
  }

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.client.get<T>(url, config));
  }

  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.client.post<T>(url, data, config));
  }

  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.client.put<T>(url, data, config));
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.client.delete<T>(url, config));
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

export const apiClient = new ApiClient();
