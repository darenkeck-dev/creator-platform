# Recent Changes

## High-signal recent commits

- `691cd45` - `ComboPlayer` uses audio as master timeline always.
- `a7747d9` - random combo avoids repeating previous audio (API + darenkeck client), plus markdown source moves to `raw_sources/`.
- `ce28017` - CloudFront security headers for darenkeck site stack.
- `2e8a408` - upload UI improvements (type inference, filename title default, visibility control).
- `3342a8c` - darenkeck site metadata/crawl baseline (robots/sitemap/favicon/meta tags).
- `e25b0c5` - audio default profile switched to normalized HLS transcode path.

## Recent operational updates

- Consolidated selected-item library controls under an Action disclosure, added bulk public/private reassignment with partial-failure handling, kept Delete standalone, surfaced visibility in list/grid views, and enforced owner-only asset PATCH mutations.
- Replaced the single-file upload form with a two-at-a-time batch queue, audio/video/image inference, private/current-folder defaults, per-file progress, safe retry recovery, and completion links without changing backend upload contracts.
- Deployed the provider-neutral asset vector lifecycle through Data, Vector, API, and Processing stacks. Initial production reconciliation indexed 20 eligible assets and finished with all 94 authoritative records current, zero orphan vectors, and empty sync/DLQ queues.
- Latest darenkeck developer profile deployment: `/dev` renders content revision `d9439b2bd277843224af67c99dde1f86375a69eb`, `/daren-keck-resume.pdf` serves the matching generated PDF, and CloudFront invalidation `I1KCVEG9V3SHK0HHUS6UGMMTNB` completed.
- Deployed `MediaManagerDarenkeckSiteStack` with custom domain wiring enabled for `darenkeck.com` using existing ACM cert in `us-east-1`.
- Cut over Route 53 apex alias from old CloudFront distribution to `EUQDAU6DH3BMC` (`d2fmm3qe2rclf2.cloudfront.net`).
- Completed phase-3 DNS ownership migration: Route 53 apex `A/AAAA` records are now created/managed by `MediaManagerDarenkeckSiteStack`.
- Bumped monorepo package versions to `1.0.0` across apps, shared packages, infra, and root workspace metadata.
- Release checks passed for baseline: `bun run typecheck`, `bun run test:infra`.
- Deployed streaming-stack CORS hardening: CloudFront now attaches a CORS response-headers policy and forwards preflight headers via origin request policy for derived HLS playback.
- Added localhost-focused playback debug controls in `apps/darenkeck` and exposed audio element callbacks in shared `ComboPlayer` for Chrome/Firefox audio troubleshooting.
- Simplified startup behavior in `ComboPlayer`: muted autoplay starts video only, and audio `play()` is deferred until unmute interaction.
- Moved `ComboPlayer` phase-change callback emission out of React state updater and into an effect to avoid cross-component setState warnings.
- Removed autoplay retry loop from `ComboPlayer` to keep startup behavior simpler/predictable in current release state.
- Updated playback event handling so muted-video mode ignores follower-audio pause/wait transitions and avoids false stalled states.
- Disabled local debug overlay rendering in `apps/darenkeck` and set shared `ComboPlayer` debug logging back to `false` for release readiness.
- Bumped monorepo/package versions from `1.0.0` to `1.0.1` and updated root README release status.
- Updated `scripts/deploy-darenkeck-static.sh` to exclude and remove `.DS_Store` objects during S3 sync deployments.
- Added tracked TODOs for mobile focus-loss and native play/pause state-machine handling in `wiki/open-issues.md`.
- Updated the tone-embedding Essentia audio smoke test to cover `audio-demo-00.mp3` and `audio-demo-01.mp3`, with default host-visible JSONL under ignored `apps/tone-embedding/tests/output/`.
- Added the generic `apps/tone-embedding/scripts/run-audio-analysis-test.sh` primary audio runner and reoriented the tone README around primary audio/video pipelines before model-specific experimental runs.
- Added Python-native tone CLI workflows: `analyze audio`, `analyze video`, `combo build`, and local `neighbors query`, plus a vector DB preparation plan for future Media Manager indexing.
- Updated the tone README with uv-first prerequisites and app-relative CLI examples so it can move with `apps/tone-embedding` as a standalone repo; CLI examples now consistently use `uv sync --no-editable` and `uv run --no-editable ...`.
- Added versioned `tone-taxonomy/v1` descriptor vocabulary/mapping data and wired asset/combo outputs to record `toneTaxonomyVersion`.
- Prepared the tone app for CLI invocation from conversion jobs: documented `uv sync --no-editable`, validated `uv run tone-embedding ...`, added schema contract fixtures for `asset-analysis/v1` and `tone-taxonomy/v1`, and documented production invocation commands.
- Switched the primary tone pipeline to OpenAI-only for Lambda-first evaluation; DINOv2 remains available only as an explicit optional embedding path for later container/Fargate/Batch review.
- Ran real OpenAI audio/video smoke tests with generated local fixtures, created/inspected per-asset tone bundles, added `numpy` to the `openai` extra for OpenCV frame sampling, and fixed bundle creation from single-object analysis JSON outputs.
- Standardized tone app docs on `uv run --no-editable ...` because editable console-script behavior is unreliable after switching install modes, and improved CLI help text with clearer command descriptions, metavars, examples, and option help.
- Added the Media Manager tone-analysis integration path: optional `toneAnalysis` asset metadata, separate originals-event SQS queue/DLQ, tone-analysis worker, SSM SecureString OpenAI key lookup, and artifact writes to `derived/<assetId>/tone/`.
- Surfaced conversion and tone-analysis state in the Media Manager UI: library/folder cards show both sub-states, and asset details show tone status, profile, artifacts, and errors.
- Added `packages/tone-core`, a Bun/TypeScript tone analysis core with zod schemas, taxonomy/vector helpers, OpenAI audio/video analysis entrypoints, direct `ffmpeg` frame extraction via `child_process.spawn`, combo scoring, nearest-neighbor utilities, tests, and a small local CLI.
- Published an account-local static ffmpeg Lambda layer and deployed the prod processing stack with the Node `tone-core` tone-analysis worker attached to that layer.
- Fixed the Node tone worker DynamoDB key shape for the live `pk`/`sk` asset table, redeployed processing, and verified with a live temporary audio smoke that produced `asset-analysis.json` and `toneAnalysis.status=ready`.
- Verified the deployed Node tone Lambda against the original Python demo media clips (`audio-demo-00/01.mp3`, `video-demo-00/01.m4v`); all four reached `ready` and video exercised the ffmpeg layer.
- Added bounded public asset audit logs to asset metadata, a shared Node Lambda append helper, lifecycle entries for upload/conversion/MediaConvert/tone analysis, and an Activity Log section in the asset detail UI.
- Added display-ready tone-analysis fields directly to `asset.toneAnalysis` and rendered tone summary, word groups, semantic notes, and score bars on the asset detail page.
- Added a tone-analysis display backfill script and used it to hydrate older ready prod analyses from their existing `asset-analysis.json` artifacts.
- Fixed the Tone Analysis score chart so signed dimensions render as bounded zero-centered bars instead of overflowing the track.
- Added a tone keyword mapping research brief for refining `tone-taxonomy/v2` with affective norm literature and weighted descriptor mappings.
- Implemented `tone-taxonomy/v2` in `packages/tone-core`: expanded descriptor vocabulary, weighted multi-dimension mapping, summed/clamped scoring, v2 artifact emission, and v1/v2 parser compatibility.
- Added the first Media Manager library cleanup slice: reusable grid/list asset browser, multi-select, select-all, and bulk delete for library and folder child views.
- Library and folder child views now default to list mode; folders navigate as containers and omit asset-only status, conversion, and tone fields.
- Added a generic asset job framework with preview/create/status APIs, SQS worker execution, recursive `delete_assets`, web proxy routes, a shared recursive delete confirmation dialog, and a bottom job progress bar.
- Extended generic asset jobs with queued `reprocess_tone` and `reprocess_conversion` actions, conversion profile selection, and manual status refresh controls in library/detail status areas.
- Updated the TypeScript tone pipeline to normalize audio originals to MP3 with ffmpeg before OpenAI audio analysis, reducing failures from decodable but strict-parser-invalid source files.
- Deployed processing with audio normalization and restored the default ffmpeg layer attachment; a previously failing `audio/x-m4a` asset reprocessed successfully to `toneAnalysis.status=ready`.
- Removed the generic Lineage Context panel from media asset detail pages; folder child browsing remains in the folder detail view.
- Replaced the media asset page Nested Location card with a header move icon that opens a reusable folder-tree move dialog.
- Polished the move dialog spacing and nested folder indentation so expanded folders read as a tree.

