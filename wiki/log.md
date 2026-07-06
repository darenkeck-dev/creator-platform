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
