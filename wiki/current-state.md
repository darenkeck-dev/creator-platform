# Current State

## Live shape

- Monorepo: `apps/web`, `apps/darenkeck`, `infra/cdk`, `packages/contracts`, `packages/shared`, `packages/tone-core`.
- Workspace/package manifests are now versioned at `1.0.1` for upcoming release tracking.
- Primary runtime flows are working: upload -> processing -> ready -> combo playback.
- `darenkeck` static site is deployed on S3 + CloudFront with security headers and crawl metadata.
- `apps/darenkeck` uses React Router for public routes. `/dev` is deployed and lazy-loads the fetched `content/resume.md` with styled Markdown components plus a generated print-friendly PDF download.
- Public-site content lives as Pages CMS-managed Markdown in the private `darenkeck-dev/darenkeck-content` repository. Darenkeck deploys fetch and validate that content before building; news/blog collection routes remain pending.

See also: [Architecture Map](architecture-map.md), [Deploy and Ops](deploy-and-ops.md).

## Key behavior now

- Audio uploads default to `audio-transcode-hls-v1` (normalized HLS output), originals still preserved.
- Random public combo API accepts optional previous audio hint and avoids repeating prior audio track when possible.
- `ComboPlayer` now uses video timeline while muted and switches to audio timeline once unmuted playback is user-activated.
- Streaming CloudFront now emits CORS headers for derived HLS objects and supports preflight header forwarding.
- `apps/darenkeck` local playback debug overlay is currently disabled for release preparation.
- `ComboPlayer` startup now avoids audio `play()` during muted autoplay; audio playback begins on user unmute interaction.
- `packages/tone-core` is the TypeScript-native tone analysis core for Lambda-native extraction; the existing Python `apps/tone-embedding` CLI remains unchanged as the experimental/reference implementation.
- Prod processing now uses the zip-based Node `tone-core` tone-analysis worker with an account-local ffmpeg Lambda layer for video frame extraction.
- Audio tone analysis now normalizes source audio to a known-good MP3 with ffmpeg before sending it to OpenAI, avoiding strict `input_audio` format failures on decodable originals.
- New `tone-core` analyses use research-informed `tone-taxonomy/v2`: expanded descriptor keywords and weighted multi-dimension keyword mappings, with dominance defined as perceived potency/force/scale.
- Asset records now support a bounded public `auditLog` trail for upload, conversion, MediaConvert, and tone-analysis lifecycle events; the asset detail UI renders it as an activity log.
- Library and folder child views now support grid/list display, multi-select, select-all, and bulk delete using existing per-asset delete APIs.
- Selected library items now use one Action disclosure for Make Public, Make Private, tone reprocessing, and conversion reprocessing; Delete remains a separate destructive button. Visibility changes use bounded per-asset PATCH requests, skip folders, report partial failures, and automatically trigger vector convergence.
- Upload supports multi-file batches with MIME/extension type inference for audio, video, and images; each file gets editable title/type, independent status/progress, and bounded-concurrency upload over the existing per-asset APIs. Batches default to private and to the folder from which Upload was opened.
- Media Manager now has a generic job framework for long-running asset actions; recursive delete and queued tone/conversion reprocessing report progress through a bottom status bar.
- Tone reviews are submitted only through the dedicated Review page as target-centered human keywords; asset and combo detail pages no longer contain review forms.
- Media Manager includes a dedicated `Review` route with a top-right Combo/Audio/Video switch; it defaults to a random public combo, switches to fresh random audio/video assets from the full owned asset pool, uses an adaptive five-keyword tone picker biased toward the latest selected descriptor, and shows only reviews for the current asset/combo target.
- Combo review playback now uses a reusable shared `ComboToneReviewPlayer` surface with background combo playback, overlaid Next, adaptive keyword selection, selected chips, and submit. Media Manager wires it to authenticated review submission; public anonymous submission for `darenkeck.com` still needs a public API path.
- Human review capture starts blank/neutral for combo, audio, and video targets. OpenAI-extracted tone remains displayed on asset detail pages, but review inputs are independent human judgments rather than edits to model output.
- The `Combos` page is now the all-combo-review index, linking reviewed combinations back into the review surface.
- Audio/video tone scores now preserve OpenAI output in `toneAnalysis.scores` and materialize `adjustedScores` by weighting OpenAI as one vote and each taxonomy-compatible curator review as one vote. Combo reviews never adjust source assets.
- Combo reviews currently store keywords and source asset IDs without derived combo scores or review-time source-vector snapshots. The agreed future boundary computes combo tone on demand from effective audio/video vectors, starting with a versioned deterministic predictor and allowing a learned implementation later; no combo vectors are persisted.
- Audio/video curator keywords are mapped server-side into taxonomy score vectors; client-provided scores are ignored. Asset detail dumbbell bars compare extracted and adjusted values with a colored delta connector.
- Audio/video asset pages list their target-specific review history at the bottom and link directly to `/review` with that asset preselected for manual review.
- Production tone reviews were reset on 2026-07-15 so curator calibration starts clean under the adjusted-score workflow.
- The MVP S3 Vectors foundation is deployed. Production has the provider-neutral vector index/query boundary, AWS adapter, SQS- and DynamoDB Stream-backed convergence worker, lifecycle producers, fingerprinted asset sync state, queue/DLQ alarms, and dry-run/apply/force reconciliation with orphan detection. The initial reconciliation indexed all 20 eligible assets; all 94 authoritative asset records are current with zero orphan vectors. Public combo selection still uses the existing random path.
- The accepted next walk slice adds one gated `POST /public/combos/select` endpoint with explicit `mode="walk"`. The vector database retrieves typed source candidates by Euclidean distance; combo tones are predicted and ranked exactly in application code, never persisted. Endpoint, filtered queries, predictor, history, metrics, and client integration are not implemented yet.
- Auth guard middleware covers app and same-origin API routes; missing/expired Cognito JWT cookies redirect page requests to login with the original path preserved and return JSON `401` for API requests. Cognito web client ID/access token validity is configured for 12 hours.

Details: [Recent Changes](recent-changes.md).

## Most relevant deployed outputs

- API URL: `https://adenvmeabg.execute-api.us-west-2.amazonaws.com`
- Primary site domain: `https://darenkeck.com` (Route 53 apex alias -> `EUQDAU6DH3BMC`)
- Darenkeck site bucket: `darenkeck-site-prod`
- Darenkeck CloudFront distribution: `EUQDAU6DH3BMC`
- Darenkeck CloudFront domain: `d2fmm3qe2rclf2.cloudfront.net`
- Route 53 apex `A/AAAA` records for `darenkeck.com` are now stack-managed in `MediaManagerDarenkeckSiteStack`.
- Asset tone vector index: `arn:aws:s3vectors:us-west-2:125455294948:bucket/media-manager-asset-tone/index/asset-tone-v1`

## Working assumptions

- Assets must be `status=ready` and `visibility=public` for `GET /public/combos/random` selection.
- For private library/editor flows, auth is Cognito JWT-backed through API Gateway.
- Markdown planning/checklist files are now in `raw_sources/` and not co-located with runtime code.
