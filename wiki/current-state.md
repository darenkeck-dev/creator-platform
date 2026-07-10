# Current State

## Live shape

- Monorepo: `apps/web`, `apps/darenkeck`, `infra/cdk`, `packages/contracts`, `packages/shared`, `packages/tone-core`.
- Workspace/package manifests are now versioned at `1.0.1` for upcoming release tracking.
- Primary runtime flows are working: upload -> processing -> ready -> combo playback.
- `darenkeck` static site is deployed on S3 + CloudFront with security headers and crawl metadata.

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
- Media Manager now has a generic job framework for long-running asset actions; recursive delete and queued tone/conversion reprocessing report progress through a bottom status bar.
- Tone review capture has started: audio/video asset pages and combo pages can submit target-centered human keywords and tone scores through `POST /tone-reviews` without storing raw reviewer PII.

Details: [Recent Changes](recent-changes.md).

## Most relevant deployed outputs

- API URL: `https://adenvmeabg.execute-api.us-west-2.amazonaws.com`
- Primary site domain: `https://darenkeck.com` (Route 53 apex alias -> `EUQDAU6DH3BMC`)
- Darenkeck site bucket: `darenkeck-site-prod`
- Darenkeck CloudFront distribution: `EUQDAU6DH3BMC`
- Darenkeck CloudFront domain: `d2fmm3qe2rclf2.cloudfront.net`
- Route 53 apex `A/AAAA` records for `darenkeck.com` are now stack-managed in `MediaManagerDarenkeckSiteStack`.

## Working assumptions

- Assets must be `status=ready` and `visibility=public` for `GET /public/combos/random` selection.
- For private library/editor flows, auth is Cognito JWT-backed through API Gateway.
- Markdown planning/checklist files are now in `raw_sources/` and not co-located with runtime code.
