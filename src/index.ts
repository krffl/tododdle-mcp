#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ToDoddleApiClient } from './api-client.js';
import { loadMcpConfig } from './config.js';
import { createToDoddleMcpServer } from './server.js';
import { ensureManagedUploadRoot } from './upload-source.js';

async function main() {
  const config = loadMcpConfig();
  await ensureManagedUploadRoot(config.managedUploadRoot);
  const server = createToDoddleMcpServer(new ToDoddleApiClient(config), {
    uploadRoots: config.uploadRoots,
    managedUploadRoot: config.managedUploadRoot,
    maxUploadBytes: config.maxUploadBytes,
  });
  await server.connect(new StdioServerTransport());
  console.error('ToDoddle MCP server connected over stdio');
}

main().catch((error) => {
  console.error('ToDoddle MCP server failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
