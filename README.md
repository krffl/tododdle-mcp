# trackingti.me MCP Server

The official Model Context Protocol stdio server for [trackingti.me](https://trackingti.me). It gives MCP-compatible agents a bounded interface for project context, task management, comments, and time tracking through trackingti.me's hosted API.

The package contains no trackingti.me application or database code. It is a small stdio client that authenticates as an Agent Connection and calls the hosted API.

## Requirements

- Node.js 18 or newer
- A trackingti.me Agent Connection client ID and client secret
- Scopes and project grants configured for that Agent Connection in trackingti.me

## Configure

Create an Agent Connection in trackingti.me, grant it only the scopes and projects it needs, and copy its client ID and one-time client secret. Use a pinned package version so tool changes are deliberate.

### Codex

Add the server from a terminal:

```bash
codex mcp add trackingtime \
  --env TRACKINGTIME_CLIENT_ID=your_client_id \
  --env TRACKINGTIME_CLIENT_SECRET=your_client_secret \
  -- npx -y trackingtime-mcp@2.0.0

codex mcp list
```

Codex desktop, the CLI, and the IDE extension share the MCP configuration in `~/.codex/config.toml`. For project-specific configuration, add the same server to `.codex/config.toml` in a trusted project. Restart the server after changing credentials or scopes.

See the [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp) for configuration and troubleshooting.

### Claude Code

Install the server for your user account so it is available across projects:

```bash
claude mcp add trackingtime --scope user \
  --env TRACKINGTIME_CLIENT_ID=your_client_id \
  --env TRACKINGTIME_CLIENT_SECRET=your_client_secret \
  -- npx -y trackingtime-mcp@2.0.0

claude mcp get trackingtime
```

Run `/mcp` inside Claude Code to inspect the connection. On native Windows, place `cmd /c` before `npx` in the command. See the [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp) for scope options and diagnostics.

### Cursor

Add this configuration to `~/.cursor/mcp.json` for all projects, or to `.cursor/mcp.json` for one project:

```json
{
  "mcpServers": {
    "trackingtime": {
      "command": "npx",
      "args": ["-y", "trackingtime-mcp@2.0.0"],
      "env": {
        "TRACKINGTIME_CLIENT_ID": "your_client_id",
        "TRACKINGTIME_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

Do not commit a project-level configuration containing real credentials. Restart Cursor after changing the configuration; trackingti.me tools will then be available to Agent. See the [Cursor MCP documentation](https://docs.cursor.com/context/model-context-protocol) for configuration and status controls.

For every client, `npx` downloads the package to npm's cache. Cloning trackingti.me or running a local trackingti.me service is not required.

## Tools

### Read And Plan

- `list_projects`
- `get_project_context`
- `get_work_queue`
- `get_task`
- `get_project_brief`
- `list_project_artifacts`
- `get_project_artifact`
- `get_agent_inbox`

### Manage Tasks

- `create_task`
- `update_task`
- `transition_task`
- `move_task`
- `set_task_blocker`
- `add_task_comment`
- `acknowledge_agent_reply`
- `archive_task`

`archive_task` is destructive and requires client approval. Task deletion is intentionally unavailable.

### Track Time

- `get_active_time_entries`
- `list_project_time`
- `list_task_time`
- `start_task_timer`
- `stop_task_timer`
- `log_task_time`
- `update_time_entry`
- `archive_time_entry`

`archive_time_entry` is destructive and requires client approval.

### Manage Project Context

- `create_project_artifact`
- `update_project_artifact`
- `transition_project_artifact`
- `link_artifact_task`
- `add_artifact_comment`

The server also provides task, project, and project-artifact resource templates plus `triage_work` and `daily_status` prompts.

## Permissions

Tools never expand the Agent Connection's authority. Every request is checked against all three layers:

1. The Agent Connection's granted scopes.
2. Its granted projects.
3. The authorizing user's organization and project permissions.

Configure scopes and project grants in trackingti.me under **Agent Connections**. Scopes are not requested by or stored in this package.

Common scopes include:

- `projects:read` and `projects:write`
- `tasks:read` and `tasks:write`
- `context:read` and `context:write`
- `time:read` and `time:write`

## Environment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `TRACKINGTIME_CLIENT_ID` | Yes | None | Agent Connection identifier |
| `TRACKINGTIME_CLIENT_SECRET` | Yes | None | Agent Connection secret |

Tokens are held in memory only and refreshed automatically. The client secret is sent only to trackingti.me's hosted token endpoint. Server diagnostics go to stderr so stdout remains reserved for MCP JSON-RPC.

## Development

```bash
npm install
npm run type-check
npm test
npm pack --dry-run
```

Run the MCP package from source:

```bash
TRACKINGTIME_CLIENT_ID=... \
TRACKINGTIME_CLIENT_SECRET=... \
npm run dev
```

The npm `prepack` lifecycle builds `dist/` automatically. `prepublishOnly` runs the complete package test before publication.

## Release Safety

- Review `npm pack --dry-run` and verify that only `dist/`, `README.md`, `LICENSE`, and package metadata are present.
- Publish from a tagged release with npm trusted publishing/provenance where available.
- Treat tool removal, renaming, or incompatible input changes as major releases.
- Keep generated trackingti.me connection snippets pinned to a tested package version.

## License

MIT
