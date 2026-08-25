---
name: tododdle-workflow
description: Use ToDoddle as the work ledger for project boards, lanes, tickets, implementation, status updates, blockers, comments, time tracking, and safe recurring checks. Trigger when the user asks to inspect, plan, start, update, complete, report on, or schedule work managed in ToDoddle, or when repository instructions require ToDoddle updates. Do not trigger for casual discussion that does not change or review tracked work.
---

# ToDoddle Workflow

Use the `tododdle` MCP tools for live project state. Make the fewest calls needed.

## Route the Request

Reuse verified IDs from the current conversation or its compaction summary. The API keeps `planId`, `sectionId`, and `taskId` for board, lane, and ticket IDs. Never invent or rediscover a stable ID.

- **Unknown project:** Call `list_projects` once. Skip it when the project is clear.
- **Simple lookup:** Use the narrowest read tool. Prefer compact, bounded lists. Use `search_project` when the project is known but the item ID is not. Follow one selected result with its narrow get tool. Use `get_ticket` for one known ticket and `get_tickets` for 1–20 known tickets. Do not scan each board or lane to find an item. Do not request full list detail unless it is necessary.
- **Batch read:** Select tickets from a bounded list, then call `get_tickets`. Keep `commentMode: none` unless comments matter. Use `latest_update` for a handoff. Use `all` only for full history.
- **Substantial work:** Read `get_project_context` once for the workstream. It returns the brief and artifact summaries. Use `get_project_brief` or `get_project_artifact` only when the full content is relevant. Find the existing ticket and reuse this context until it can be stale.
- **Known mutation:** Refresh only the affected item when current state or `updatedAt` matters. Do not reload unrelated hierarchy.
- **Continuation:** Reuse stable context. Refresh only volatile status, comments, blockers, claims, and concurrency fields.

Reuse an existing ticket when it covers the request. Create one only for untracked work. Keep list calls bounded and paginate only as far as needed. Do not fan out across all statuses or endpoints unless the user asks for a complete audit.

Before choosing new work or answering an operational “what’s next,” call `get_agent_inbox`. Handle replies, mentions, assignments, and handoffs before unrelated work. Acknowledge an item only after handling it.

## Execute Work

- Read before creating project structure. Do not duplicate boards or lanes. Use `list_project_members` for assignees; never guess a user ID.
- Transition the ticket to the active status when substantial work begins.
- For a known ticket, call `claim_ticket` with a unique run ID. Renew before expiry. Use `WAITING` only for a short pause. Release the claim when work stops, completes, or hands off. Do not claim for simple reads or planning.
- Respect another active claim. Report its Agent Connection label and wait for release or expiry.
- Keep ticket kind, parent, lane, assignee, due date, priority, and blockers accurate.
- Read typed attributes before changes. Use them for durable integration facts, never secrets.
- Read Context summaries before full Markdown. Fetch only the brief or artifacts needed for the current work. When you create or change artifact content, provide a current summary of no more than 500 characters in the same request. If an older client returns a missing-summary warning, update the summary before handoff.
- Use `preview_ticket_move` before moving between boards. Resolve reported parent, child, and automation effects.
- Keep optional review requests separate from ticket status. Use the bounded review tools only when a review is relevant. Read [project-work.md](references/project-work.md) for reviewer, checklist, and concurrency rules.
- Add comments only for decisions, useful progress, verification, blockers, or handoff evidence.
- Use optimistic concurrency for project, board, lane, Note, and other supported updates. Reload after a conflict.
- Archive only with explicit approval. Do not use archive as a substitute for completion.

For detailed project structure and execution rules, read [project-work.md](references/project-work.md).

## Finish Work

1. Run appropriate verification.
2. Add one typed `HANDOFF` comment with `## Outcome`, `## Verification`, and `## Remaining` when useful. Include stable links and immutable commit, release, document, or artifact IDs. Never store expiring URLs.
3. Set the ticket to `COMPLETE` only when the requested result is achieved.
4. Release the active claim after the durable update.
5. Keep incomplete work active and state what remains.

When resuming, read the agent inbox, handle the reply, then reload the linked item. Use a new run ID and refer to the prior handoff.

## Load Detailed Rules Only When Needed

- **Uploads or attachment review:** Read [files.md](references/files.md).
- **Time tracking:** Read [time-tracking.md](references/time-tracking.md).
- **Scheduled checks:** Read [scheduled-workflows.md](references/scheduled-workflows.md).
- **Support cases:** Read [support-cases.md](references/support-cases.md).

## Missing Access

If the MCP server, scope, or project grant blocks an operation:

1. State the exact missing server, scope, or grant.
2. Do not claim that the update succeeded.
3. Continue safe local work when reasonable and list the pending ToDoddle updates.
