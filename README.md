# media-manager

Monorepo for media ingestion, processing, tone analysis, combo playback, and collection/review tools.

Release status: pre-release. The next release milestone is not public launch; it is reaching the point where combo tone input can be collected from real users.

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

## Roadmap To User Input Collection

Release milestone: start collecting user input on combos so combo-level tone, delta, and affect data can be studied.

1. **Media Manager UI cleanup** - complete
   - Library and folder views support list mode, multi-select, and bulk job actions.
   - Bulk delete, tone reprocessing, and conversion reprocessing are backed by queued jobs.
   - Folder navigation, contextual add/upload, breadcrumbs, folder management, and asset moves are cleaned up.
   - Folder deletes expand server-side through descendants before deletion.

2. **Tone review input** - started
   - Reusable keyword/tone score review input is in place for standalone audio/video assets and combo pages.
   - Combo pages can submit reviews for the combo, just the video source, or just the audio source.
   - Reviews are stored through `POST /tone-reviews` as target-centered records without raw reviewer PII.
   - Next: compute and display human-vs-model deltas.
   - Use those deltas to tune keyword weights, strength scales, and tone metric mappings.

3. **Combo traversal**
   - Implement nearest-neighbor or related traversal methods for moving from combo to combo.
   - Use tone vectors, combo deltas, and interaction features as traversal inputs.
   - Keep traversal explainable enough to debug why one combo follows another.

4. **Tone-based combo retrieval**
   - Define how user tone input becomes a query vector.
   - Fetch combos that match the provided tonal input.
   - Support both direct keyword input and later higher-level prompt/input forms.
   - Record query, selected combo, and feedback so retrieval quality can be evaluated.

5. **Data collection loop**
   - Store combo-level user tone input and feedback.
   - Compare user input against extracted audio/video tone and combo deltas.
   - Use accumulated data to refine tone-taxonomy mappings, combo scoring, and retrieval.

## Session Context

At the start of a new agent session, follow `AGENTS.md` and read the wiki startup files in order. Keep `wiki/` updated when behavior, deployment, or process changes.
