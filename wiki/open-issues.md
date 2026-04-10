# Open Issues

## Current high-priority follow-ups

- Folder delete currently deletes folder record only; should recursively delete contained assets + storage objects.
- Upload/delete UI context should consistently respect active folder path.
- Random combo quality tuning may still need guardrails beyond audio-repeat filtering.

## Playback and UX watchlist

- Validate audio-master-only timeline behavior across long/short clip mismatches.
- Keep monitoring loop-boundary artifacts on real browser/device matrix.
- Optionally tighten deploy pipeline to exclude junk files (`.DS_Store`).

## Docs/process

- Continue using `raw_sources/` as immutable-ish source docs.
- Use this `wiki/` tree as the synthesized LLM context layer.

See also: [Recent Changes](recent-changes.md), [Deploy and Ops](deploy-and-ops.md), [Log](log.md).
