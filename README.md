# media-manager

Monorepo for media ingestion, processing, playback APIs, and frontend apps.

Release status: `v1.0.1` candidate.

## Restarting Codex with context

At the start of a new Codex session, send this as your first prompt:

```text
Initialize from wiki/SESSION_START.md and follow AGENTS.md.
Read all required wiki files, then return:
- 8-12 bullet mental model
- top 5 active risks/todos
- most recent meaningful changes
- recommended next 3 actions

After that, maintain wiki updates + append wiki/log.md as work changes.
```

This keeps session context consistent and ensures `wiki/` stays current.
