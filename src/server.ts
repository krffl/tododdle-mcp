import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';
import { registerTools, tools } from './tools/index.js';
import { MCPError } from './errors/handler.js';

export async function createMCPServer(): Promise<Server> {
  const server = new Server(
    {
      name: process.env.MCP_SERVER_NAME || 'trackingtime-mcp',
      version: process.env.MCP_SERVER_VERSION || '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all tools
  registerTools();

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const allTools = Array.from(tools.values()).map((def) => def.tool);
    logger.debug('Listing tools', { count: allTools.length });
    return {
      tools: allTools,
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info('Tool called', { name, args });

    const toolDef = tools.get(name);
    if (!toolDef) {
      throw new MCPError(`Tool not found: ${name}`, 'TOOL_NOT_FOUND');
    }

    try {
      const result = await toolDef.handler(args || {});
      logger.debug('Tool executed successfully', { name });
      return result;
    } catch (error) {
      logger.error('Tool execution failed', { name, error });
      throw error;
    }
  });

  // Set up transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP server started', {
    name: server.name,
    version: server.version,
    toolCount: tools.size,
  });

  return server;
}
