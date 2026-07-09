# Wiki Log

## [2026-04-10] bootstrap | wiki initialized

- Created `wiki/` synthesized context layer with cross-linked pages.
- Added current state, architecture map, deploy/ops notes, recent changes, and open issues.
- Confirmed source-planning docs live under `raw_sources/`.

## [2026-04-10] infra | darenkeck custom-domain wiring hooks

- Added optional `MediaManagerDarenkeckSiteStack` env-driven custom-domain support (CloudFront alias + ACM cert) in `infra/cdk/lib/darenkeck-site-stack.ts`.
- Added optional Route 53 alias A/AAAA record management gated by `DARENKECK_SITE_MANAGE_DNS`.
- Documented new env vars in `infra/cdk/README.md` and rollout notes in `wiki/deploy-and-ops.md`.

## [2026-04-10] deploy | darenkeck-site no-op validation

- Ran `bun run deploy:darenkeck-site` with all `DARENKECK_SITE_*` vars unset after loading base `.env`.
- CloudFormation result: `MediaManagerDarenkeckSiteStack` reported `no changes`.
- Confirmed outputs remained unchanged (`darenkeck-site-prod`, distribution `EUQDAU6DH3BMC`, domain `d2fmm3qe2rclf2.cloudfront.net`).

## [2026-04-10] cutover | darenkeck.com moved to MediaManager distribution

- Deployed `MediaManagerDarenkeckSiteStack` with `DARENKECK_SITE_DOMAIN_NAME=darenkeck.com`, existing ACM cert ARN, and `DARENKECK_SITE_MANAGE_DNS=false`.
- CloudFront update completed and stack now outputs `DARENKECK-SITE-DOMAIN=darenkeck.com`.
- Updated Route 53 apex aliases (`A` and `AAAA`) to target `d2fmm3qe2rclf2.cloudfront.net` (change id `/change/C0013184Y38GFKB6W7DB`, status `INSYNC`).

## [2026-04-10] deploy | phase-3 DNS ownership migration complete

- Attempted CloudFormation import for Route 53 record sets, but `AWS::Route53::RecordSet` import is unsupported in this environment.
- Executed controlled delete-then-create takeover: removed manual apex `A/AAAA` aliases, then deployed `MediaManagerDarenkeckSiteStack` with `DARENKECK_SITE_MANAGE_DNS=true` and hosted zone id.
- Verified stack-managed resources `DarenkeckSiteAliasARecord` and `DarenkeckSiteAliasAaaaRecord` are `CREATE_COMPLETE` and apex still resolves to `d2fmm3qe2rclf2.cloudfront.net`.
- Persisted `DARENKECK_SITE_*` settings in local `.env` and confirmed follow-up `deploy:darenkeck-site` is `no changes`.

## [2026-04-10] release | monorepo v1.0.0 baseline

- Updated workspace/app/package manifest versions to `1.0.0` (`package.json`, `apps/*/package.json`, `packages/*/package.json`, `infra/cdk/package.json`).
- Confirmed `MediaManagerDarenkeckSiteStack` continues to deploy with no changes under stack-managed DNS settings.
- Updated wiki current/recent state to capture release readiness posture.
- Release validation checks passed: `bun run typecheck` and `bun run test:infra`.

## [2026-04-10] fix | streaming CORS for browser HLS playback

- Added CloudFront CORS response headers policy on `MediaManagerStreamingStack` default cache behavior in `infra/cdk/lib/streaming-stack.ts`.
- Added CloudFront origin request policy forwarding `Origin`, `Access-Control-Request-Method`, and `Access-Control-Request-Headers` for S3 preflight handling.
- Added stack security test coverage in `infra/cdk/test/stacks/security.test.ts` for streaming CORS policies.
- Deployed `MediaManagerStreamingStack` and verified:
  - `GET` HLS manifest now returns `Access-Control-Allow-Origin: *`.
  - `OPTIONS` preflight with `Access-Control-Request-Headers: range` returns `200` with CORS headers.

## [2026-04-10] debug | local playback diagnostics for Chrome/Firefox

- Added `onAudioElementChange` callback support to shared `ComboPlayer` in `packages/shared/src/combo-player.tsx`.
- Wired debug media element refs through `apps/darenkeck/src/components/SingleComboSlot.tsx`.
- Added DEV-only debug overlay in `apps/darenkeck/src/App.tsx` with controls for mute/unmute, volume slider, play/pause probe, sync audio to video, next combo trigger, and live media state snapshots.
- Verified compile/build with `bun run typecheck` and `bun run --cwd apps/darenkeck build`.

