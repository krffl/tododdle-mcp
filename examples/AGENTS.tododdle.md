# ToDoddle Work Ledger

- Use the `tododdle` MCP server as this repository's authoritative work ledger.
- At the start of substantial work, identify the ToDoddle project, read its brief and project context, and find the existing ticket before creating another.
- Claim the known ticket with `claim_ticket` before substantial implementation. Use one stable, unique run ID for that work session. Renew the claim before its lease expires, and release it when work stops, completes, or is handed off. Do not claim a ticket for a simple read or planning request.
- Respect another active claim. Report the Agent Connection that holds it, then wait for release or expiry.
- Keep the ticket's status, lane, assignee, priority, due date, parent, and blocker relationship accurate when the implementation changes them.
- Transition the relevant ticket to the active status when work begins. Mark it `COMPLETE` only after the requested result is implemented and verified.
- Leave concise comments for durable decisions, meaningful progress, blockers, verification results, and handoffs. Do not narrate every command or minor edit.
- Format ToDoddle comments as readable Markdown. Use short headings and bullets only when they improve scanning. Avoid decorative formatting, walls of text, and raw command logs.
- Write ToDoddle ticket titles, ticket descriptions, comments, status updates, handoffs, and other user-facing MCP text in the style of ASD-STE100 Simplified Technical English. Use common words, short direct sentences, active voice, and one main idea per sentence. Follow William Zinsser's four principles: simplicity, brevity, clarity, and humanity. Include only the context a person needs to understand the result or take the next action. Do not sound robotic or remove useful warmth.
- Record a blocker relationship when another tracked ticket concretely prevents progress.
- Use ToDoddle timers only when the user requests time tracking or this repository explicitly requires it. Never invent recorded time.
- Archive tickets or time entries only with explicit user approval.
- If MCP access, scopes, or project grants are missing, report the exact limitation and list any tracking updates that remain pending. Never claim an update succeeded when it did not.
