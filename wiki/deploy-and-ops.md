# Deploy and Ops

## Core deploy commands

- API stack: `bun run deploy:api`
- Processing stack: `bun run deploy:processing`
- S3 Vectors stack: `bun run deploy:vectors`
- Darenkeck site infra (CloudFront/S3 settings): `bun run deploy:darenkeck-site`
- Darenkeck static site publish (build + sync + invalidation): `bun run deploy:darenkeck:prod`

## Typical change-to-deploy mapping

- `infra/cdk/lambda/api-*` -> deploy API stack.
- `infra/cdk/lambda/upload-trigger`, `mediaconvert-status`, or `tone-analysis` -> deploy processing stack.
- `infra/cdk/lambda/api-jobs` or job API routes/queue config -> deploy API stack, then processing stack for worker changes.
- `infra/cdk/lambda/jobs-worker` -> deploy processing stack after the API stack has exported the bulk-actions queue.
- Vector lifecycle changes -> deploy data first to enable/export the Assets stream, then vectors, API, and processing.
- `infra/cdk/lib/darenkeck-site-stack.ts` -> deploy darenkeck site infra stack.
- `apps/darenkeck/*` runtime/static content -> deploy darenkeck static site.
- `darenkeck-content` Markdown changes -> run the darenkeck static-site workflow, which fetches the selected content revision before the app build.
- Music contracts/admin/public API or direct asset guards -> deploy API; recursive-delete music guards also require processing deployment. Media Manager release UI requires the web deployment target.

## Darenkeck content fetch

- Pages CMS edits and commits Markdown in the separate `darenkeck-content` repository.
- `bun run content:darenkeck:fetch` shallow-fetches `git@github.com:darenkeck-dev/darenkeck-content.git` at `main`; override with `DARENKECK_CONTENT_REPO` or `DARENKECK_CONTENT_REF`.
- Fetching accepts only regular Git file modes under `content/` and `media/`, requires a regular non-empty `content/resume.md`, and rechecks staged trees for non-regular files before replacement. The resolved commit SHA is written to `apps/darenkeck/.generated-content/REVISION`.
- `deploy:darenkeck:staging` and `deploy:darenkeck:prod` run content fetch, published-post/diagram preparation, resume PDF generation, and the Vite build in order. Any validation or Mermaid rendering failure stops deployment.
- Local deployment uses existing Git SSH credentials. Future CI should use read-only access through a deploy key, GitHub App token, or fine-grained PAT.
- `/dev` bundles fetched `content/resume.md` into the SPA and renders it with `react-markdown`; therefore a darenkeck build requires a successful content fetch first.
- Blog posts under `content/posts/` require title/date frontmatter. `draft: true` and `*-draft.md` entries are absent from the generated manifest and production bundle; published entries are sorted newest-first and served at `/blog/:slug`.
- Tracks under `content/tracks/` and releases under `content/releases/` are validated against the monorepo-owned `track/v1` and `release/v1` contracts. Content preparation writes a published-only music manifest and rejects duplicate identities, invalid URLs, and release references to unpublished tracks.
- Mermaid is not a runtime dependency. Deployment extracts fenced Mermaid blocks from published posts and also renders `diagrams/**/*.mmd` sources with the pinned CLI into ignored `public/media/diagrams/**/*.svg`; generated SVGs are never committed, draft blocks are skipped, and stale outputs are cleared on each preparation.
- Initial output remains an SPA deployed through the existing S3 sync and CloudFront invalidation flow. SEO prerendering is deferred.

## Resume PDF

- `bun run setup:darenkeck:pdf` installs the Playwright-managed Chromium browser required on a new development or deployment machine.
- `bun run content:darenkeck:pdf` starts a temporary Vite development server, opens `/dev` with print media, and writes the two-page US Letter artifact to the gitignored `apps/darenkeck/public/daren-keck-resume.pdf`.
- `bun run content:darenkeck:prepare` fetches content and regenerates the PDF for local development. Run it before `bun run dev:darenkeck` whenever resume content changes.
- The darenkeck staging and production deploy commands run content fetch -> PDF generation -> Vite build -> S3 sync. Vite copies the public PDF into `dist`, so the local and deployed `/daren-keck-resume.pdf` URL serves the same artifact.
- PDF generation waits for all resume images and fails when an image, including a committed diagram SVG, cannot load.
- Static S3 sync uses `--no-follow-symlinks` as a final safeguard against publishing files outside the build output tree.
- PDF generation uses white paper, black text, compact print spacing, hidden web actions, controlled page breaks, and no printed background graphics.

## Darenkeck custom domain wiring (optional)

