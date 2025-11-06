#!/usr/bin/env node
import 'dotenv/config';
import { createMCPServer } from './server.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    logger.info('Starting MCP server...');
    const server = await createMCPServer();
    logger.info('MCP server started successfully');
  } catch (error) {
    logger.error('Failed to start MCP server', { error });
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unhandled error', { error });
  process.exit(1);
});
