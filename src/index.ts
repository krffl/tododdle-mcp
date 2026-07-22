#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TrackingTimeApiClient } from './api-client.js';
import { loadMcpConfig } from './config.js';
import { createTrackingTimeMcpServer } from './server.js';

async function main() {
  const server = createTrackingTimeMcpServer(new TrackingTimeApiClient(loadMcpConfig()));
  await server.connect(new StdioServerTransport());
  console.error('trackingti.me MCP server connected over stdio');
}

main().catch((error) => {
  console.error('trackingti.me MCP server failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
