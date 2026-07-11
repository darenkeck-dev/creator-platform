# Open Issues

## Current high-priority follow-ups

- Validate recursive delete in prod-like data after deployment; the new job worker should delete folder descendants and storage objects deepest-first.
- Upload/delete UI context should consistently respect active folder path.
- Queued tone/conversion reprocessing jobs currently report queueing completion, not downstream tone/MediaConvert completion; link downstream worker progress to jobs if richer completion tracking is needed.
- Random combo quality tuning may still need guardrails beyond audio-repeat filtering.
- Darenkeck mobile focus-loss handling needs hardening (background/foreground transitions should not leave combo state machine desynced).
- Darenkeck mobile native play/pause interactions need explicit state-machine handling so UI and media element state stay aligned.
- Tone extraction output needs simplification: reassess whether `.tonebundle.tar.gz` is needed now that display-ready tone summary/scores are stored directly on the asset record.
- Decide whether existing `tone-taxonomy/v1` asset analyses should be reanalyzed or left historical now that new analyses emit `tone-taxonomy/v2`.

## Playback and UX watchlist

- Validate timeline handoff behavior (video-master while muted -> audio-master after unmute) across long/short clip mismatches.
- Keep monitoring loop-boundary artifacts on real browser/device matrix.
- Debug combo-player end-state video frame jump: when playback reaches the end, the video appears to jump frames before/around the ended/replay state. Inspect timeline-ended handling, loop flags, pause-at-end behavior, and final seek/sync signals.
- Validate combo-player transitions for interruption paths (`visibilitychange`, app switch, screen lock, native media control pause/play).

## Docs/process

- Continue using `raw_sources/` as immutable-ish source docs.
- Use this `wiki/` tree as the synthesized LLM context layer.

See also: [Recent Changes](recent-changes.md), [Deploy and Ops](deploy-and-ops.md), [Log](log.md).
