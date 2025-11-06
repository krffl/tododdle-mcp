# trackingti.me MCP Server

A Model Context Protocol (MCP) server that enables AI systems (Claude, ChatGPT, etc.) to interact with trackingti.me's external API. This server translates MCP tool calls into HTTP requests to the trackingti.me external API using OAuth2 client credentials flow.

## Features

- **23 MCP Tools**: Full access to projects, plans, tasks, notes, and todos
- **OAuth2 Authentication**: Automatic token management with refresh
- **Type Safety**: Full TypeScript implementation with Zod validation
- **Error Handling**: Comprehensive error mapping and rate limit detection
- **Retry Logic**: Automatic retry for transient failures with exponential backoff
- **Logging**: Structured logging with configurable levels

## Prerequisites

- Node.js v18+ (LTS recommended)
- npm or yarn
- trackingti.me API credentials (Client ID and Client Secret)

## Installation

### Option 1: Install from npm (Recommended)

```bash
npm install -g trackingtime-mcp
```

Or use with npx (no installation needed):
```bash
npx trackingtime-mcp
```

### Option 2: Install from source

1. Clone the repository:
```bash
git clone <repository-url>
cd trackingti.me-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### Environment Variables

Create a `.env` file in the project root (or copy from `.env.example`):

```env
# External API Configuration
TRACKINGTIME_API_BASE_URL=https://api.trackingti.me
TRACKINGTIME_CLIENT_ID=your_client_id
TRACKINGTIME_CLIENT_SECRET=your_client_secret
TRACKINGTIME_SCOPES=projects:read projects:write tasks:read tasks:write plans:read plans:write notes:read notes:write todos:read todos:write

# MCP Server Configuration
MCP_SERVER_NAME=trackingtime-mcp
MCP_SERVER_VERSION=1.0.0
LOG_LEVEL=info
```

### Required Environment Variables

- `TRACKINGTIME_CLIENT_ID`: Your trackingti.me API client ID
- `TRACKINGTIME_CLIENT_SECRET`: Your trackingti.me API client secret
- `TRACKINGTIME_SCOPES`: Space-separated list of OAuth2 scopes

### Optional Environment Variables

- `TRACKINGTIME_API_BASE_URL`: API base URL (default: `https://api.trackingti.me`)
- `MCP_SERVER_NAME`: MCP server name (default: `trackingtime-mcp`)
- `MCP_SERVER_VERSION`: Server version (default: `1.0.0`)
- `LOG_LEVEL`: Logging level - `debug`, `info`, `warn`, or `error` (default: `info`)
- `LOG_FORMAT`: Log format - `json` for JSON format, or omit for text format

## Usage

### Development Mode

Run the server in development mode with hot reload:

```bash
npm run dev
```

### Production Mode

Build and run:

```bash
npm run build
npm start
```

### Claude Desktop Configuration