- `MediaManagerDarenkeckSiteStack` supports optional CloudFront custom-domain wiring via env vars:
  - `DARENKECK_SITE_DOMAIN_NAME`
  - `DARENKECK_SITE_CERT_ARN` (must be ACM in `us-east-1`)
  - `DARENKECK_SITE_MANAGE_DNS` (`true`/`false`)
  - `DARENKECK_SITE_HOSTED_ZONE_ID` (required when DNS management is enabled)
  - `DARENKECK_SITE_DNS_RECORD_NAME` (optional; defaults to domain name)
- Phased migration recommendation:
  - deploy with domain + cert while `DARENKECK_SITE_MANAGE_DNS=false`
  - cut over alias ownership/DNS in a controlled window
  - optionally enable DNS management in stack after ownership is moved

Current production status:

- CloudFront distribution `EUQDAU6DH3BMC` is configured with alias `darenkeck.com`.
- Route 53 apex `A` and `AAAA` aliases point to `d2fmm3qe2rclf2.cloudfront.net`.
- DNS is now managed by CloudFormation in `MediaManagerDarenkeckSiteStack` (`DARENKECK_SITE_MANAGE_DNS=true`).

Migration note:

- `AWS::Route53::RecordSet` does not support CloudFormation resource import in this environment.
- For existing manual apex records, takeover requires delete-then-create migration (remove manual records, then deploy stack-managed records immediately).

## Post-deploy quick checks

- API health: call `GET /public/combos/random` and verify 200 payload with `videoSrc/audioSrc`.
- Tone payload health: for a pair with eligible taxonomy-v2 source vectors, verify random and controlled responses contain all ten bounded `predictedTone` dimensions.
- Walk health: call `POST /public/combos/select` with `schemaVersion=public-combo-selection-request/v1`, `mode=walk`, current public audio/video IDs, and bounded combo/audio/video history. Verify either exact walk metadata or an explicit random fallback reason, and confirm neither current source repeats.
- Darenkeck: verify homepage loads + combo playback starts.
- Crawl basics: check `/robots.txt` and `/sitemap.xml`.
- Headers: verify CloudFront returns HSTS, CSP, nosniff, referrer, frame options, permissions policy.
- Streaming CORS: verify HLS manifest responds with `Access-Control-Allow-Origin` for cross-origin requests:
  - `curl -I -H "Origin: https://darenkeck.com" https://<streaming-cloudfront>/derived/<asset>/hls/<manifest>.m3u8`
  - optional preflight check: `curl -i -X OPTIONS -H "Origin: https://darenkeck.com" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: range" https://<streaming-cloudfront>/derived/<asset>/hls/<manifest>.m3u8`

## Release log checks

Public selection writes one structured `public_combo_selection` outcome per handled request alongside its EMF values. Fields include `requestedMode`, `resolvedMode`, `outcome`, `statusCode`, `fallbackReason`, `latencyMs`, and API Gateway `requestId` when available.

```text
fields @timestamp, requestedMode, resolvedMode, outcome, statusCode, fallbackReason, latencyMs, requestId
| filter event = "public_combo_selection"
| sort @timestamp desc
| limit 100
```

Vector convergence writes one structured `asset_vector_sync` result per attempted SQS or DynamoDB Stream operation. Fields include `source`, `assetId`, `action`, `attempts`, `outcome`, `latencyMs`, and the source message/event identifier.

```text
fields @timestamp, level, source, assetId, action, outcome, attempts, latencyMs, messageId, eventId, errorName, errorMessage
| filter event = "asset_vector_sync"
| sort @timestamp desc
| limit 100
```

For MVP release smoke, confirm exact search, exact walk, random fallback, indexed-vector, and deleted-vector outcomes are queryable. Dashboards, additional alarms, notification actions, and automated vector-drift checks are deferred hardening.

## Tone analysis config