## [2026-04-10] fix | strict sync playback startup in Chrome

- Updated `packages/shared/src/combo-player.tsx` startup semantics so audio is mandatory for successful playback start; video is paused on any start failure.
- Added autoplay retry scheduling for transient `AbortError` startup failures to reduce first-load races without requiring user controls.
- Updated seek-resume path to reuse strict `startPlayback` flow instead of independently starting tracks.
- Added unmute-click fallback in `apps/darenkeck/src/App.tsx` to align audio to video time and request `play()` for both media elements in a user gesture.
- Verified compile/build with `bun run typecheck` and `bun run --cwd apps/darenkeck build`.

## [2026-04-10] fix | remove setState-in-render warning from ComboPlayer

- Refactored `packages/shared/src/combo-player.tsx` so `onPlaybackStateChange` is emitted from a `useEffect` on `phase` changes instead of inside `setPhase` updater.
- This eliminates React warning: `Cannot update a component (App) while rendering a different component (ComboPlayer)`.
- Verified with `bun run typecheck` and `bun run --cwd apps/darenkeck build`.

## [2026-04-10] refactor | remove ComboPlayer autoplay retry logic

- Removed autoplay retry loop/state from `packages/shared/src/combo-player.tsx` (`AUTOPLAY_RETRY_DELAYS_MS`, retry refs/timers, and retry scheduler).
- Simplified startup flow so autoplay attempts once; on failure the strict sync behavior still pauses both tracks (no background retry machinery).
- Verified with `bun run typecheck` and `bun run --cwd apps/darenkeck build`.

## [2026-04-10] behavior | defer audio playback until unmute interaction

- Updated `packages/shared/src/combo-player.tsx` so muted autoplay does not call `audio.play()`; autoplay now starts video-only while muted.
- Timeline authority is now dynamic by mute state (video while muted, audio while unmuted).
- Updated pause/wait/play signal handling to avoid follower-audio pauses forcing stalled state during muted video mode.
- Verified with `bun run typecheck` and `bun run --cwd apps/darenkeck build`.

## [2026-04-10] release prep | hide debug surfaces and bump 1.0.1

- Disabled local debug overlay rendering by setting `SHOW_LOCAL_DEBUG_CONTROLS=false` in `apps/darenkeck/src/App.tsx`.
- Set `ENABLE_COMBO_PLAYER_DEBUG_LOGS=false` in `packages/shared/src/combo-player.tsx`.
- Bumped workspace/package versions to `1.0.1` (`package.json`, `apps/*/package.json`, `packages/*/package.json`, `infra/cdk/package.json`) and updated `README.md` release status.

## [2026-04-11] deploy | darenkeck static prod update

- Ran `bun run deploy:darenkeck:prod` from repo root.
- Built `apps/darenkeck` in production mode and synced to `s3://darenkeck-site-prod`.
- Created CloudFront invalidation for distribution `EUQDAU6DH3BMC` (id `ID641RJ3EYBUDQ5UTOWHG370Q5`) and verified status `Completed`.

## [2026-04-11] deploy | remove .DS_Store from static site pipeline

- Updated `scripts/deploy-darenkeck-static.sh` to run `aws s3 sync` with `.DS_Store` excludes and to remove existing `.DS_Store` objects from the destination bucket.
- Redeployed prod via `bun run deploy:darenkeck:prod`; confirmed deletion of stale object (`s3://darenkeck-site-prod/.DS_Store`).
- Created CloudFront invalidation `I2RWPF93GYBEJAAO3IQT3HFNMY` and verified status `Completed`.

## [2026-04-11] planning | darenkeck mobile playback TODO capture

- Added high-priority follow-ups for mobile focus-loss and native play/pause handling in `wiki/open-issues.md`.
- Added playback watchlist item for interruption-path state transitions (`visibilitychange`, app switch, screen lock, native media controls).

## [2026-06-22] tooling | opencode branch command

- Added repo-local opencode slash command `/open-branch` in `.opencode/commands/open-branch.md`.
- Command workflow checks dirty worktree state, derives `<type>/<slug>` branch names, rejects duplicate local/remote branches, and creates the branch with `git switch -c`.

## [2026-06-23] planning | tone embedding app plan

