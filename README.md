# ToDoddle MCP Server

The official Model Context Protocol stdio server for [ToDoddle](https://tododdle.com). It gives MCP-compatible agents a bounded interface for project context, task management, comments, and time tracking through ToDoddle's hosted API.

The package contains no ToDoddle application or database code. It is a small stdio client that authenticates as an Agent Connection and calls the hosted API.

Agent work claims let any connected agent indicate that it is actively handling a task without becoming the human assignee. Claims use the configured Agent Connection label, an opaque run ID, and an expiring lease.

## Requirements

- Node.js 20 or newer
- A ToDoddle Agent Connection client ID and client secret
- Scopes and project grants configured for that Agent Connection in ToDoddle

## Configure

Create an Agent Connection in ToDoddle, grant it only the scopes and projects it needs, and copy its client ID and one-time client secret. The examples follow npm's current `latest` release so restarted clients receive capability and security updates.

### Codex

Add the server from a terminal:

```bash
codex mcp add tododdle \
  --env TODODDLE_CLIENT_ID=your_client_id \
  --env TODODDLE_CLIENT_SECRET=your_client_secret \
  -- npx --yes --prefer-online tododdle-mcp@latest

codex mcp list
```

Codex desktop, the CLI, and the IDE extension share the MCP configuration in `~/.codex/config.toml`. For project-specific configuration, add the same server to `.codex/config.toml` in a trusted project. Restart the server after changing credentials or scopes.

See the [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp) for configuration and troubleshooting.

### Claude Code

Install the server for your user account so it is available across projects:

```bash
claude mcp add tododdle --scope user \
  --env TODODDLE_CLIENT_ID=your_client_id \
  --env TODODDLE_CLIENT_SECRET=your_client_secret \
  -- npx --yes --prefer-online tododdle-mcp@latest

claude mcp get tododdle
```

Run `/mcp` inside Claude Code to inspect the connection. On native Windows, place `cmd /c` before `npx` in the command. See the [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp) for scope options and diagnostics.

### Cursor

Add this configuration to `~/.cursor/mcp.json` for all projects, or to `.cursor/mcp.json` for one project:

```json
{
  "mcpServers": {
    "tododdle": {
      "command": "npx",
      "args": ["--yes", "--prefer-online", "tododdle-mcp@latest"],
      "env": {
        "TODODDLE_CLIENT_ID": "your_client_id",
        "TODODDLE_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

Do not commit a project-level configuration containing real credentials. Restart Cursor after changing the configuration; ToDoddle tools will then be available to Agent. See the [Cursor MCP documentation](https://docs.cursor.com/context/model-context-protocol) for configuration and status controls.

For every client, `npx` downloads the package to npm's cache. Cloning ToDoddle or running a local ToDoddle service is not required.

## Codex Workflow Guidance

The MCP server provides capabilities; the optional `tododdle-workflow` skill provides a disciplined operating process for choosing and using them. It tells Codex to reuse verified project context, make the minimum targeted reads, load full context only for substantial work, keep status and blockers accurate, leave durable comments, verify before completion, and avoid inventing time.

The npm package includes a Codex plugin containing this skill. Configure the MCP server first using the Codex instructions above, then add the ToDoddle plugin marketplace:

```bash
codex plugin marketplace add krffl/tododdle-mcp
```

Restart Codex, open the Plugins Directory, select **ToDoddle**, and install the plugin. Codex can invoke the skill automatically when a request concerns tracked work, or you can invoke it explicitly as `$tododdle-workflow`.

Installing the plugin does not create or expand ToDoddle credentials, scopes, or project grants. The skill declares the separately configured `tododdle` MCP server as a dependency.

### Repository Policy

When ToDoddle should be mandatory for one repository, merge the relevant rules from [`examples/AGENTS.tododdle.md`](examples/AGENTS.tododdle.md) into that repository's `AGENTS.md`. The policy makes tracking updates durable repository guidance; the skill remains the reusable workflow.

## Tools

### Read And Plan

- `list_projects`
- `get_project`
- `get_project_context`
- `list_plans`
- `get_plan`
- `list_sections`
- `get_section`
- `list_project_members`
- `list_project_documents`
- `get_document_download_url`
- `list_notes`
- `get_note`
- `list_tasks`
- `get_work_queue`
- `get_focus_list`
- `add_task_to_focus`
- `move_focus_task`
- `remove_task_from_focus`
- `get_task`
- `get_project_brief`
- `list_project_artifacts`
- `get_project_artifact`
- `get_agent_inbox`

### Manage Tasks

- `claim_task`
- `release_task`
- `create_task`
- `update_task`
- `transition_task`
- `preview_task_move`
- `move_task`
- `set_task_blocker`
- `add_task_comment`
- `acknowledge_agent_reply`
- `archive_task`

`claim_task` creates or refreshes a connection-labelled work lease and can mark the agent run as `ACTIVE` or `WAITING`; `release_task` ends that lease without changing task status or human assignment. A conflicting live claim identifies the Agent Connection already handling the task. `preview_task_move` reports section automation and hierarchy blockers before a same-project plan move. `move_task` and `archive_task` are marked destructive because a destination section may archive the task. Task deletion is intentionally unavailable.

Task create/update accepts `TASK`, `FEATURE`, `EPIC`, `BUG`, `RESEARCH`, and `ACTION_ITEM`. Section create/update supports `SET_KIND` alongside status, priority, assignee, and archive entry actions.

### Manage Project Structure

- `create_project`, `update_project`, `archive_project`, `restore_project`
- `create_plan`, `update_plan`, `move_plan`, `archive_plan`, `restore_plan`
- `create_section`, `update_section`, `move_section`, `archive_section`, `restore_section`

Archive operations are destructive and require client approval. Permanent deletion is intentionally unavailable.

### Manage Notes

- `create_note`
- `update_note`
- `archive_note`

Notes are organization-scoped and unavailable to project-only connections.

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
- `list_artifact_revisions`
- `link_project_artifacts`

### Upload Files

- `upload_project_document`
- `attach_file_to_task`

Each tool accepts either an approved local `filePath` or an HTTPS `sourceUrl`. Local paths are disabled until `TODODDLE_UPLOAD_ROOTS` is configured. Files stream directly from this local MCP process to ToDoddle's short-lived Bunny upload URL; file bodies are never placed in MCP JSON messages.

Use `get_document_download_url` with a `projectId` and `documentId` returned by `list_project_documents` to obtain a five-minute tokenized URL. The URL grants access only to that ready document and should not be stored in comments or other durable project context. Video documents return a protected stream URL when the workspace subscription permits playback.

The server also provides task, project, and project-artifact resource templates plus `triage_work` and `daily_status` prompts.

## Permissions

Tools never expand the Agent Connection's authority. Every request is checked against all three layers:

1. The Agent Connection's granted scopes.
2. Its granted projects.
3. The authorizing user's organization and project permissions.

Configure scopes and project grants in ToDoddle under **Agent Connections**. Scopes are not requested by or stored in this package.

Common scopes include:

- `projects:read` and `projects:write`
- `tasks:read` and `tasks:write`
- `context:read` and `context:write`
- `time:read` and `time:write`
- `documents:read` and `documents:write`

Uploading a project document requires `projects:read` and `documents:write`. Attaching a new upload to a task also requires `tasks:write`.

## Environment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `TODODDLE_CLIENT_ID` | Yes | None | Agent Connection identifier |
| `TODODDLE_CLIENT_SECRET` | Yes | None | Agent Connection secret |
| `TODODDLE_BASE_URL` | No | `https://www.tododdle.com` | Hosted API origin; HTTPS is required except for loopback development |
| `TODODDLE_UPLOAD_ROOTS` | For local uploads | None | Platform path-delimited list of directories the MCP may read for uploads |
| `TODODDLE_MAX_UPLOAD_BYTES` | No | `1073741824` | Local safety ceiling; the hosted API may enforce a lower limit |

On macOS and Linux, separate upload roots with `:`; on Windows, use `;`. The server resolves symlinks and rejects files outside these roots. Add only directories whose contents you are comfortable allowing an approved MCP tool call to upload. HTTPS sources reject embedded credentials, private-network destinations, unsafe redirects, oversized responses, and empty files.

Use the final API origin directly. Legacy `trackingti.me` URLs redirect to ToDoddle and are rejected because cross-origin redirects must not forward bearer credentials.

Tokens are held in memory only and refreshed automatically. The client secret is sent only to ToDoddle's hosted token endpoint. Server diagnostics go to stderr so stdout remains reserved for MCP JSON-RPC.

## Development

```bash
npm install
npm run format:check
npm run type-check
npm run test:coverage
npm run check:api-parity -- /path/to/tododdle/src/config/api-route-inventory.json
npm audit --audit-level=low
npm pack --dry-run
```

`config/external-api-parity.json` is the checked contract between the model-callable tool registry and ToDoddle's External API inventory. Every discovered tool must appear in the manifest, every tool is invoked with schema-valid input in tests, and every resulting API method/path must match its declared mapping. External methods that are transport-only, compatibility-only, aggregated by another tool, or superseded have an explicit reviewed exception instead of disappearing from the audit.

When the application External API changes, compare its generated `src/config/api-route-inventory.json` with this manifest before releasing either side. The current reviewed surface accounts for every External API method with no missing or extra entries; tool totals are derived from the registry and manifest rather than a historical hard-coded count.

Run the MCP package from source:

```bash
TODODDLE_CLIENT_ID=... \
TODODDLE_CLIENT_SECRET=... \
TODODDLE_UPLOAD_ROOTS="$PWD:/Users/you/Desktop" \
npm run dev
```

The npm `prepack` lifecycle builds `dist/` automatically. `prepublishOnly` runs the complete package test and coverage thresholds before publication.

## Release Safety

- Review `npm pack --dry-run` and verify that only the declared runtime, plugin, skill, examples, parity manifest, documentation, license, and package metadata are present.
- Publish from a tagged release with npm trusted publishing/provenance where available.
- Treat tool removal, renaming, or incompatible input changes as major releases.
- Keep generated ToDoddle connection snippets pinned to a tested package version.

## License

MIT
