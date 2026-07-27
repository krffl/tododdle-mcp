export interface McpConfig {
  clientId: string;
  clientSecret: string;
  uploadRoots: string[];
  maxUploadBytes: number;
}

export function loadMcpConfig(environment: NodeJS.ProcessEnv = process.env): McpConfig {
  const clientId = environment.TODODDLE_CLIENT_ID;
  const clientSecret = environment.TODODDLE_CLIENT_SECRET;
  const uploadRoots = (environment.TODODDLE_UPLOAD_ROOTS || '')
    .split(process.platform === 'win32' ? ';' : ':')
    .map((value) => value.trim())
    .filter(Boolean);
  const configuredMax = Number(environment.TODODDLE_MAX_UPLOAD_BYTES || 1024 * 1024 * 1024);

  if (!clientId || !clientSecret) {
    throw new Error('TODODDLE_CLIENT_ID and TODODDLE_CLIENT_SECRET are required');
  }

  if (!Number.isSafeInteger(configuredMax) || configuredMax <= 0) {
    throw new Error('TODODDLE_MAX_UPLOAD_BYTES must be a positive integer');
  }

  return { clientId, clientSecret, uploadRoots, maxUploadBytes: configuredMax };
}
