# Recent Changes

## High-signal recent commits

- `691cd45` - `ComboPlayer` uses audio as master timeline always.
- `a7747d9` - random combo avoids repeating previous audio (API + darenkeck client), plus markdown source moves to `raw_sources/`.
- `ce28017` - CloudFront security headers for darenkeck site stack.
- `2e8a408` - upload UI improvements (type inference, filename title default, visibility control).
- `3342a8c` - darenkeck site metadata/crawl baseline (robots/sitemap/favicon/meta tags).
- `e25b0c5` - audio default profile switched to normalized HLS transcode path.

## Recent operational updates

- Deployed `MediaManagerDarenkeckSiteStack` with custom domain wiring enabled for `darenkeck.com` using existing ACM cert in `us-east-1`.
- Cut over Route 53 apex alias from old CloudFront distribution to `EUQDAU6DH3BMC` (`d2fmm3qe2rclf2.cloudfront.net`).
- Completed phase-3 DNS ownership migration: Route 53 apex `A/AAAA` records are now created/managed by `MediaManagerDarenkeckSiteStack`.
- Bumped monorepo package versions to `1.0.0` across apps, shared packages, infra, and root workspace metadata.
- Release checks passed for baseline: `bun run typecheck`, `bun run test:infra`.
- Deployed streaming-stack CORS hardening: CloudFront now attaches a CORS response-headers policy and forwards preflight headers via origin request policy for derived HLS playback.
- Added localhost-focused playback debug controls in `apps/darenkeck` and exposed audio element callbacks in shared `ComboPlayer` for Chrome/Firefox audio troubleshooting.
- Simplified startup behavior in `ComboPlayer`: muted autoplay starts video only, and audio `play()` is deferred until unmute interaction.
- Moved `ComboPlayer` phase-change callback emission out of React state updater and into an effect to avoid cross-component setState warnings.
- Removed autoplay retry loop from `ComboPlayer` to keep startup behavior simpler/predictable in current release state.
- Updated playback event handling so muted-video mode ignores follower-audio pause/wait transitions and avoids false stalled states.
- Disabled local debug overlay rendering in `apps/darenkeck` and set shared `ComboPlayer` debug logging back to `false` for release readiness.
- Bumped monorepo/package versions from `1.0.0` to `1.0.1` and updated root README release status.
- Updated `scripts/deploy-darenkeck-static.sh` to exclude and remove `.DS_Store` objects during S3 sync deployments.
- Added tracked TODOs for mobile focus-loss and native play/pause state-machine handling in `wiki/open-issues.md`.

## Playback evolution summary

- `ComboPlayer` was simplified toward signal-driven state transitions.
- Polling/drift/scrub complexity was reduced across several refactor commits.
- Loop boundary jitter mitigations were added.
- Latest behavior: timeline authority is video while muted, then audio after unmute-driven audio start.

## API behavior deltas to remember

- Random public combo endpoint now supports optional prior audio hints.
- Asset read paths perform schema-version upgrade on read before validation.
- New audio uploads normalize via transcode profile to improve browser consistency.

Related: [Current State](current-state.md), [Open Issues](open-issues.md).
