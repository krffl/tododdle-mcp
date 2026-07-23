export interface McpConfig {
  clientId: string;
  clientSecret: string;
}

export function loadMcpConfig(environment: NodeJS.ProcessEnv = process.env): McpConfig {
  const clientId = environment.TODODDLE_CLIENT_ID;
  const clientSecret = environment.TODODDLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TODODDLE_CLIENT_ID and TODODDLE_CLIENT_SECRET are required');
  }

  return { clientId, clientSecret };
}