- Added root-level `TONE_EMBEDDING_APP_PLAN.md` for the proposed standalone tone embedding/training-data app.
- Moved exploratory tone-based audio/video markdown files into `raw_sources/` as source material.

## [2026-06-23] tooling | devflow MCP config

- Added repo-local opencode MCP server config at `.opencode/opencode.json`.
- Configured `devflow` to run from `/Users/daren/darenkeck-dev/devflow-mcp` via `uv run --directory ... devflow-mcp`.

## [2026-06-23] app | tone embedding skeleton

- Added `apps/tone-embedding/` Python app skeleton for manifest validation, executable preprocessing, placeholder tone extraction, congruence scoring, and JSONL training-row export.
- Added unit and CLI smoke-test coverage for the first implementation slice.
- Added optional Essentia audio adapter scaffolding for music valence/arousal extraction and expanded model-stack guidance in `TONE_EMBEDDING_APP_PLAN.md`.
- Added `scripts/setup-essentia-models.sh` to download ignored Essentia model artifacts for local tone extraction tests.
- Added `scripts/run-essentia-audio-test.sh` and `docs/audio-tone-extraction.md` for Docker-based Essentia test runs and expected output shape.
- Added dev-only tone-to-words descriptors to exported rows for quick audio/video tone verification.
- Added a reusable local Essentia Docker smoke-test image to avoid reinstalling `essentia-tensorflow` on every run.

## [2026-06-24] tooling | audio test covers two demo files