Add the following to your Claude Desktop MCP settings file (typically `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

**Option A: Using npm package (Recommended)**

If you installed globally with `npm install -g trackingtime-mcp`:
```json
{
  "mcpServers": {
    "trackingtime": {
      "command": "trackingtime-mcp",
      "env": {
        "TRACKINGTIME_API_BASE_URL": "https://api.trackingti.me",
        "TRACKINGTIME_CLIENT_ID": "your_client_id",
        "TRACKINGTIME_CLIENT_SECRET": "your_client_secret",
        "TRACKINGTIME_SCOPES": "projects:read projects:write tasks:read tasks:write plans:read plans:write notes:read notes:write todos:read todos:write",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Option B: Using npx (no installation needed)**

```json
{
  "mcpServers": {
    "trackingtime": {
      "command": "npx",
      "args": ["-y", "trackingtime-mcp"],
      "env": {
        "TRACKINGTIME_API_BASE_URL": "https://api.trackingti.me",
        "TRACKINGTIME_CLIENT_ID": "your_client_id",
        "TRACKINGTIME_CLIENT_SECRET": "your_client_secret",
        "TRACKINGTIME_SCOPES": "projects:read projects:write tasks:read tasks:write plans:read plans:write notes:read notes:write todos:read todos:write",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Option C: Using local installation**

If you cloned and built the repository locally:
```json
{
  "mcpServers": {
    "trackingtime": {
      "command": "node",
      "args": ["/absolute/path/to/trackingti.me-mcp/dist/index.js"],
      "env": {
        "TRACKINGTIME_API_BASE_URL": "https://api.trackingti.me",
        "TRACKINGTIME_CLIENT_ID": "your_client_id",
        "TRACKINGTIME_CLIENT_SECRET": "your_client_secret",
        "TRACKINGTIME_SCOPES": "projects:read projects:write tasks:read tasks:write plans:read plans:write notes:read notes:write todos:read todos:write",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Note**: Replace `/absolute/path/to/trackingti.me-mcp/dist/index.js` with the actual absolute path to your built server file.

## Available Tools

### Projects (5 tools)

- `list_projects` - List all projects with optional filtering
- `get_project` - Get details of a specific project
- `create_project` - Create a new project
- `update_project` - Update an existing project
- `delete_project` - Delete a project

### Plans (5 tools)

- `list_plans` - List all plans for a project
- `get_plan` - Get details of a specific plan
- `create_plan` - Create a new plan
- `update_plan` - Update an existing plan
- `delete_plan` - Delete a plan

### Tasks (5 tools)

- `list_tasks` - List tasks with extensive filtering options
- `get_task` - Get details of a specific task
- `create_task` - Create a new task
- `update_task` - Update an existing task
- `delete_task` - Delete a task

### Notes (5 tools)

- `list_notes` - List notes in an organization
- `get_note` - Get details of a specific note
- `create_note` - Create a new note
- `update_note` - Update an existing note
- `delete_note` - Delete a note

### Todos (3 tools)

- `list_todos` - List user's todo items
- `add_todo` - Add a task to user's todo list
- `remove_todo` - Remove a task from user's todo list

## Example Usage

### Creating a Project and Task

```
1. Create a project: create_project(name="My Project", description="A new project")
2. List projects to get the project ID
3. Create a plan: create_plan(projectId="...", name="Sprint 1")
4. Create a task: create_task(projectId="...", planId="...", sectionId="...", title="Complete feature")
```

### Managing Todos

```
1. List todos: list_todos()
2. Add a task to todos: add_todo(taskId="...")
3. Remove from todos: remove_todo(taskId="...")
```

## Error Handling

The server provides comprehensive error handling:

- **401 Unauthorized**: Authentication failed - credentials are invalid
- **403 Forbidden**: Access denied - insufficient permissions
- **404 Not Found**: Resource not found
- **429 Rate Limit**: Rate limit exceeded - includes reset time information
- **500+ Server Errors**: Server-side errors with automatic retry

All errors include context information for debugging, including:
- HTTP method and URL
- Status code
- Rate limit information (when available)
- Error messages from the API

## Rate Limiting

The server respects rate limits from the API:
- Detects `X-RateLimit-*` headers
- Provides reset time information in error messages
- Logs rate limit information for monitoring

## Retry Logic

The server automatically retries failed requests:
- Retries network errors and 5xx server errors
- Uses exponential backoff (1s, 2s, 4s)
- Maximum 3 retries per request
- Does not retry 4xx client errors

## Logging

Structured logging is available with configurable levels:

- `debug`: Detailed information for debugging
- `info`: General information (default)
- `warn`: Warning messages
- `error`: Error messages

Set `LOG_FORMAT=json` for JSON-formatted logs.

## Development

### Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Run in development mode with tsx
- `npm start` - Run the built server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - Type check without building

### Project Structure

```
src/
├── index.ts              # Entry point
├── server.ts             # MCP server setup
├── tools/                # Tool implementations
│   ├── index.ts          # Tool registry
│   ├── projects.ts       # Project tools
│   ├── plans.ts          # Plan tools
│   ├── tasks.ts          # Task tools
│   ├── notes.ts          # Note tools
│   └── todos.ts          # Todo tools
├── api/
│   ├── client.ts         # HTTP client
│   ├── auth.ts           # OAuth2 authentication
│   └── types.ts          # API types
├── errors/
│   └── handler.ts        # Error handling
└── utils/
    ├── validation.ts      # Validation utilities
    └── logger.ts          # Logging
```

## Troubleshooting

### Authentication Errors

- Verify `TRACKINGTIME_CLIENT_ID` and `TRACKINGTIME_CLIENT_SECRET` are correct
- Ensure the API client has the required scopes
- Check that the API base URL is correct

### Connection Errors

- Verify network connectivity
- Check that `TRACKINGTIME_API_BASE_URL` is accessible
- Review firewall/proxy settings

### Tool Not Found Errors

- Ensure the server is built (`npm run build`)
- Verify the tool name is correct (case-sensitive)
- Check server logs for registration errors

### Rate Limit Errors

- Review rate limit headers in error messages
- Wait until the reset time before retrying
- Consider reducing request frequency

## Security Considerations

1. **Credentials**: Never commit `.env` files or expose credentials
2. **Token Storage**: Tokens are cached in memory only, never persisted
3. **HTTPS**: Always use HTTPS for API communication
4. **Scopes**: Use minimal required scopes for your use case
5. **Error Messages**: Error messages don't expose sensitive information

## Publishing to npm

To publish this package to npm:

1. **Ensure you're logged in to npm:**
   ```bash
   npm login
   ```

2. **Verify package name availability:**
   Check if `trackingtime-mcp` is available on npm. If not, update the `name` field in `package.json`.

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Verify what will be published:**
   ```bash
   npm pack --dry-run
   ```
   This shows what files will be included in the package.

5. **Publish to npm:**
   ```bash
   npm publish
   ```
   
   For the first publish, you may want to use:
   ```bash
   npm publish --access public
   ```

6. **Update version for subsequent releases:**
   ```bash
   npm version patch  # for bug fixes (1.0.0 -> 1.0.1)
   npm version minor  # for new features (1.0.0 -> 1.1.0)
   npm version major  # for breaking changes (1.0.0 -> 2.0.0)
   npm publish
   ```

**Note**: The `prepublishOnly` script will automatically build the project before publishing, so you don't need to manually build unless you want to test first.

## License

MIT

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [MCP SDK for Node.js](https://github.com/modelcontextprotocol/typescript-sdk)
- [trackingti.me External API Documentation](./EXTERNAL_API_ENDPOINTS.md)
