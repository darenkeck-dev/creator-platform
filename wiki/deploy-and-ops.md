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

## Darenkeck custom domain wiring (optional)

- `MediaManagerDarenkeckSiteStack` supports optional CloudFront custom-domain wiring via env vars:
  - `DARENKECK_SITE_DOMAIN_NAME`
  - `DARENKECK_SITE_CERT_ARN` (must be ACM in `us-east-1`)
  - `DARENKECK_SITE_MANAGE_DNS` (`true`/`false`)
  - `DARENKECK_SITE_HOSTED_ZONE_ID` (required when DNS management is enabled)
  - `DARENKECK_SITE_DNS_RECORD_NAME` (optional; defaults to domain name)
- Phased migration recommendation:
  - deploy with domain + cert while `DARENKECK_SITE_MANAGE_DNS=false`
  - cut over alias ownership/DNS in a controlled window
  - optionally enable DNS management in stack after ownership is moved

Current production status:

- CloudFront distribution `EUQDAU6DH3BMC` is configured with alias `darenkeck.com`.
- Route 53 apex `A` and `AAAA` aliases point to `d2fmm3qe2rclf2.cloudfront.net`.
- DNS is now managed by CloudFormation in `MediaManagerDarenkeckSiteStack` (`DARENKECK_SITE_MANAGE_DNS=true`).

Migration note:

- `AWS::Route53::RecordSet` does not support CloudFormation resource import in this environment.
- For existing manual apex records, takeover requires delete-then-create migration (remove manual records, then deploy stack-managed records immediately).

## Post-deploy quick checks

- API health: call `GET /public/combos/random` and verify 200 payload with `videoSrc/audioSrc`.
- Darenkeck: verify homepage loads + combo playback starts.
- Crawl basics: check `/robots.txt` and `/sitemap.xml`.
- Headers: verify CloudFront returns HSTS, CSP, nosniff, referrer, frame options, permissions policy.
- Streaming CORS: verify HLS manifest responds with `Access-Control-Allow-Origin` for cross-origin requests:
  - `curl -I -H "Origin: https://darenkeck.com" https://<streaming-cloudfront>/derived/<asset>/hls/<manifest>.m3u8`
  - optional preflight check: `curl -i -X OPTIONS -H "Origin: https://darenkeck.com" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: range" https://<streaming-cloudfront>/derived/<asset>/hls/<manifest>.m3u8`

## Known operational nits

- `.DS_Store` can appear in static deploy uploads if present in `dist/`; add exclusion in deploy script if needed.
- CDK deploy warns about Node 22 being untested by current CDK version; deploys still succeeded.

Related: [Current State](current-state.md), [Architecture Map](architecture-map.md), [Open Issues](open-issues.md).
