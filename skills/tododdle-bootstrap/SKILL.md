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
7. Check the workspace setup. See [Check the Workspace](#check-the-workspace).
8. Tell the user to start a new agent task or restart the agent host. Repository instructions are loaded at task start. Until then, the user can invoke `$tododdle-workflow` explicitly.
9. End with the short orientation in [Orientation](#orientation).

Example:

```bash
node <skill-directory>/scripts/update-agents.mjs \
  --agents-file <repository-root>/AGENTS.md \
  --project-id eTPg74ysbg \
  --project-name ToDoddle \
  --dry-run
```

## Check the Workspace

Call `get_workspace_setup` once. It returns the same Getting started checklist that workspace admins see in the app.

- For each step with `done: false`, explain in one sentence why it helps. Give its `href` link. When a step has a `limit`, give the `limit.message` and the `limit.upgradeHref` link instead.
- Lead with the agent steps: **Connect an agent** and **Ask for a review when an agent hands off**. The hand-off rule asks the ticket creator, or else the assignee, so it always has a reviewer.
- When `workMode` is null, ask how the user works: just them, a team, or a team with agents. The user saves the choice in the app. This tool cannot save it.
- The MCP cannot change workspace settings or rules. Do not try. Give the link, and let the user decide.
- When every step is done, say so in one line and move on.
- A `403 permission_denied` result means the user is not a workspace owner or admin. Say that a workspace admin can turn on the hand-off review rule, and continue. A missing `context:read` scope or an unknown tool means an older connection or server. Skip this check and say so.

## Orientation

Do not send the user on a tour of the web app. Show these three lines, then one link:

- **My Work** lists the review requests that agents send you.
- **The ticket page** shows each hand-off comment, with the outcome and how it was checked.
- **The agent inbox** is where agents read your replies and review answers at the start of each session.

Link to the Getting started help: `https://app.tododdle.com/docs/getting-started/welcome`. When `get_workspace_setup` returned `visible: true`, also say that the Getting started checklist is on the workspace overview page, and give the **Create a project** step's `href`.

## Safety Rules

- Preserve all content outside `<!-- tododdle:start -->` and `<!-- tododdle:end -->`.
- Update the existing marked block instead of adding a second block.
- Stop on unmatched or duplicate markers. Do not guess how to repair them.
- Never put tokens, connection strings, user IDs, or other secrets in the block.
- Do not replace broader repository policy with the ToDoddle block.
- Do not claim that setup is active until the effective instruction file is updated and the user has been told to reload it.
- Never change workspace settings, rules, members, or the subscription plan during bootstrap.
