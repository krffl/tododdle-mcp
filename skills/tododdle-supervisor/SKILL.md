---
name: tododdle-supervisor
description: Use current ToDoddle supervision assessments to guide coding work at meaningful decision boundaries. Apply when supervised execution is requested and a compatible decision backend is available through ToDoddle; use tododdle-workflow alone when it is not.
---

# ToDoddle Supervisor

Read [tododdle-workflow](../tododdle-workflow/SKILL.md) first. Follow its authority, claim, status, evidence, and handoff rules. This skill adds optional decision guidance. It does not replace the work ledger.

## Check Availability

Use only the `tododdle` MCP. Never call Jev, OpenJev, or another evaluator directly, and never handle its credentials.

Treat supervision as available for a Ticket only when `get_supervisor_state` succeeds and returns a current assessment from the project’s configured decision evaluator. A current assessment must postdate the Ticket state and meaningful event it evaluates. Accept `external-system-one` or another evaluator type that project Context explicitly approves. Do not infer availability from an evaluator name.

Treat supervision as unavailable when the tool is missing, the call fails, no approved assessment exists, or the latest assessment is stale, incomplete, or conflicting. Do not call `record_assessment` to create your own guidance. Do not poll. Continue with `tododdle-workflow` when supervision is optional. If project rules require a supervised decision, preserve the current state and add an escalation instead of guessing.

## Use Decision Boundaries

1. Before starting or switching work, get the bounded queue through the normal workflow. Call `get_supervisor_state` only for the small set of viable Tickets. Use a current assessment together with authoritative priority, ownership, blocker, and status fields. Never invent them.
2. Work normally after selection. Keep ToDoddle authoritative. Do not call supervision for routine file reads, edits, commands, or test assertions.
3. At a meaningful boundary, record new facts first. Use `record_work_event` for a decision, blocker, failed attempt, review need, or escalation. Use `record_verification` only for a check that actually ran.
4. Call `get_supervisor_state` again when work appears complete, tests fail, a blocker appears, several valid Tickets remain, review may be needed, or human escalation may be appropriate.
5. Interpret assessment dimensions as structured guidance. Compare them with the Ticket requirements and evidence. Do not repeat evaluator text as fact, and do not let an assessment complete work, approve access, merge, deploy, or override human control.
6. Before completion, require recorded verification and a current assessment that covers acceptance and verification. If the result is absent or uncertain, keep the Ticket active and request review or escalation.

Use the same `projectId`, `taskId`, and active `runId` for `get_supervisor_state`, `record_work_event`, and `record_verification`. Keep `maxEvents` small. Set `includePreviousAssessments: true` only when comparison or conflict detection needs history.

## Examples

- **Choose next work:** shortlist unblocked Tickets, read current supervisor state for those candidates, and follow a clear current assessment without changing recorded priority or ownership. If none qualifies, use the normal queue rules.
- **Check completion:** record passing checks with `record_verification`, then require a newer assessment that supports requirement completeness and verification quality. Keep the Ticket active when evidence is missing.
- **Handle a failed test:** record `FAILED_ATTEMPT`, refresh supervision once, and follow a clear repair, review, or escalation direction. Apply the normal bounded repair rule when supervision is unavailable.
- **Escalate a blocker:** record `BLOCKER`, set the real blocker relationship through the normal workflow, refresh supervision once, and add `ESCALATION` when no confident route exists.
