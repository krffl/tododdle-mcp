# Releases and Testbench Rounds

Releases group tickets for one shipped version. Use the release tools only when the selected ticket or the user asks for release work.

## Access

- Release reads need `releases:read`. Release writes need `releases:write`.
- Testbench reads need `testbench:read`. Testbench writes need `testbench:write`.
- Every call needs a project grant. Writes, and all Testbench calls, need project owner or admin access.
- `409 BETA_DISABLED` means Testbench is off for the project. Report it. Do not try to turn it on.

## Read

- Use `list_releases` with `status`, `search`, or `includeArchived` to find a release. Follow `hasMore` with the next `page` only when you need it.
- Use `get_release` for one release. It returns up to 50 ticket summaries, the total `ticketCount`, and linked Testbench rounds. `tickets` and `ticketCount` are `null` without `tasks:read`, and `testbenchRounds` is `null` without `testbench:read` and Testbench operator access. Treat `null` as "not visible to this connection", not as "none".
- Use `list_testbench_rounds` to find a round and its current `revision`.

## Change

- `create_release` creates a `PENDING` release. Pass a stable `idempotencyKey` so a retry does not create a second release.
- `update_release` edits version, title, build, environment, build link, and text metadata. Pass `expectedRevision` from the latest read. Reload after a `409 CONFLICT`. Archived releases cannot be edited.
- Link a ticket with `create_ticket` or `update_ticket` and `releaseId`. Set `releaseId` to `null` to remove it. Filter tickets with `list_tickets` and `releaseId`, or `none`.
- `set_round_release` links a `DRAFT` round to a release, or removes the link with `releaseId: null`. Pass the round `revision` as `expectedRevision`. It never publishes the round or sends email.

## Status, Archive, and Restore Need Approval

- Use `request_release_status_change` to publish, abandon, return to pending, archive, or restore a release. Give a short reason and the latest `expectedRevision`.
- The tool does not change the release. A person approves or rejects the request in AIr Traffic Control. Nothing changes until then.
- The result shows `result: PENDING_APPROVAL` and `changed: false`. Do not report the release as published, abandoned, archived, or restored. Share the `uiUrl` when a person needs to decide.
- A repeated identical request returns the same approval. Do not send many requests to push a decision.
- To see the outcome later, read the release with `get_release`.

## Agent Runs

These routes carry no Ticket ID. When you hold a run, pass `runId` and the run's `taskId` so the server can check the run envelope. Reads use `READ_PROJECT_DATA`. Writes use `UPDATE_INTERNAL_WORKFLOW`.