- Updated `apps/tone-embedding/examples/manifest.example.json` to reference `audio-demo-00.mp3` and `audio-demo-01.mp3` as separate audio assets paired with the sample video.
- Updated `apps/tone-embedding/scripts/run-essentia-audio-test.sh` to require both audio demos and default host-visible JSONL output to `apps/tone-embedding/tests/output/tone-training-essentia.jsonl`.
- Git-ignored `apps/tone-embedding/tests/output/` and refreshed the audio extraction docs/readme references.
- Cached Essentia TensorFlow predictor objects per adapter instance so batch extraction does not reload graph files for each audio asset.
- Restructured default extraction around per-asset analysis rows; combo congruence is deferred to a later combo-evaluation layer.
- Added root `AUDIO_TONE_MODEL_RUNBOOK.md` explaining Essentia/TensorFlow setup, invocation, audio loading, score normalization, and output shape with code links.
- Added initial OpenCLIP video tone adapter, video-only example manifest, Docker smoke-test script, and video extraction runbook.
- Updated the OpenCLIP video test manifest/script to process `video-demo-00.m4v` and `video-demo-01.m4v` as separate asset analysis rows.
- Added initial DINOv2 video embedding adapter, Docker smoke-test script, and runbook for visual embedding extraction.
- Updated local video Dockerfiles to install CPU-only PyTorch wheels and avoid CUDA package disk exhaustion.
- Added CPU-only `torchvision` to the DINOv2 test image because `transformers.AutoImageProcessor` requires it.
- Restructured asset extraction output into asset analysis rows with `modelRuns`, aggregate `tone` only for tone models, and `embeddings` for DINOv2.
- Added combined video analysis test script that runs OpenCLIP and DINOv2 and merges their outputs into upload-style asset analysis rows.
- Added tone bundle creation with bundle-relative embedding paths and `bundle create/inspect/extract` CLI commands.
- Expanded `TONE_EMBEDDING_APP_PLAN.md` Step 5 with remaining video tone/embedding work and acceptance criteria.
- Updated tone bundle behavior to produce one bundle per asset instead of grouped multi-asset bundles.
- Added extraction parameters to asset analysis `modelRuns[]` for OpenCLIP, DINOv2, and Essentia model runs.
- Verified tone embedding script syntax for Essentia/OpenCLIP/DINOv2/combined video scripts and reran unit tests (`25` passed, `1` optional NumPy skip).
- Verified placeholder single-asset bundle create/inspect/extract preserves `modelRuns[].parameters`.
- Added SigLIP video prompt-pair scoring and Qwen-VL scene-tone extraction adapters, Docker smoke scripts/images, CLI options, combined pipeline merge support, and docs/plan updates for the stronger video analysis stack.
- Updated SigLIP scoring to use positive-vs-negative raw logit deltas instead of sigmoid probability deltas, avoiding near-zero score collapse from probability compression.
- Updated SigLIP scoring again to apply `tanh(delta / 4.0)` soft clamping so extreme logit deltas remain bounded without immediately saturating at `-1` or `1`.
- Reworked dev-only `tone_to_words()` from quadrant-first labels to ranked descriptor selection across all tone dimensions so strong cold/unstable/menacing/etc. dimensions can drive summaries.
- Added `apps/tone-embedding/docs/tone-terms.md` to define tone dimensions, descriptors, output groups, thresholds, examples, and caveats for dev-facing tone words.
- Tuned the Qwen-VL Docker smoke path for local feasibility: default 2B model, 1 sampled frame, 96 generated tokens, automatic dtype/device mapping with possible offload, disabled mkldnn in the Qwen adapter, and a persistent Hugging Face cache under ignored test output.
- Tightened the Qwen-VL prompt/decoder for JSON-only output, switched generation to deterministic `do_sample=False`, raised the local smoke token budget to 192, and added response previews to non-JSON parse errors.
- Changed Qwen-VL from JSON score generation to freeform qualitative descriptor output only; added deterministic `structured_descriptors_to_tone()` for the later structured-output model stage.
- Added native macOS MPS support for Qwen-VL via `--qwen-device-map mps` and `scripts/run-qwen-vl-mps-test.sh`, keeping Docker as CPU correctness smoke only.
- Simplified native Qwen/MPS setup with a `qwen-mps` optional dependency extra and updated the MPS runner to use `uv run --extra qwen-mps`.
- Added an OpenAI video tone adapter that requests structured descriptor scores, maps them into tone vectors deterministically, and keeps the provider isolated behind `--video-model openai` plus an `openai` optional dependency extra.
- Added `python-dotenv` to OpenAI/video extras, automatic `.env`/`.env.local` loading in the tone CLI, and `apps/tone-embedding/.env.example` for local OpenAI API key setup.
- Updated the OpenAI video tone adapter default model to `gpt-5`.
- Updated descriptor-score conversion so canonical dimensions are derived from descriptor words; provider-supplied dimensions are advisory metadata to tolerate OpenAI/Gemini variance.
- Added a tone-plan follow-up for OpenAI audio descriptor generation, including audio/video output-shape alignment and future combo delta tracking support.
- Implemented OpenAI audio descriptor generation with the shared `tone-descriptor-scores/v1` schema and deterministic descriptor-to-tone mapping.
- Updated OpenAI audio extraction to default to `gpt-audio` and use prompt-enforced JSON because `gpt-audio` accepts audio through Chat Completions but does not support strict structured outputs.
- Updated the OpenAI audio request to include the documented Chat Completions audio fields (`modalities`, `audio`, and `input_audio`) so `gpt-audio` receives the attached file.
- Updated OpenAI audio response parsing to read JSON from `message.audio.transcript` when `message.content` is empty.
- Added initial V1 combo analysis over existing asset analysis rows, computing audio/video `deltaTone`, `absDeltaTone`, `interactionTone`, descriptive congruence/contrast/intensity, strongest matches/contrasts, and a delta-heavy nearest-neighbor vector without producing combo quality or meaning judgements.
- Added `apps/tone-embedding/docs/combo-scoring-system.md` documenting the V1 combo-analysis shape, scoring definitions, nearest-neighbor vector layout, and future V2 user-input/training path.
- Removed stale direct combo/training-row language from the tone plan and deleted the unused `build_training_rows()` helper so the app language consistently uses asset analysis first and separate `combo-analysis/v1` rows later.
- Added `asset-analysis/v1` row versioning, bundle `analysisSchemas`, and `apps/tone-embedding/docs/media-manager-invocation.md` to define the V1 external invocation contract for Media Manager-managed jobs.
- Updated the combined video analysis script to use native Qwen-VL MPS by default and leave the Docker CPU Qwen path as a standalone smoke test only.
- Simplified the primary V1 video analysis run to OpenAI semantic+tone metadata plus DINOv2 embeddings; OpenCLIP, SigLIP, and Qwen-VL remain standalone experimental adapters.
- Expanded OpenAI audio analysis to emit `audio-semantic-tone/v1` metadata with semantic audio description fields plus descriptor scores for tone.
- Updated OpenAI audio analysis to use `gpt-audio` for natural-language audible metadata and always use `OPENAI_AUDIO_STRUCTURE_MODEL` (`gpt-5` by default) for strict JSON and calibrated descriptor values.

## [2026-07-01] docs | primary tone pipeline README

