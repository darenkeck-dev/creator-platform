# media-manager

Monorepo for media ingestion, processing, tone analysis, combo playback, and collection/review tools.

Release status: pre-release. The MVP milestone is a public tone-selection experience with automatic tone walking; public combination reviews are deferred to a later release.

## Repo Shape

- `apps/web`: authenticated Media Manager UI for upload, library, folders, asset details, and combo management.
- `apps/darenkeck`: public combo playback site deployed to S3 + CloudFront.
- `apps/tone-embedding`: Python reference/experimental tone app, kept separate from production processing.
- `packages/tone-core`: production TypeScript tone analysis core used by Lambda; current output uses `tone-taxonomy/v2`.
- `packages/contracts`: shared API/data schemas.
- `packages/shared`: shared playback components and utilities.
- `infra/cdk`: AWS stacks and Lambda handlers.
- `wiki`: maintained project memory and operational notes.
- `research`: active research workspaces, including tone taxonomy research.

## Current State

- Upload -> process -> ready playback flow is working for video/audio assets.
- Audio uploads default to normalized HLS transcode.
- Original media is preserved; derived playback assets are written separately.
- Tone analysis runs asynchronously from original audio/video via the Node `tone-core` Lambda.
- Tone analysis writes `derived/<assetId>/tone/asset-analysis.json` and display-ready fields on asset metadata.
- `tone-taxonomy/v2` uses expanded descriptor keywords and weighted keyword-to-tone mappings.
- Asset detail UI shows conversion state, tone state, tone scores/words, and a bounded activity log.
- Public combo playback exists and can avoid repeating the previous audio track.

## Common Commands

- Typecheck all packages: `bun run typecheck`
- Test all packages: `bun run test`
- Build all packages/apps: `bun run build`
- Build Lambda bundles: `bun run --cwd infra/cdk build:lambda`
- Deploy API stack: `bun run deploy:api`
- Deploy processing stack: `FFMPEG_LAYER_ARN="<your ffmpeg layer arn>" bun run deploy:processing`
- Deploy darenkeck static site: `bun run deploy:darenkeck:prod`

## Roadmap To MVP Launch

Release milestone: publish reliable keyword-driven tone selection and automatic tone walking on `darenkeck.com`.

1. **Media Manager UI cleanup** - complete
   - Library and folder views support list mode, multi-select, and bulk job actions.
   - Bulk delete, tone reprocessing, and conversion reprocessing are backed by queued jobs.
   - Folder navigation, contextual add/upload, breadcrumbs, folder management, and asset moves are cleaned up.
   - Folder deletes expand server-side through descendants before deletion.

2. **Tone-based combo selection** - backend deployed, public client rollout pending
   - Keyword input maps deterministically into the ten-dimensional tone space.
   - S3 Vectors bounds audio/video candidates before exact predicted-combo reranking.
   - The selected combination becomes the starting point for subsequent walking.

3. **Automatic tone walk** - backend deployed, public client rollout pending
   - Playback completion selects a nearby predicted combination.
   - Both audio and video change, with bounded recent history to reduce loops.
   - Vector failures fall back to valid random public playback.

4. **Public release gates**
   - Complete the initial media corpus and curator calibration pass.
   - Validate playback, transitions, failure recovery, accessibility, and target browsers.
   - Verify structured search, walk, fallback, and vector-sync logs during release smoke checks.
   - Defer richer recovery UI, dashboards, new alarms, notifications, and expanded cost controls until post-MVP hardening.

5. **Public combination reviews** - post-MVP
   - Add anonymous review submission, validation, idempotency, abuse controls, privacy behavior, and operational procedures in a later release.

## Session Context

At the start of a new agent session, follow `AGENTS.md` and read the wiki startup files in order. Keep `wiki/` updated when behavior, deployment, or process changes.
