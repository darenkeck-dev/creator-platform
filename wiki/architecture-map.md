# Architecture Map

## Layers

- **Frontend apps**
  - `apps/web`: authenticated media manager UI (upload/library/asset/combo admin).
  - `apps/darenkeck`: public combo-consumer site (random combo playback).
- **Shared packages**
  - `packages/contracts`: shared schemas/types for API payloads and records.
  - `packages/shared`: shared playback components (`ComboPlayer`) and playback utilities.
- **Infra**
  - `infra/cdk`: stacks + lambda handlers for auth, api, processing, storage, streaming, observability, darenkeck site.

## Data and media flow

1. Create asset metadata via API.
2. Upload original media to originals S3 bucket.
3. Confirm upload -> asset status `uploaded`.
4. Upload-trigger lambda resolves profile:
   - video: MediaConvert ladder
   - audio: MediaConvert audio HLS transcode
   - image/folder/passthrough profiles as configured
5. MediaConvert status lambda updates `stream` metadata + `ready/error`.
6. Playback APIs return stream URLs (`hlsMasterUrl` preferred).

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
