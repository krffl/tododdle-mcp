import { tmpdir } from 'node:os';
import { posix, win32 } from 'node:path';

export interface McpConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  uploadRoots: string[];
  managedUploadRoot: string;
  maxUploadBytes: number;
}

export function parseUploadRoots(value: string | undefined, platform = process.platform): string[] {
  return (value || '')
    .split(platform === 'win32' ? ';' : ':')
    .map((root) => root.trim())
    .filter(Boolean);
}

export function getDefaultManagedUploadRoot(
  temporaryDirectory = tmpdir(),
  platform = process.platform
): string {
  const paths = platform === 'win32' ? win32 : posix;
  return paths.resolve(temporaryDirectory, 'tododdle-mcp-uploads');
}

function normalizeBaseUrl(value: string | undefined): string {
  const rawValue = value || 'https://app.tododdle.com';
  let url: URL;

  try {
    url = new URL(rawValue);
  } catch {
    throw new Error('TODODDLE_BASE_URL must be a valid absolute URL');
  }

  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (
    ['trackingti.me', 'www.trackingti.me', 'tododdle.com', 'www.tododdle.com'].includes(
      url.hostname
    )
  ) {
    throw new Error('TODODDLE_BASE_URL must use the application origin https://app.tododdle.com');
  }
  if (url.protocol !== 'https:' && !(isLoopback && url.protocol === 'http:')) {
    throw new Error('TODODDLE_BASE_URL must use HTTPS except for loopback development');
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname && url.pathname !== '/')
  ) {
    throw new Error(
      'TODODDLE_BASE_URL must be an origin without credentials, path, query, or fragment'
    );
  }

  return url.origin;
}

export function loadMcpConfig(environment: NodeJS.ProcessEnv = process.env): McpConfig {
  const baseUrl = normalizeBaseUrl(environment.TODODDLE_BASE_URL);
  const clientId = environment.TODODDLE_CLIENT_ID;
  const clientSecret = environment.TODODDLE_CLIENT_SECRET;
  const uploadRoots = parseUploadRoots(environment.TODODDLE_UPLOAD_ROOTS);
  const managedUploadRoot = getDefaultManagedUploadRoot();
  const configuredMax = Number(environment.TODODDLE_MAX_UPLOAD_BYTES || 1024 * 1024 * 1024);

  if (!clientId || !clientSecret) {
    throw new Error('TODODDLE_CLIENT_ID and TODODDLE_CLIENT_SECRET are required');
  }

  if (!Number.isSafeInteger(configuredMax) || configuredMax <= 0) {
    throw new Error('TODODDLE_MAX_UPLOAD_BYTES must be a positive integer');
  }

  return {
    baseUrl,
    clientId,
    clientSecret,
    uploadRoots,
    managedUploadRoot,
    maxUploadBytes: configuredMax,
  };
}