- Added `apps/tone-embedding/scripts/run-audio-analysis-test.sh` as the generic primary audio analysis runner, matching the existing primary video runner naming and producing per-asset bundles.
- Rewrote `apps/tone-embedding/README.md` to lead with primary audio/video pipeline usage, V1 output artifacts, manifest shape, direct CLI examples, environment variables, combo analysis, and experimental/model-specific runs later.
- Verified `bash -n` for primary audio/video runners, unit tests (`43` passed, `1` optional skip), and Python compile checks for `apps/tone-embedding/src`.

## [2026-07-01] cli | Python-native tone workflows

- Added `tone_embedding.workflows` helpers for single-file audio/video analysis, combined multi-model video analysis rows, direct combo analysis from audio/video analysis files, and JSON/JSONL analysis IO.
- Added `tone_embedding.neighbors` with local cosine-similarity top-k lookup over existing `nearestNeighborVector` values for development verification.
- Extended the CLI with `analyze audio`, `analyze video`, `combo build`, and `neighbors query` while preserving existing manifest extraction, bundle, and combo analyze commands.
- Added `apps/tone-embedding/VECTOR_DB_PREP_PLAN.md` to document the future backend-agnostic vector DB boundary and non-goals.
- Updated `apps/tone-embedding/README.md` with prerequisites and uv-first CLI examples, then made the README app-relative so it can move with `apps/tone-embedding` as a standalone repo. CLI examples now use `uv sync --no-editable`, then `uv run --no-editable ...`.
- Added packaged `tone-taxonomy/v1` data for descriptor keywords, dimension mappings, strength labels, and avoid rules; `tone.py` now derives descriptor behavior from that taxonomy and asset/combo rows record `toneTaxonomyVersion`.
- Updated CLI readiness for conversion-job use: `uv sync --no-editable` now documents and validates the `tone-embedding` console command without `PYTHONPATH`, schema contract fixtures were added for `asset-analysis/v1` and `tone-taxonomy/v1`, and the README/Media Manager invocation docs include exact production commands while leaving container implementation for review.
- Switched `--models primary` to OpenAI-only and updated README/Media Manager/video pipeline docs plus primary audio/video scripts for Lambda-first analysis. DINOv2 remains available as an explicit opt-in embedding adapter outside the primary path.

## [2026-07-06] validation | real OpenAI tone smoke

- Generated ignored local audio/video smoke fixtures under `apps/tone-embedding/examples/media/` and ran real OpenAI audio and primary video analysis.
- Created and inspected per-asset `.tonebundle.tar.gz` files for both smoke outputs.
- Fixed the OpenAI extra to include `numpy` for OpenCV frame sampling and updated bundle creation to accept the single JSON object shape emitted by direct `analyze audio/video` commands.

## [2026-07-06] packaging | tone CLI help and no-editable docs

- Standardized tone app docs on `uv run --no-editable ...` because editable console-script behavior is unreliable after switching install modes.
- Removed the stale `apps/tone-embedding/TODO.md` item and replaced it with explicit no-editable command guidance in the README/docs.
- Improved CLI help output with command descriptions, clearer positional metavars, examples, and complete option help.

## [2026-07-06] infra | tone analysis upload integration

- Added optional `toneAnalysis` metadata to asset records for OpenAI primary tone artifacts and status tracking.
- Added a separate tone-analysis SQS queue/DLQ and tone-analysis worker fed by originals S3 object-created events.
- Worker reads the OpenAI API key from SSM `SecureString`, analyzes original audio/video assets via the tone CLI, writes analysis/bundle artifacts to the derived bucket, and updates `toneAnalysis` without changing top-level asset readiness.
- Verified with `bun run typecheck`, `bun run test:infra`, `bun run --cwd infra/cdk build:lambda`, and `bun run build`.

## [2026-07-07] deploy | tone analysis processing stack

- Deployed `MediaManagerProcessingStack` with the initial tone-analysis container image Lambda, SQS queue/DLQ, EventBridge fan-out target, and IAM permissions.
- Verified live Lambda configuration uses `/media-manager/prod/openai-api-key`, `media-originals-prod`, and `media-derived-prod`.
- Verified `media-manager-originals-object-created` now targets both `media-manager-upload-events` and `media-manager-tone-analysis`.
- Clarified docs that EventBridge is the shared upload-event router and SQS provides separate durable work queues for conversion and tone analysis.

## [2026-07-07] web | expose async processing states

