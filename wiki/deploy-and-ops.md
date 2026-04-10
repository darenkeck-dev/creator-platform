# Deploy and Ops

## Core deploy commands

- API stack: `bun run deploy:api`
- Processing stack: `bun run deploy:processing`
- Darenkeck site infra (CloudFront/S3 settings): `bun run deploy:darenkeck-site`
- Darenkeck static site publish (build + sync + invalidation): `bun run deploy:darenkeck:prod`

## Typical change-to-deploy mapping

- `infra/cdk/lambda/api-*` -> deploy API stack.
- `infra/cdk/lambda/upload-trigger` or `mediaconvert-status` -> deploy processing stack.
- `infra/cdk/lib/darenkeck-site-stack.ts` -> deploy darenkeck site infra stack.
- `apps/darenkeck/*` runtime/static content -> deploy darenkeck static site.

## Post-deploy quick checks

- API health: call `GET /public/combos/random` and verify 200 payload with `videoSrc/audioSrc`.
- Darenkeck: verify homepage loads + combo playback starts.
- Crawl basics: check `/robots.txt` and `/sitemap.xml`.
- Headers: verify CloudFront returns HSTS, CSP, nosniff, referrer, frame options, permissions policy.

## Known operational nits

- `.DS_Store` can appear in static deploy uploads if present in `dist/`; add exclusion in deploy script if needed.
- CDK deploy warns about Node 22 being untested by current CDK version; deploys still succeeded.

Related: [Current State](current-state.md), [Architecture Map](architecture-map.md), [Open Issues](open-issues.md).