## Playback evolution summary

- `ComboPlayer` was simplified toward signal-driven state transitions.
- Polling/drift/scrub complexity was reduced across several refactor commits.
- Loop boundary jitter mitigations were added.
- Latest behavior: timeline authority is video while muted, then audio after unmute-driven audio start.

## API behavior deltas to remember

- Random public combo endpoint now supports optional prior audio hints.
- Asset read paths perform schema-version upgrade on read before validation.
- New audio uploads normalize via transcode profile to improve browser consistency.
- Audio/video uploads now have an independent tone-analysis branch; tone failures update `asset.toneAnalysis` only and do not drive top-level playback readiness.
- Asset detail pages poll while conversion or tone analysis is queued/processing so async sub-state changes become visible without manual refresh.
- `apps/tone-embedding` remains unchanged; `packages/tone-core` is the production-oriented path for moving tone extraction into a native Node Lambda.
- Replaced the integrated Python/container tone worker code path with a Node Lambda that imports `@media-manager/tone-core`; video analysis now uses `FFMPEG_PATH` and can attach an ffmpeg Lambda layer via `FFMPEG_LAYER_ARN`.
- Prod tone-analysis Lambda is now a zip-based `nodejs22.x` function with `<your ffmpeg layer arn>` attached.
- New tone analyses emit `toneTaxonomyVersion="tone-taxonomy/v2"`; existing v1 artifacts remain historical and should be reanalyzed/backfilled only if comparable v2 scores are needed.
- Added first tone review capture slice: reusable review panel, asset/combo page wiring, and privacy-light `POST /tone-reviews` persistence for audio, video, and combo targets.
- Added a dedicated Media Manager `Review` tab with combo playback, a review queue, target switching, keyword chip selection, and score submission wiring.
- Updated the `Review` tab to default to a random public combo, use muted/autoplay combo playback, include source asset ids on combo review submissions, and show paginated reviewed combos from `GET /tone-reviews`.
- Replaced flat Review keyword chips with a broad-to-specific 3-level emotion tree and added hover/focus descriptions for tone score sliders and keyword nodes.
- Updated Review target switching so Combo/Audio/Video selects a fresh random target of that type, with combo playback using the darenkeck background player treatment and single video/audio modes using the same large framed, muted-first review surface.
- Changed Review audio/video modes to use the normal asset detail `AssetPlayer`; only combo mode keeps the darenkeck-style background combo player.
- Updated the Review layout so the media player spans the page width and the Review Queue/Reviewed Combos sections sit below; raised the combo mute overlay z-index for visibility.
- Added a Review header `Next` button for loading a fresh random target of the currently selected Combo/Audio/Video mode.
- Anchored the background `ComboPlayer` built-in mute control inside the player so the Review combo mute button does not follow page scroll.
- Added background `ComboPlayer` pause/replay overlay behavior: click video to pause, dim with centered play button, resume in place when paused, restart when ended.
- Reworked Review tone selection into a compact transparent media overlay with six roots and row-based branch/leaf buttons.
- Tone selection now defaults to no selected root and renders standalone overlay buttons without a background panel, aligned beside the combo mute/unmute control.
- Moved the Review Combo/Audio/Video switch into the top page header and added `scope=all` asset listing support so random audio/video review can draw from nested owned media instead of only root library assets.
- Improved expired auth handling: middleware now protects Review/Combos/API paths, clears expired JWT cookies, redirects page requests back through login with `next`, returns JSON `401` for same-origin API requests, and the Cognito web client uses 12-hour ID/access token validity.
- Split review listings by intent: `/review` now lists only reviews for the current asset/combo target, while `/combos` lists all combo reviews and links back into the review surface.
- Changed human review capture to start blank/neutral for audio, video, and combo targets; UI submissions no longer include `modelScoresSnapshot` from extracted source tone values.
- Replaced the Review tone tree/fixed pager with an adaptive five-keyword picker: the initial set is random, then `>` generates three taxonomy-adjacent suggestions from the latest selection plus two random exploration suggestions.
- Extracted combo playback plus tone keyword submission into shared `ComboToneReviewPlayer`; Media Manager combo review now uses it with an overlaid Next button while audio/video review stays app-local.
- Added curator-adjusted audio/video tone scoring while preserving raw OpenAI scores: OpenAI and each curator review receive weight one, materialized adjustment metadata retains per-dimension sums/counts, and tone reanalysis rebuilds adjustments.
- Added three-marker audio/video review sliders for OpenAI baseline, curator input, and live adjusted result with delta visualization; combo review scoring remains independent.
- Reset all 21 existing production tone reviews (all were curator combo reviews) and added a dry-run-first production review purge command.
- Restricted review capture to the dedicated Review page, removed detail-page review panels and all review score sliders, and made selected keywords the only curator input.
- Added deterministic review-keyword aliases to production taxonomy descriptors so audio/video reviews derive partial score vectors server-side; client-provided review scores are ignored.
- Updated asset tone bars to render OpenAI and curator delta as separate color segments with a marker at the OpenAI endpoint.

Related: [Current State](current-state.md), [Open Issues](open-issues.md).
