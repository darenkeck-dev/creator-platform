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
