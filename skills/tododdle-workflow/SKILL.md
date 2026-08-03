---
name: tododdle-workflow
description: Use ToDoddle as the work ledger for project planning, implementation, status updates, blockers, comments, and time tracking. Trigger when the user asks to inspect, plan, start, update, complete, or report on work managed in ToDoddle, or when repository instructions require ToDoddle updates. Do not trigger for casual discussion that does not change or review tracked work.
---

# ToDoddle Workflow

Use the `tododdle` MCP tools for live project state. Make the fewest calls needed for the request.

## Choose the Minimum Workflow

Reuse project, plan, section, task, and artifact IDs previously returned by ToDoddle tools in the active conversation or its compaction summary. These are verified working context, not guesses. Do not rediscover stable IDs merely to confirm them. Never invent IDs, statuses, scopes, or relationships from general model memory.

Branch by request type:

- **Unknown or ambiguous project:** Use `list_projects` once. Skip it when the project is already unambiguous.
- **Simple lookup:** Use the narrowest read tool. Prefer `list_tasks` with known project, plan, or section filters for task lists; use `get_task` for one task and `get_work_queue` for operational, overdue, or unassigned work. Do not load the brief or full project context.
- **Substantial planning or implementation:** Read `get_project_brief` and `get_project_context` once per continuous workstream, then find the existing task and supporting artifacts. Reuse that context until the project changes or relevant decisions may have changed.
- **Known-item mutation:** Refresh only the affected resource when current state or `updatedAt` is required, then perform the requested mutation. Do not reload unrelated hierarchy or project context.
- **Continuation:** Reuse verified IDs and stable context retained in the conversation or compaction summary. Refresh volatile fields such as status, comments, blockers, and `updatedAt` only when their current value matters.

Reuse an existing task when it covers the request. Create a task only when the work is genuinely untracked. Do not fan out across every status or endpoint unless the user explicitly requests terminal-state accounting or a complete audit.

Keep list requests bounded and paginate rather than requesting an entire organization history.

## Build Project Structure

- Use project, plan, and section read tools before creating structure so names and workflow stages are not duplicated.
- Create plans for distinct workstreams or boards and sections for workflow stages. Configure section entry actions only when the requested workflow is explicit.
- Use `list_project_members` to select assignees and artifact owners; never guess a user ID.
- Use `list_project_documents`, Note tools, revisions, and artifact relationships when the work depends on existing supporting context.
- Use optimistic concurrency for project, plan, section, and Note updates or ordering. Reload after a conflict.
- Archive projects, plans, sections, or Notes only with explicit approval. Permanent deletion is unavailable.

## Manage Execution

- Transition the relevant task to the active status when substantive work begins.
- When beginning substantive execution, use `claim_task` with a stable opaque run ID for the current agent run. Refresh the same claim before its lease expires, use `WAITING` while paused for a short dependency or reply, and call `release_task` when execution stops, completes, or hands off. Claims identify the authenticated Agent Connection by its configured label and never replace the human assignee. Do not claim tasks for simple reads or planning-only discussion.
- Treat a conflicting active claim as useful coordination state. Do not take it over until it expires or the owning Agent Connection releases it; report the connection label without assuming which agent vendor or model is behind it.
- Keep task kind, parent, section, assignee, due date, priority, and blocker relationships accurate when the work changes them.
- Add comments only for durable information: decisions, meaningful progress, validation results, blockers, or handoff context.
- Use `preview_task_move` before moving a task between plans. Clear parent or active-child links reported by the preview, and call out any destination automation that changes or archives the task.
- When blocked, set the blocker relationship when a concrete blocking task exists and explain the impact in one concise comment.
- Read Agent Connection replies with `get_agent_inbox` when continuing prior agent work; acknowledge a reply only after handling it.

Do not create bookkeeping churn for tiny exploratory actions. Prefer one useful checkpoint over a stream of narration.

## Finish Work

1. Run the verification appropriate to the work.
2. Add a concise final comment containing the outcome, notable decisions, and verification performed.
3. Transition the task to `COMPLETE` only when the requested outcome is actually achieved.
4. Release the active agent work claim after the final durable update.
5. Leave incomplete work active and state what remains.

Use `archive_task` only when the user requests archival and approves the destructive action. Do not substitute archival for completion.

## Track Time

Use time tools when the user asks to track time or repository guidance makes time tracking expected:

- Check `get_active_time_entries` before starting a timer when duplicate timing would be confusing.
- Use `start_task_timer` and `stop_task_timer` for live work.
- Use `log_task_time` for known historical intervals.
- Correct entries with optimistic concurrency.
- Archive a time entry only with explicit approval.

Do not invent elapsed time or silently estimate it as recorded time.

## Handle Missing Access

If the MCP server is unavailable or a scope/project grant blocks an operation:

1. Report the missing server, scope, or grant precisely.
2. Do not fabricate a successful tracking update.
3. Continue non-destructive local work when reasonable, and clearly list the tracking updates still pending.
