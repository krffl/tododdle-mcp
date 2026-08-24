# Support Cases

Support cases use internal Tickets for assignment and coordination. List or get the Ticket first. Use the support tools only when the Ticket is linked to a support case.

- Call `get_support_case` before a reply or status change. Reuse its `revision` value.
- Use `reply_to_support_case` with `REQUESTER_VISIBLE` only for text the customer can read.
- Use `INTERNAL_NOTE` for private investigation notes. Never put secrets in a note.
- A customer-visible reply can send the external customer a new private portal link.
- Use `update_support_case` for support status or priority. This does not replace the internal Ticket status.
- Reload after a revision conflict. Do not retry with a stale revision.

The requester email is not returned through MCP. The support portal handles customer identity and access.
