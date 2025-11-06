import axios from 'axios';
import { logger } from '../utils/logger.js';
import { TokenResponse } from './types.js';
import { mapApiErrorToMCP } from '../errors/handler.js';

class AuthManager {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private refreshPromise: Promise<string> | null = null;

  private getBaseUrl(): string {
    return process.env.TRACKINGTIME_API_BASE_URL || 'https://api.trackingti.me';
  }

  private getClientId(): string {
    const clientId = process.env.TRACKINGTIME_CLIENT_ID;
    if (!clientId) {
      throw new Error('TRACKINGTIME_CLIENT_ID environment variable is required');
    }
    return clientId;
  }

  private getClientSecret(): string {
    const clientSecret = process.env.TRACKINGTIME_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error('TRACKINGTIME_CLIENT_SECRET environment variable is required');
    }
    return clientSecret;
  }

  private getScopes(): string {
    return process.env.TRACKINGTIME_SCOPES || '';
  }

  async getToken(): Promise<string> {
    // Check if token is still valid (with 5 minute buffer)
    const now = Date.now();
    if (this.token && now < this.tokenExpiry) {
      logger.debug('Using cached token', {
        expiresIn: Math.floor((this.tokenExpiry - now) / 1000),
      });
      return this.token;
    }

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      logger.debug('Token refresh already in progress, waiting...');
      return this.refreshPromise;
    }

    // Start new token acquisition
    this.refreshPromise = this.acquireToken();
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async acquireToken(): Promise<string> {
    const baseUrl = this.getBaseUrl();
    const tokenUrl = `${baseUrl}/api/external/oauth/token`;

    logger.info('Acquiring OAuth2 token', { tokenUrl });

    try {
      const response = await axios.post<TokenResponse>(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.getClientId(),
          client_secret: this.getClientSecret(),
          scope: this.getScopes(),
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.token = response.data.access_token;
      // Set expiry 5 minutes before actual expiry for safety
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = Date.now() + (expiresIn - 300) * 1000;

      logger.info('Token acquired successfully', {
        expiresIn,
        scopes: response.data.scope,
      });

      return this.token;
    } catch (error) {
      const mcpError = mapApiErrorToMCP(error, {
        method: 'POST',
        url: tokenUrl,
      });
      logger.error('Failed to acquire token', { error: mcpError.message });
      throw mcpError;
    }
  }

  clearToken(): void {
    this.token = null;
    this.tokenExpiry = 0;
    logger.debug('Token cleared');
  }
}

export const authManager = new AuthManager();
