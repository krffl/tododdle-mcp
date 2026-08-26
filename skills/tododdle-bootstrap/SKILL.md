---
name: tododdle-bootstrap
description: Add or repair ToDoddle workflow instructions in an existing repository. Use when a user asks to connect, bootstrap, install, or set up ToDoddle for a codebase. Do not use for ordinary tracked work after the repository is configured.
---

# ToDoddle Bootstrap

Bind one existing repository to one verified ToDoddle project. Keep the repository's other instructions unchanged.

## Bootstrap the Repository

1. Confirm that the `tododdle` MCP server is available. If it is missing, stop and explain how to configure it. Do not add credentials to repository files.
2. Verify the target project through ToDoddle. Reuse an explicit, previously verified project ID. Otherwise, list projects once and ask the user to choose when more than one project is plausible. Never infer an ID from a project name.
3. Find the repository root with `git rev-parse --show-toplevel`. Use the current directory only when it is not a Git repository.
4. Inspect the root instruction files. `AGENTS.override.md` takes precedence when it exists; otherwise use `AGENTS.md`. Create `AGENTS.md` when neither file exists. Tell the user when an override file becomes the target.
5. Run `scripts/update-agents.mjs` with the effective instruction file, verified project ID, and project name. Run it with `--dry-run` first, then without that flag after the result is safe.
6. Review the diff. Confirm that only the marked ToDoddle block changed. Do not commit or push unless the user asks.
7. Tell the user to start a new agent task or restart the agent host. Repository instructions are loaded at task start. Until then, the user can invoke `$tododdle-workflow` explicitly.

Example:

```bash
node <skill-directory>/scripts/update-agents.mjs \
  --agents-file <repository-root>/AGENTS.md \
  --project-id eTPg74ysbg \
  --project-name ToDoddle \
  --dry-run
```

## Safety Rules

- Preserve all content outside `<!-- tododdle:start -->` and `<!-- tododdle:end -->`.
- Update the existing marked block instead of adding a second block.
- Stop on unmatched or duplicate markers. Do not guess how to repair them.
- Never put tokens, connection strings, user IDs, or other secrets in the block.
- Do not replace broader repository policy with the ToDoddle block.
- Do not claim that setup is active until the effective instruction file is updated and the user has been told to reload it.
