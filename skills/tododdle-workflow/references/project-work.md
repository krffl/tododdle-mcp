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
- Keep Context hierarchy accurate. Pass `parentArtifactId` when a Context artifact belongs under another artifact. Set it to `null` on update to move the artifact to the top level.
- Use only a parent from the same project. Do not parent the canonical project brief. Avoid self-parenting and hierarchy cycles.
- Use typed attributes for facts such as `source.repository`, `source.branch`, and `delivery.environment`.
- Do not store credentials or tokens in attributes.
- Set a blocker relationship when a tracked ticket prevents progress. Add one concise comment that explains the effect.
- Prefer one useful checkpoint over a stream of narration.

## Review Requests

- Use `list_review_requests` with one project and narrow filters. Read one request with `get_review_request` before changing it.
- A review is optional. It does not change a ticket status or block work.
- Use `list_project_members` before selecting reviewers. Do not guess user IDs.
- Create a review only for an accessible ticket, document, board, or Context artifact. Supply an idempotency key for every create, review comment, and checklist addition. Reuse the same key only when retrying that same operation.
- Only a named reviewer can use `respond_to_review_request`. Use that reviewer’s current `updatedAt` value as `expectedUpdatedAt`.
- Use `expectedRevision` for edits, completion, and cancellation. Reload after a conflict.
- Use checklist changes for shared review steps. Named reviewers can mark an item complete. Only the requester or a project administrator can change the item text.
- Keep comments concise. Use `list_review_comments` only when the discussion is relevant.
