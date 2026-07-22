export interface McpConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export function loadMcpConfig(environment: NodeJS.ProcessEnv = process.env): McpConfig {
  const baseUrl = (environment.TRACKINGTIME_BASE_URL || 'https://trackingti.me').replace(/\/$/, '');
  const clientId = environment.TRACKINGTIME_CLIENT_ID;
  const clientSecret = environment.TRACKINGTIME_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TRACKINGTIME_CLIENT_ID and TRACKINGTIME_CLIENT_SECRET are required');
  }

  return { baseUrl, clientId, clientSecret };
}
