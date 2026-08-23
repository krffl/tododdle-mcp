# Scheduled ToDoddle Workflows

Use these recipes to create opt-in scheduled tasks. Do not activate a schedule during plugin installation.

## Set Up a Recipe

1. Confirm the user's timezone, cadence, project scope, and allowed mutation level.
2. Confirm that the ToDoddle Agent Connection grants the required project and scopes.
3. Replace every angle-bracket placeholder in the selected prompt.
4. Run the prompt once in a normal chat. Fix missing access or overly broad results.
5. Create the schedule. Review its first runs before allowing mutations.

Use a task in an existing chat when later runs need that chat's context. Use a standalone task when each run should start from the saved prompt. A web task can use the connected ToDoddle plugin but cannot access a local repository. A desktop task that needs local files requires the project to remain available and the app to be running.

## Safety Rules

- Default to **read and report**.
- Reuse verified project, board, and lane IDs from the saved prompt. Refresh ticket state on each run.
- Bound every list request. Follow pagination only as far as the recipe requires. State when a report is partial.
- Find an existing ticket before creating one. Use a stable idempotency key for any repeated additive action.
- Write at most one useful summary comment per run. Do not narrate tool calls.
- Do not delete or archive records, change access, change billing, expose secrets, or mark work complete without current verification.
- Stop and report a missing scope, project grant, ambiguous project, concurrency conflict, or destructive follow-up.

## Recipe: Morning Control Tower

**Suggested cadence:** Weekdays at 8:30 AM local time  
**Required scopes:** `projects:read`, `tasks:read`  
**Mutation level:** Read and report

```text
Use $tododdle-workflow for project <project ID>. Reuse the verified project ID. Read the bounded active work queue, overdue work, and unassigned work. Summarize what needs attention today under Blocked, Overdue, Unassigned, In progress, and In review. Include stable ToDoddle links. Do not create, edit, move, complete, or archive tickets. If access is missing or a result is partial, say so clearly.
```

## Recipe: Ticket Review Sweep

**Suggested cadence:** Weekdays at 10:00 AM local time  
**Required scopes:** `projects:read`, `tasks:read`  
**Mutation level:** Read and report

This recipe covers tickets with the `REVIEW` status. Use `list_review_requests` separately when formal review requests need attention.

```text
Use $tododdle-workflow for project <project ID>. List active tickets with status REVIEW. Treat a ticket as stale after <number> days without an update. Read full ticket context only for stale or ambiguous results. Report the reviewer or owner action needed and include stable ToDoddle links. Do not approve, complete, reject, or comment on a ticket.
```

## Recipe: Weekly Backlog Hygiene

**Suggested cadence:** Fridays at 2:00 PM local time  
**Required scopes:** `projects:read`, `tasks:read`  
**Mutation level:** Read and report

```text
Use $tododdle-workflow for project <project ID>. Inspect a bounded active ticket set for likely duplicates, missing priority, missing ownership, stale in-progress work, invalid blocker state, and unclear titles. Do not change tickets. Give a short proposed-action list with stable ToDoddle links. State the page and item limits used and say when the audit is partial.
```

## Recipe: Weekly Roadmap Summary

**Suggested cadence:** Fridays at 3:00 PM local time  
**Required scopes:** `projects:read`, `tasks:read`  
**Mutation level:** Read and report

```text
Use $tododdle-workflow for project <project ID>. Summarize meaningful ticket movement since <reporting rule, such as the last 7 days>. Group the result under Completed, Active, In review, Blocked, and New risks. Prefer counts and important changes over a full ticket dump. Include stable ToDoddle links. Do not change project state. State when bounded results make the summary partial.
```

## Recipe: Agent Inbox Follow-up

**Suggested cadence:** Every two hours during working hours  
**Required scopes:** The scopes needed to read the replied-to records  
**Mutation level:** Read and report

```text
Use $tododdle-workflow. Read the current Agent Connection inbox for unacknowledged replies. Summarize each reply with its linked ticket or Context item and the next action. Do not acknowledge a reply, change a record, or create a ticket. If there are no replies, report no action.
```

## Recipe: Local Release Verification

**Suggested cadence:** After the normal deployment window  
**Required scopes:** `projects:read`, `tasks:read`; add `tasks:write` only for an approved evidence comment  
**Mutation level:** Read and report, or one evidence comment when explicitly enabled

Use this recipe only in a desktop task with the correct local repository available.

```text
Use $tododdle-workflow for project <project ID> and ticket <ticket ID>. Refresh the ticket and inspect the local repository. Run only the approved verification checks: <checks>. Do not deploy, push, change billing, change access, or modify production data. Report the result with immutable evidence. If mutation level permits it, add one Markdown HANDOFF comment with Outcome, Verification, and Remaining. Do not complete the ticket automatically.
```

## Do Not Schedule User-Side Server Jobs

Do not use these recipes for notification delivery, email digests, subscription reconciliation, webhook retries, backups, or other required service operations. Those jobs must run in ToDoddle's server-owned queue or cron system so they do not depend on a user's computer, chat, or plugin session.