- Updated the Media Manager web UI so library and folder asset cards show both conversion and tone-analysis state.
- Updated asset details to show tone status, profile, artifact S3 paths, and errors, and to keep polling while tone analysis is queued/processing.
- Verified with `bun run typecheck` and `bun run --cwd apps/web build`.

## [2026-07-07] package | tone-core TypeScript foundation

- Added `packages/tone-core` as a Bun/TypeScript workspace package for Lambda-native tone analysis while keeping the Python `apps/tone-embedding` CLI unchanged.
- Ported v1 tone taxonomy, descriptor-to-tone mapping, tone word generation, combo scoring/vector layout, and nearest-neighbor helpers.
- Added OpenAI audio/video analysis entrypoints and direct `ffmpeg` frame extraction via `child_process.spawn`, with an optional local CLI for smoke tests.
- Verified with `bun run typecheck`, `bun run test`, and `bun run build`.

## [2026-07-07] infra | tone worker moved to tone-core

- Replaced the integrated Python/uv tone worker implementation with a bundled Node Lambda that imports `@media-manager/tone-core` directly.
- Removed the tone-analysis Dockerfile/build-context staging path from CDK; `build:lambda` now bundles tone analysis as a normal Node artifact.
- Added `FFMPEG_PATH` support for video frame extraction and optional `FFMPEG_LAYER_ARN` attachment for a Lambda ffmpeg layer.
- The Node worker currently writes `asset-analysis.json`; `.tonebundle.tar.gz` generation is deferred until bundle creation is ported into `tone-core`.

## [2026-07-07] deploy | node tone worker with ffmpeg layer

- Built an account-local ffmpeg-only Lambda layer from the static Linux x86_64 ffmpeg release, published as `arn:aws:lambda:us-west-2:125455294948:layer:media-manager-ffmpeg:1`.
- Deployed `MediaManagerProcessingStack` with `FFMPEG_LAYER_ARN` set to that layer ARN.
- Verified live tone worker `MediaManagerProcessingSta-ToneAnalysisWorkerFuncti-Voz3eWjvMUQ6` is `PackageType=Zip`, `Runtime=nodejs22.x`, `Handler=index.handler`, `FFMPEG_PATH=/opt/bin/ffmpeg`, and has the ffmpeg layer attached.

## [2026-07-07] fix | tone worker DynamoDB key and smoke test

- Fixed the Node tone worker to read/update asset records using the live table key shape `{ pk: ASSET#<id>, sk: META }` instead of `{ id }`.
- Added focused Lambda test coverage for tone-analysis DynamoDB key usage.
- Redeployed `MediaManagerProcessingStack` with the fixed worker and the same ffmpeg layer.
- Ran a live prod audio smoke with temporary asset `tone-smoke-20260707-node-audio`; the worker returned `processed=1`, wrote `asset-analysis.json`, and updated `toneAnalysis.status=ready`.
- Removed the temporary smoke DynamoDB record plus originals/derived S3 objects after verification.

## [2026-07-07] validation | node tone worker demo media smoke

- Ran live Node Lambda tone-analysis smokes against the original Python tone demo clips from `apps/tone-embedding/examples/media/`.
- Audio clips verified: `audio-demo-00.mp3`, `audio-demo-01.mp3`.
- Video clips verified: `video-demo-00.m4v`, `video-demo-01.m4v`; this exercised the deployed ffmpeg Lambda layer for frame extraction.
- All four temporary assets returned `processed=1`, reached `toneAnalysis.status=ready`, and wrote `derived/<assetId>/tone/asset-analysis.json`.
- Removed all temporary smoke DynamoDB records plus staged originals and derived tone artifacts; processing queues and DLQs were clear afterward.

## [2026-07-07] feature | asset audit log trail

- Added `asset.auditLog` contract metadata with bounded public-safe entries: timestamp, category, level, message, source, code, and primitive details.
- Added `infra/cdk/lambda/shared/asset-audit-log.ts` as the shared Node Lambda helper for appending and bounding audit entries.
- Wired initial log points into asset creation, upload URL/multipart init/upload confirmation, upload-trigger conversion queue/submission/passthrough/failure, MediaConvert status updates, and tone-analysis start/skip/ready/failure.
- Added an Activity Log section at the bottom of the Media Manager asset detail UI.

## [2026-07-07] deploy | audit log backend updates

