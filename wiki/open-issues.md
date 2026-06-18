# Open Issues

## Current high-priority follow-ups

- Folder delete currently deletes folder record only; should recursively delete contained assets + storage objects.
- Upload/delete UI context should consistently respect active folder path.
- Random combo quality tuning may still need guardrails beyond audio-repeat filtering.
- Darenkeck mobile focus-loss handling needs hardening (background/foreground transitions should not leave combo state machine desynced).
- Darenkeck mobile native play/pause interactions need explicit state-machine handling so UI and media element state stay aligned.

## Playback and UX watchlist

- Validate timeline handoff behavior (video-master while muted -> audio-master after unmute) across long/short clip mismatches.
- Keep monitoring loop-boundary artifacts on real browser/device matrix.
- Validate combo-player transitions for interruption paths (`visibilitychange`, app switch, screen lock, native media control pause/play).

## Docs/process

- Continue using `raw_sources/` as immutable-ish source docs.
- Use this `wiki/` tree as the synthesized LLM context layer.

See also: [Recent Changes](recent-changes.md), [Deploy and Ops](deploy-and-ops.md), [Log](log.md).
