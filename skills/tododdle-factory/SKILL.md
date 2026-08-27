---
name: tododdle-factory
description: Run a supervised, bounded software delivery loop through ToDoddle. Use only when the user explicitly asks for a factory run or autonomous delivery of tracked work. Use tododdle-workflow for ordinary ledger updates, planning, status checks, or manual implementation.
---

# ToDoddle Factory

Run one supervised delivery attempt. The coding client supplies the model, repository, terminal, Git, and test tools. ToDoddle supplies intent, authorization, claims, Agent Runs, evidence, review, and human oversight.

Before work, read [tododdle-workflow](../tododdle-workflow/SKILL.md) completely. Follow its current routing, authorization, file, writing, status, and handoff rules. Read its linked references only when the work needs them. This skill adds the delivery loop below. It does not replace the shared workflow.

Do not use this skill for ordinary ToDoddle work. Do not add or call an LLM SDK. Do not manage provider credentials, models, prompts, inference, transcripts, or hosted agent execution.

## Establish the Run

1. Check `get_agent_inbox` before choosing work. Handle a relevant reply before new work.
2. Read the project context, canonical brief, relevant Context, full Ticket, repository instructions, and acceptance criteria. Use bounded reads from the shared workflow.
3. Confirm that the outcome is testable. State any user-supplied time, retry, token, or cost limits. Use a small, risk-based repair limit when no limit exists.
4. Create a unique opaque run ID. Call `claim_ticket` for the known Ticket. The claim starts or resumes its Agent Run.
5. Stop on another active claim. Do not work around its lease or change the human assignee.
6. Move the Ticket to the active status only when the project rules permit it. A claim does not change Ticket status.

## Deliver Within the Boundary

1. Inspect the repository and preserve unrelated changes.
2. Make a bounded plan tied to the acceptance criteria.
3. Implement the smallest complete change that meets the Ticket.
4. Run repository-owned tests and safety checks. Do not weaken quality gates.
5. Repair failures only within the stated limit. Call `renew_ticket_claim` before the lease expires during long work.
6. Keep durable progress in ToDoddle only when it helps a human resume, review, or resolve a blocker.
7. Keep commits focused when repository rules permit commits. Never push, deploy, change production, or publish a package without the required authority.

## Stop and Escalate

Stop before the risky action when any of these conditions applies:

- Requirements or acceptance criteria remain unclear.
- A destructive action needs approval.
- A database migration needs review or would affect shared data.
- Authentication, authorization, security, privacy, billing, or production access exceeds the approved boundary.
- A Ticket or Context revision is stale.
- Another Agent Connection owns the claim.
- A required scope, project grant, credential, tool, or repository permission is missing.
- Tests cannot prove the outcome or verification still fails after the repair limit.
- A time, retry, token, or cost limit is exhausted.

Add one concise `HANDOFF` comment with the exact decision or access needed, completed work, verification, and stable evidence. Do not expose secrets or private reasoning. Use `WAITING` only for a short pause that this same run will resume. For a real stop, finish the run as `FAILED` when the attempted result failed, or `CANCELLED` when an approval, access, conflict, or unclear requirement prevents execution. If terminal submission is unavailable, call `release_ticket`. Confirm that the claim is no longer active.

## Finish and Clean Up

1. Remove only temporary files created by the run. Preserve user files and unrelated worktree changes.
2. Confirm the worktree contains no untracked run artifacts. Keep intended source changes and focused commits.
3. Add one typed `HANDOFF` comment with `## Outcome`, `## Verification`, and `## Remaining`. Include immutable commit, pull request, deployment, test, Document, attachment, comment, or Context references.
4. Request human review when project policy or risk requires it. Never approve your own work.
5. Call `finish_agent_run` once with `SUCCEEDED`, `FAILED`, or `CANCELLED`, a concise outcome, stable evidence, and a reusable idempotency key. This terminal call releases the matching claim.
6. Confirm the claim is released. Use `release_ticket` only when no terminal result can be submitted.
7. Never silently complete, close, reject, move, or archive the Ticket. Leave status changes to explicit project policy or a human unless the user separately authorized a specific transition.

Before publishing a package that contains this skill, read and complete [staging-dogfood.md](references/staging-dogfood.md).
