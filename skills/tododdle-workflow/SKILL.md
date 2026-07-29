---
name: tododdle-workflow
description: Use ToDoddle as the work ledger for project planning, implementation, status updates, blockers, comments, and time tracking. Trigger when the user asks to inspect, plan, start, update, complete, or report on work managed in ToDoddle, or when repository instructions require ToDoddle updates. Do not trigger for casual discussion that does not change or review tracked work.
---

# ToDoddle Workflow

Use the `tododdle` MCP tools for live project state. Never infer IDs, statuses, scopes, or relationships from memory.

## Start With Context

1. Use `list_projects` when the project is not already unambiguous.
2. Read `get_project_brief` and `get_project_context` before planning substantial work.
3. Use `get_work_queue`, `get_task`, and artifact tools to find existing work and supporting decisions.
4. Reuse an existing task when it covers the request. Create a task only when the work is genuinely untracked.

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
4. Leave incomplete work active and state what remains.

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
