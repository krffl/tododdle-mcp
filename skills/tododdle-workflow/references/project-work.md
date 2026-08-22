# Project Work Details

Read this file only when creating project structure or when execution needs these details.

## Structure

- Read project, board, and lane state before creating structure.
- Use boards for distinct workstreams and lanes for workflow stages.
- Configure lane entry actions only when the workflow is explicit.
- Use `list_project_members` to select assignees and artifact owners.
- Use project documents, Notes, revisions, and artifact links when existing context matters.
- Archive a project, board, lane, or Note only with explicit approval. Permanent deletion is unavailable.

## Claims and Coordination

- Use `list_available_work` for a readable queue preview or `claim_next_ticket` for atomic selection.
- Use a stable opaque run ID during one execution attempt. Use a new run ID for each claim-next operation and each later attempt.
- Claims identify the authenticated Agent Connection. They do not replace the human assignee.
- A conflicting claim is coordination state. Do not take it over before release or expiry.

## Durable State

- Keep the ticket’s kind, parent, lane, assignee, due date, priority, blockers, and active-child links accurate.
- Use typed attributes for facts such as `source.repository`, `source.branch`, and `delivery.environment`.
- Do not store credentials or tokens in attributes.
- Set a blocker relationship when a tracked ticket prevents progress. Add one concise comment that explains the effect.
- Prefer one useful checkpoint over a stream of narration.
