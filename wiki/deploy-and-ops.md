# Deploy and Ops

## Core deploy commands

- API stack: `bun run deploy:api`
- Processing stack: `bun run deploy:processing`
- Darenkeck site infra (CloudFront/S3 settings): `bun run deploy:darenkeck-site`
- Darenkeck static site publish (build + sync + invalidation): `bun run deploy:darenkeck:prod`

## Typical change-to-deploy mapping

- `infra/cdk/lambda/api-*` -> deploy API stack.
- `infra/cdk/lambda/upload-trigger`, `mediaconvert-status`, or `tone-analysis` -> deploy processing stack.
- `infra/cdk/lambda/api-jobs` or job API routes/queue config -> deploy API stack, then processing stack for worker changes.
- `infra/cdk/lambda/jobs-worker` -> deploy processing stack after the API stack has exported the bulk-actions queue.
- `infra/cdk/lib/darenkeck-site-stack.ts` -> deploy darenkeck site infra stack.
- `apps/darenkeck/*` runtime/static content -> deploy darenkeck static site.

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
- Darenkeck: verify homepage loads + combo playback starts.
- Crawl basics: check `/robots.txt` and `/sitemap.xml`.
- Headers: verify CloudFront returns HSTS, CSP, nosniff, referrer, frame options, permissions policy.
- Streaming CORS: verify HLS manifest responds with `Access-Control-Allow-Origin` for cross-origin requests:
  - `curl -I -H "Origin: https://darenkeck.com" https://<streaming-cloudfront>/derived/<asset>/hls/<manifest>.m3u8`
  - optional preflight check: `curl -i -X OPTIONS -H "Origin: https://darenkeck.com" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: range" https://<streaming-cloudfront>/derived/<asset>/hls/<manifest>.m3u8`

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

## Known operational nits

- `.DS_Store` can appear in static deploy uploads if present in `dist/`; add exclusion in deploy script if needed.
- CDK deploy warns about Node 22 being untested by current CDK version; deploys still succeeded.
- Processing deploy no longer builds a tone-analysis container image; the tone worker is a Node Lambda bundled from `@media-manager/tone-core`.
- Current prod tone worker is a zip Lambda on `nodejs22.x` with the account-local ffmpeg layer attached.
- Ready tone analyses generated before display-field deployment may need the tone display backfill before the UI can render their Analysis section.

## Generic asset jobs

- API stack owns the `media-manager-bulk-actions` queue and job API routes: `POST /jobs/preview`, `POST /jobs`, `GET /jobs/{id}`.
- Processing stack imports the queue ARN and runs `jobs-worker` from SQS messages.
- Current job type: `delete_assets`.
- Recursive delete expands selected folders through the asset container GSI, deletes deepest descendants first, removes original/derived S3 objects for media assets, and removes asset DynamoDB records.
- The web app uses `/api/jobs/*` proxy routes and polls active jobs for bottom-bar progress.

Related: [Current State](current-state.md), [Architecture Map](architecture-map.md), [Open Issues](open-issues.md).
