# Architecture Map

## Layers

- **Frontend apps**
  - `apps/web`: authenticated media manager UI (upload/library/asset/combo admin).
  - `apps/darenkeck`: public combo-consumer site (random combo playback).
- **Shared packages**
  - `packages/contracts`: shared schemas/types for API payloads and records.
  - `packages/shared`: shared playback components (`ComboPlayer`) and playback utilities.
  - `packages/tone-core`: TypeScript tone schemas, OpenAI analysis helpers, ffmpeg frame extraction, combo scoring, and nearest-neighbor utilities for Lambda-native tone processing.
- **Infra**
  - `infra/cdk`: stacks + lambda handlers for auth, api, processing, storage, streaming, observability, darenkeck site.

## Data and media flow

1. Create asset metadata via API.
2. Upload original media to originals S3 bucket.
3. Confirm upload -> asset status `uploaded`.
4. Originals S3 object-created events enter the shared processing eventing pattern: EventBridge routes the upload event to per-workflow SQS queues.
5. The media conversion queue feeds `upload-trigger`, which resolves profile:
   - video: MediaConvert ladder
   - audio: MediaConvert audio HLS transcode
   - image/folder/passthrough profiles as configured
6. MediaConvert status lambda updates `stream` metadata + `ready/error`.
7. The tone-analysis queue feeds `tone-analysis`, which independently analyzes original audio/video assets with the OpenAI primary tone pipeline and writes artifacts under `derived/<assetId>/tone/`.
8. Node lambdas append public-safe asset lifecycle entries to `asset.auditLog` through `infra/cdk/lambda/shared/asset-audit-log.ts`.
9. Playback APIs return stream URLs (`hlsMasterUrl` preferred).

Eventing note: EventBridge is the common router. Separate SQS queues keep conversion and tone analysis operationally isolated so tone retries/backlogs do not delay playback processing.

See also: [Current State](current-state.md), [Recent Changes](recent-changes.md).

## Public combo path

- Endpoint: `GET /public/combos/random`
- Candidate sources:
  - derived random public video+audio pair
  - existing saved public combo
- Optional query hint:
  - `previousAudioAssetId` (or alias `previousTrack`)
- Behavior:
  - avoids returning same audio track as previous when possible
  - same video track is acceptable

## Deployment model

- API/processing: CDK stacks via root scripts (`deploy:api`, `deploy:processing`).
- Darenkeck infra: `deploy:darenkeck-site` (CloudFront/S3 config).
- Darenkeck static assets: `deploy:darenkeck:prod` or staging variant.

Details: [Deploy and Ops](deploy-and-ops.md).
