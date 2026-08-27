# Staging Dogfood Gate

Complete one supervised Factory run against a non-critical staging Ticket before package publication.

1. Use a staging Agent Connection with the minimum required scopes and one project grant.
2. Choose a bounded Ticket with clear acceptance criteria and no production effect.
3. Invoke `$tododdle-factory` explicitly. Keep a human available for approvals and review.
4. Confirm the run reads the brief, relevant Context, Ticket, and repository instructions before it claims work.
5. Confirm the claim creates an Agent Run and that renewal preserves the same opaque run ID.
6. Exercise one safe stop, such as a missing approval or a failed verification limit. Confirm the handoff explains the stop and the claim is released.
7. Run a successful attempt. Confirm its evidence uses stable references and its terminal result releases the claim.
8. Confirm the skill does not complete, archive, approve, deploy, push, or publish without separate authority.
9. Confirm temporary files are removed and unrelated worktree changes remain intact.
10. Record the staging Ticket ID, Agent Run ID, package commit, verification result, and reviewer decision in the release evidence.

Do not publish when any check fails. Repair the skill or MCP contract, then repeat the staging run with a new opaque run ID.
