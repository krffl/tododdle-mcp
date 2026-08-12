import type { McpConfig } from './config.js';
import { createReadStream } from 'node:fs';
import { MCP_REQUEST_HEADERS, formatMcpUpdateRequiredMessage } from './compatibility.js';

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export class ToDoddleApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ToDoddleApiError';
  }
}

export interface ToDoddleApi {
  get(
    path: string,
    query?: Record<string, string | number | boolean | undefined>
  ): Promise<Record<string, unknown>>;
  post(path: string, body: unknown, idempotencyKey?: string): Promise<Record<string, unknown>>;
  put(path: string, body: unknown): Promise<Record<string, unknown>>;
  patch(path: string, body: unknown): Promise<Record<string, unknown>>;
  delete(path: string, body: unknown): Promise<Record<string, unknown>>;
  uploadFile(
    url: string,
    headers: Record<string, string>,
    filePath: string,
    fileSize: number
  ): Promise<void>;
}

export class ToDoddleApiClient implements ToDoddleApi {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: McpConfig) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) return this.accessToken;

    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    const response = await fetch(`${this.config.baseUrl}/api/external/oauth/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...MCP_REQUEST_HEADERS,
      },
      body: form,
      redirect: 'manual',
    });
    this.assertNoRedirect(response);
    const payload = await this.readPayload(response);
    if (!response.ok) throw this.toError(response.status, payload);

    const token = payload as unknown as TokenResponse;
    if (!token.access_token || !token.expires_in)
      throw new Error('Token endpoint returned an invalid response');
    this.accessToken = token.access_token;
    this.tokenExpiresAt = Date.now() + token.expires_in * 1000;
    return token.access_token;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    idempotencyKey?: string,
    retry = true
  ): Promise<Record<string, unknown>> {
    const url = new URL(path, this.config.baseUrl);
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });

    const token = await this.getAccessToken();
    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...MCP_REQUEST_HEADERS,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    this.assertNoRedirect(response);

    if (response.status === 401 && retry) {
      this.accessToken = null;
      this.tokenExpiresAt = 0;
      return this.request(method, path, body, query, idempotencyKey, false);
    }

    const payload = await this.readPayload(response);
    if (!response.ok) throw this.toError(response.status, payload);
    return payload;
  }

  private async readPayload(response: Response): Promise<Record<string, unknown>> {
    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
    return payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : { value: payload };
  }

  private assertNoRedirect(response: Response): void {
    if (response.status < 300 || response.status >= 400) return;
    const destination = response.headers.get('location');
    throw new ToDoddleApiError(
      response.status,
      'configuration_error',
      `TODODDLE_BASE_URL redirected${destination ? ` to ${destination}` : ''}; configure the final API origin instead`
    );
  }

  private toError(status: number, payload: Record<string, unknown>) {
    const code = typeof payload.error === 'string' ? payload.error : 'server_error';
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : typeof payload.error_description === 'string'
          ? payload.error_description
          : `ToDoddle request failed (${status})`;
    return new ToDoddleApiError(
      status,
      code,
      code === 'MCP_UPDATE_REQUIRED'
        ? formatMcpUpdateRequiredMessage(message, payload.details)
        : message,
      payload.details
    );
  }

  get(path: string, query?: Record<string, string | number | boolean | undefined>) {
    return this.request('GET', path, undefined, query);
  }

  post(path: string, body: unknown, idempotencyKey?: string) {
    return this.request('POST', path, body, undefined, idempotencyKey);
  }

  put(path: string, body: unknown) {
    return this.request('PUT', path, body);
  }

  patch(path: string, body: unknown) {
    return this.request('PATCH', path, body);
  }

  delete(path: string, body: unknown) {
    return this.request('DELETE', path, body);
  }

  async uploadFile(
    url: string,
    headers: Record<string, string>,
    filePath: string,
    fileSize: number
  ): Promise<void> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'content-length': String(fileSize) },
      body: createReadStream(filePath) as never,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    if (!response.ok) {
      throw new Error(`Direct upload failed (${response.status})`);
    }
  }
}
