export const MCP_PACKAGE_VERSION = '3.2.1';
export const MCP_COMPATIBILITY_LEVEL = 3;
export const MCP_VERSION_HEADER = 'x-tododdle-mcp-version';
export const MCP_COMPATIBILITY_HEADER = 'x-tododdle-mcp-compatibility';

export const MCP_REQUEST_HEADERS = {
  [MCP_VERSION_HEADER]: MCP_PACKAGE_VERSION,
  [MCP_COMPATIBILITY_HEADER]: String(MCP_COMPATIBILITY_LEVEL),
} as const;

interface McpUpdateRequiredDetails {
  installedVersion?: unknown;
  minimumCompatibilityLevel?: unknown;
  updateCommand?: unknown;
  documentationUrl?: unknown;
  restartRequired?: unknown;
}

export function formatMcpUpdateRequiredMessage(message: string, details: unknown): string {
  const value = details && typeof details === 'object' ? (details as McpUpdateRequiredDetails) : {};
  const updateCommand =
    typeof value.updateCommand === 'string'
      ? value.updateCommand
      : 'npx --yes --prefer-online tododdle-mcp@latest';
  const documentation =
    typeof value.documentationUrl === 'string' ? ` See ${value.documentationUrl}.` : '';

  return `${message} Ask the user to run \`${updateCommand}\`, then restart Codex.${documentation}`;
}
