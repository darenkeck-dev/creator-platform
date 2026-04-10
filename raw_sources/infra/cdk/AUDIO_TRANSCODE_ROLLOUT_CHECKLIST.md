# Audio Transcode Rollout Checklist

Feature goal: keep original uploaded audio files, and generate a normalized streamable derivative so Chrome/Safari playback is consistent.

## Scope and decisions

- [x] Confirm target profile id: `audio-transcode-hls-v1`
- [x] Confirm normalized output settings (recommended): AAC LC, 48 kHz, stereo, 128 kbps, HLS master manifest output
- [x] Confirm rollout strategy: delete all existing audio assets after deploy and re-upload (no backfill)
- [x] Confirm rollback policy: keep `audio-passthrough-v1` available as non-default fallback

## Contracts and schemas

- [x] Add `audio-transcode-hls-v1` to `PROCESSING_PROFILES` in `packages/contracts/src/index.ts`
- [x] Ensure any profile enums/schemas that depend on `PROCESSING_PROFILES` still typecheck
- [x] Add/update tests for profile parsing and validation if needed

## Upload trigger processing changes

- [x] Add `audio-transcode-hls-v1` to processing profile ids in `infra/cdk/lambda/upload-trigger/index.ts`
- [x] Extend profile registry/map to route this profile to `mediaconvert` mode
- [x] Add dedicated audio-only MediaConvert settings builder:
  - [x] Input uses uploaded original object (`incoming/{assetId}`)
  - [x] Output destination is `derived/{assetId}/hls/`
  - [x] Output produces playlist and segments suitable for `stream.hlsMasterUrl`
  - [x] No poster output for audio-only jobs
- [x] Ensure `UserMetadata.processingProfile` is set to `audio-transcode-hls-v1` on submitted jobs
- [x] Ensure status transitions remain consistent: `queued -> processing -> ready/error`

## MediaConvert status handling

- [x] Verify `infra/cdk/lambda/mediaconvert-status/index.ts` handles audio-only HLS outputs
- [x] Verify `playlistFilePaths` contains a master path for audio jobs
- [x] Verify `stream.hlsMasterUrl` is populated for audio assets on `ready`
- [x] Verify conversion payload records the new profile and completion timestamp

## Default profile cutover

- [x] Change default audio profile from `audio-passthrough-v1` to `audio-transcode-hls-v1` in `infra/cdk/lambda/api-assets/index.ts`
- [x] Keep explicit passthrough profile support in code during stabilization window

## Tests and verification

- [x] Update/add unit tests in `infra/cdk/test/lambda/upload-trigger.test.ts` for new audio transcode path
- [x] Update/add unit tests in `infra/cdk/test/lambda/mediaconvert-status.test.ts` for audio-only HLS completion payloads
- [x] Run checks:
  - [x] `bun run --cwd infra/cdk typecheck`
  - [x] `bun run --cwd infra/cdk test`

## Deploy

- [x] Commit feature changes with focused commit message(s)
  - [x] Commit: `e25b0c5` (`feat(audio): transcode uploads to normalized HLS profile`)
- [x] Deploy API stack:
  - [x] `bun run deploy:api`
- [x] Deploy processing stack:
  - [x] `bun run deploy:processing`

## Data reset and re-upload

- [ ] Delete all existing audio assets (metadata + originals/derived objects through normal delete flow)
- [ ] Re-upload audio assets after deployment
- [ ] Confirm each re-uploaded audio asset reaches `status=ready`
- [ ] Confirm each has `stream.hlsMasterUrl`

## Smoke testing

- [ ] Chrome: verify playback works for a representative set of tracks (including previously failing tracks)
- [ ] Safari: verify playback still works for same set
- [ ] Combo playback: verify random combo endpoint returns playable URLs and no browser-specific decode failures

## Documentation

- [ ] Update relevant README/runbook sections to note audio normalization via transcode profile
- [ ] Document expected output format and profile behavior for future uploads

## Post-rollout cleanup (after stability window)

- [ ] Decide whether to retire `audio-passthrough-v1` from user-facing defaults/inputs
- [ ] If retiring, remove references from contracts/tests/docs in a follow-up change
