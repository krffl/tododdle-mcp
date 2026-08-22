# Time Tracking

Read this file only when the user asks to track time or repository guidance requires it.

- Call `get_active_time_entries` before starting a timer when duplicate timing would be confusing.
- Use `start_ticket_timer` and `stop_ticket_timer` for live work.
- Use `log_ticket_time` for a known past interval.
- Update an entry with optimistic concurrency.
- Archive an entry only with explicit approval.
- Never invent elapsed time or record a silent estimate.
