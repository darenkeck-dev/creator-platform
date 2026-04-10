# Agent Operating Notes

## Wiki-first startup

At the start of every new session, ingest the wiki before taking action.

Read in this order:

1. `wiki/index.md`
2. `wiki/current-state.md`
3. `wiki/architecture-map.md`
4. `wiki/recent-changes.md`
5. `wiki/open-issues.md`
6. `wiki/deploy-and-ops.md`
7. `wiki/log.md`

Then provide a short startup summary:

- 8-12 bullets for current mental model
- Top 5 active risks/todos
- Most recent meaningful changes
- Recommended next 3 actions

## Ongoing maintenance rules

- Treat `wiki/` as the maintained synthesis layer.
- Treat `raw_sources/` as source material.
- When behavior/code/process changes, update the relevant wiki pages.
- Append a dated entry to `wiki/log.md` for notable ingest/change/deploy work.
- Keep pages concise and cross-linked.
- Do not paste large command outputs into wiki pages.