- Deployed `MediaManagerApiStack` with audit-log-capable `api-assets` and `api-asset-by-id` lambdas.
- Deployed `MediaManagerProcessingStack` with audit-log-capable `upload-trigger`, `mediaconvert-status`, and `tone-analysis` lambdas, preserving ffmpeg layer `arn:aws:lambda:us-west-2:125455294948:layer:media-manager-ffmpeg:1`.
- Post-deploy checks passed: public API health returned `200`, upload/tone queues were empty, tone DLQ was empty, and updated lambdas reported fresh `LastModified` timestamps.
- `apps/web` audit-log UI was built locally but not published from this repo because no web deploy script, CDK web stack, `.vercel` link, or local Vercel CLI was available.

## [2026-07-07] feature | display tone on asset detail

- Extended `asset.toneAnalysis` with display-ready tone fields: summary, primary/secondary/avoid words, scores, semantic summary, caption, and mood.
- Updated the Node tone-analysis Lambda to copy display fields from `AssetAnalysis` into asset metadata when tone analysis reaches `ready`.
- Added an asset detail Tone Analysis section with summary, badges, score bars, and semantic notes so the UI does not need to fetch or unpack derived artifacts for normal display.

## [2026-07-08] fix | backfill tone display fields

- Deployed `MediaManagerApiStack` and `MediaManagerProcessingStack` so API reads and new tone analyses use the display-ready `toneAnalysis` fields.
- Added `bun run --cwd infra/cdk backfill:tone-analysis-display` to hydrate ready analyses that predated display-field writes.
- Ran the prod backfill for two affected assets; both now have `summary`, `primaryWords`, and `scores` in `toneAnalysis`, and the follow-up dry run reports zero missing display fields.

## [2026-07-08] fix | tone score chart bounds

- Updated the asset detail Tone Analysis score bars to clamp signed values to `[-1, 1]` and render as zero-centered bipolar bars that cannot overflow their track.

## [2026-07-08] research | tone taxonomy v2 brief

- Added a research brief for another agent to review affective norm literature and propose `tone-taxonomy/v2` keyword and weighted mapping changes while keeping OpenAI output keyword-based.

## [2026-07-08] feature | tone taxonomy v2 implementation

- Implemented `tone-taxonomy/v2` in `packages/tone-core` with 11 added descriptors, weighted multi-dimension descriptor mappings, and dominance defined as perceived potency/force/scale.
- Updated descriptor scoring to sum `strengthValue * mappingWeight` contributions by dimension and clamp final tone vector values to `[-1, 1]`.
- Updated schemas/contracts so new analyses emit `tone-taxonomy/v2` while parsers accept existing `tone-taxonomy/v1` artifacts.
- Verified with `bun run typecheck`, `bun run test`, `bun run --cwd infra/cdk build:lambda`, and `bun run build`.

## [2026-07-08] deploy | tone taxonomy v2 backend

- Deployed `MediaManagerApiStack` and `MediaManagerProcessingStack` with `tone-taxonomy/v2` support.
- Preserved ffmpeg layer `arn:aws:lambda:us-west-2:125455294948:layer:media-manager-ffmpeg:1` on the tone-analysis Lambda.
- Post-deploy checks passed: public API health returned `200`, tone queue was empty, tone DLQ was empty, and the tone worker reported a fresh `LastModified` timestamp.

## [2026-07-08] docs | release roadmap in README

- Replaced the stale root README with a concise repo overview, current state, common commands, and the roadmap to the next release milestone: collecting user input on combos.

## [2026-07-08] web | library list view and bulk delete

- Added a reusable `LibraryAssetBrowser` for library and folder child views with grid/list toggle, multi-select, select-all, and bulk delete through existing per-asset DELETE routes.
- Updated the README roadmap to mark list view and initial bulk delete support as started.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.

## [2026-07-08] web | media manager layout cleanup

- Removed the redundant top-nav `Library` link because breadcrumbs and the `Media Manager` header already link back to the library.
- Moved folder-child creation beside the folder name/edit/delete card on folder detail pages.
- Replaced text-only asset type labels in library/folder browsers with icons for audio, video, image, and folder assets.
- Verified with `bun run --cwd apps/web build` and a sequential `bun run --cwd apps/web typecheck` rerun after the known `.next/types` race.

## [2026-07-08] web | context-aware add menu

- Replaced direct create-folder surfaces with a compact `+` add menu that offers `Folder` and `Media upload` actions.
- Folder creation now opens a compact dialog and creates folders in the active root/folder context.
- Removed the top-nav `Upload` link; media upload is now reached through the contextual add menu.
- `/upload?containerId=<folderId>` now defaults the upload destination to the active folder, preserving context from library/folder views.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.