- Upload processing uses one eventing pattern: S3 object-created events go to EventBridge, then EventBridge fans out to per-workflow SQS queues.
- Media conversion and tone analysis intentionally use separate queues/DLQs so retries, backlogs, and failures stay isolated.
- Processing stack expects an OpenAI API key in SSM Parameter Store `SecureString`.
- Default parameter name: `/media-manager/<stage>/openai-api-key`.
- Override at synth/deploy time with `OPENAI_API_KEY_PARAMETER_NAME` if needed.
- Video tone analysis expects `ffmpeg` at `FFMPEG_PATH` (default `/opt/bin/ffmpeg`). Processing deploy attaches the account-local `media-manager-ffmpeg:1` Lambda layer by default; set `FFMPEG_LAYER_ARN` only to override it.
- Audio tone analysis also uses `FFMPEG_PATH` to normalize originals into OpenAI-compatible MP3 before analysis.
- Current prod ffmpeg layer: `<your ffmpeg layer arn>`.
- Tone analysis JSON is written to the derived bucket under `derived/<assetId>/tone/asset-analysis.json`; bundle artifact generation is deferred until `tone-core` owns bundle creation.
- New tone analyses emit `tone-taxonomy/v2`; contracts accept both `tone-taxonomy/v1` and `tone-taxonomy/v2` so historical artifacts can still be read.
- If older ready tone analyses are missing display fields on the asset record, run `bun run --cwd infra/cdk backfill:tone-analysis-display` first, then `bun run --cwd infra/cdk backfill:tone-analysis-display -- --apply` after reviewing the dry run.
- Audio/video curator adjustment materialization requires the tone worker's DynamoDB `Query` permission, so deploy both API and processing stacks for adjustment changes.
- Official music prepared locally as AAC can set processing profile `audio-package-hls-v1`. The source must already contain browser-compatible AAC; MediaConvert packages it into HLS with codec passthrough rather than changing bitrate or sample rate. Standard WAV/FLAC uploads should continue using `audio-transcode-hls-v1`.
- To inspect tone reviews before a full reset, run `bun run --cwd infra/cdk purge:tone-reviews`. Permanently delete the reported production records only with `bun run --cwd infra/cdk purge:tone-reviews -- --apply --confirm-production`; the purge also clears materialized audio/video adjustments derived from deleted reviews.

## Asset tone vector index

- `bun run deploy:vectors` creates `MediaManagerVectorStack` with one retained S3 vector bucket and the retained `asset-tone-v1` index.
- The index stores 10-dimensional `float32` vectors in the canonical `asset-tone-vector/v1` order and uses Euclidean distance.
- The stack also owns the vector sync queue, DLQ, convergence Lambda, queue-age alarm, and DLQ alarm. DynamoDB Stream batches that exhaust retries are sent to the same alarmed DLQ. Stack outputs export the bucket/index identifiers and sync queue ARN/URL with stage-aware names.
- DynamoDB remains authoritative. Lifecycle producers enqueue `{assetId}` and the worker rereads the asset to upsert an eligible public ready audio/video vector or delete any stale vector. Asset `vectorSync` state records source and vector schema versions plus the latest convergence timestamp.
- Deploy data first, vectors second, then API and processing. The vector stack imports the Assets stream export, while API and processing import the sync queue export. This sequence was deployed to production on 2026-08-02.
- Dry run reconciliation with `bun run --cwd infra/cdk reconcile:asset-vectors -- --index-arn <asset-tone-index-arn>`. Review the counts, then queue convergence with `bun run --cwd infra/cdk reconcile:asset-vectors -- --apply --index-arn <asset-tone-index-arn> --queue-url <vector-sync-queue-url>`.
- Rebuilding uses the same command with `--force` after recreating or clearing the derived index. Repeated and out-of-order messages are safe because the worker converges from a consistent DynamoDB read. Ordinary reconciliation compares authoritative eligibility/fingerprints with indexed keys; use `--force` to repair same-key vector data corruption.
- Initial production reconciliation completed with 20 eligible vectors, 74 ineligible assets, 94 current authoritative records, and zero orphan keys. Both the sync queue and DLQ were empty afterward.
- The API stack imports the vector index ARN for the deployed read-only public combo selection Lambda. No vector index replacement or backfill was required for the added `assetType` metadata filter.
- Production `POST /public/combos/select` uses a 15-second Lambda, a four-second S3 Vectors query deadline, and API Gateway throttling of 10 requests/second with burst 20. Embedded metrics use namespace `MediaManager/PublicComboSelection`.

## Known operational nits

- `.DS_Store` can appear in static deploy uploads if present in `dist/`; add exclusion in deploy script if needed.
- CDK deploy warns about Node 22 being untested by current CDK version; deploys still succeeded.
- Processing deploy no longer builds a tone-analysis container image; the tone worker is a Node Lambda bundled from `@media-manager/tone-core`.
- Current prod tone worker is a zip Lambda on `nodejs22.x` with the account-local ffmpeg layer attached.
- Ready tone analyses generated before display-field deployment may need the tone display backfill before the UI can render their Analysis section.
- Darenkeck resume PDF generation uses `/dev?print=1`; this internal mode must remain free of combo/HLS requests so content preparation does not depend on playback services.

## Generic asset jobs

- API stack owns the `media-manager-bulk-actions` queue and job API routes: `POST /jobs/preview`, `POST /jobs`, `GET /jobs/{id}`.
- Processing stack imports the queue ARN and runs `jobs-worker` from SQS messages.
- Current job type: `delete_assets`.
- Recursive delete expands selected folders through the asset container GSI, deletes deepest descendants first, removes original/derived S3 objects for media assets, and removes asset DynamoDB records.
- The web app uses `/api/jobs/*` proxy routes and polls active jobs for bottom-bar progress.

Related: [Current State](current-state.md), [Architecture Map](architecture-map.md), [Open Issues](open-issues.md).
