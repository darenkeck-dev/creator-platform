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