## [2026-07-08] web | remove library filters

- Removed the Media Manager library filter form and related page-level parsing for type, facet, origin, and sort filters.
- Library now loads the current root/folder asset set directly; backend/frontend API filter support remains available for internal folder pickers until filtering is redesigned.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.

## [2026-07-08] web | breadcrumb asset titles

- Updated breadcrumbs to resolve asset/folder IDs through the local asset API and display titles instead of raw IDs for asset pages and library folder context.
- Wrapped app-shell breadcrumbs in `Suspense` because the breadcrumb component now reads search params.
- Verified with `bun run --cwd apps/web build` and `bun run --cwd apps/web typecheck`.

## [2026-07-08] web | library list default and folder rows

- Changed the Media Manager library browser to default to list mode, with grid mode available through `view=grid`.
- Updated folder rows/cards to link into folder contents and omit asset-only status, conversion, tone, and source-count fields.

## [2026-07-08] feature | generic jobs and recursive delete

- Added shared contracts for generic asset jobs, previews, progress, and job status records.
- Added backend job APIs for preview/create/status and an API-owned `media-manager-bulk-actions` SQS queue.
- Added a processing `jobs-worker` that handles `delete_assets` jobs by recursively expanding selected folders through the container GSI and deleting deepest descendants first.
- Added web job proxy routes, reusable recursive delete confirmation dialog, and a bottom progress bar that polls active jobs.

## [2026-07-09] fix | job creation DynamoDB marshalling

- Fixed `api-jobs` and `jobs-worker` DynamoDB document clients to remove undefined values before marshalling nested job preview/progress data.
- Deployed `MediaManagerApiStack` and `MediaManagerProcessingStack` with the fix.
- Verified with a live folder-only recursive delete smoke: preview found two temporary folders, create returned `202`, worker completed the job, temporary records were removed, and bulk-actions queues/DLQ were empty.

## [2026-07-09] feature | queued tone and conversion reprocessing jobs

- Extended generic asset jobs with `reprocess_tone` and `reprocess_conversion` job types.
- Reprocessing jobs expand selected folders, mark unsupported items as skipped in preview, and queue existing tone/upload processing workers rather than doing media work inline.
- Added conversion profile selection for conversion reprocessing and manual status refresh controls in library and asset detail status areas.

## [2026-07-09] fix | normalize audio before OpenAI tone analysis

- Added `tone-core` audio normalization that transcodes source audio to a deterministic MP3 file with ffmpeg before OpenAI `input_audio` submission.
- Wired the tone-analysis Lambda to pass `FFMPEG_PATH` for audio normalization, matching the existing video frame extraction path.
- Added focused `tone-core` test coverage for the normalization command/output path.

## [2026-07-09] deploy | audio normalization processing smoke

- Deployed `MediaManagerProcessingStack` with audio normalization in the tone-analysis worker.
- Fixed processing stack ffmpeg-layer wiring so the account-local `media-manager-ffmpeg:1` layer is attached by default unless `FFMPEG_LAYER_ARN` overrides it.
- Verified live tone worker has `FFMPEG_PATH=/opt/bin/ffmpeg` and layer `arn:aws:lambda:us-west-2:125455294948:layer:media-manager-ffmpeg:1` attached.
- Requeued previously failing asset `ff2fde86-978e-4a7f-8c49-5a8025930ad6` (`audio/x-m4a`); it completed with `toneAnalysis.status=ready` and `tone-taxonomy/v2`.

## [2026-07-09] web | hide media asset lineage panel

- Removed the generic Lineage Context card from media asset detail pages because normal uploaded assets usually have no source/child relationships and the UI was folder-schema noise.
- Stopped fetching asset lineage and children for non-folder asset detail pages; folder detail pages still fetch and render child assets.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.

## [2026-07-09] web | asset move folder tree dialog

- Removed the media asset page `Nested Location` card.
- Added a move icon button next to `Edit` on asset detail pages; it opens a reusable move dialog with root selection and expandable folder tree navigation.
- The dialog supports selecting root or a folder and confirms through the existing `/assets/{id}/move` route; the component is structured around asset count and confirm callback so it can be reused for bulk moves.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.

## [2026-07-09] web | move dialog layout polish

- Tightened move dialog padding, centered folder row controls vertically, and added nested guide indentation for expanded folder levels.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.
