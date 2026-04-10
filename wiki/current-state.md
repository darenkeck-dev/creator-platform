# Current State

## Live shape

- Monorepo: `apps/web`, `apps/darenkeck`, `infra/cdk`, `packages/contracts`, `packages/shared`.
- Workspace/package manifests are now versioned at `1.0.0` for release baseline tracking.
- Primary runtime flows are working: upload -> processing -> ready -> combo playback.
- `darenkeck` static site is deployed on S3 + CloudFront with security headers and crawl metadata.

See also: [Architecture Map](architecture-map.md), [Deploy and Ops](deploy-and-ops.md).

## Key behavior now

- Audio uploads default to `audio-transcode-hls-v1` (normalized HLS output), originals still preserved.
- Random public combo API accepts optional previous audio hint and avoids repeating prior audio track when possible.
- `ComboPlayer` timeline master is now always audio (video is follower).

Details: [Recent Changes](recent-changes.md).

## Most relevant deployed outputs

- API URL: `https://adenvmeabg.execute-api.us-west-2.amazonaws.com`
- Primary site domain: `https://darenkeck.com` (Route 53 apex alias -> `EUQDAU6DH3BMC`)
- Darenkeck site bucket: `darenkeck-site-prod`
- Darenkeck CloudFront distribution: `EUQDAU6DH3BMC`
- Darenkeck CloudFront domain: `d2fmm3qe2rclf2.cloudfront.net`
- Route 53 apex `A/AAAA` records for `darenkeck.com` are now stack-managed in `MediaManagerDarenkeckSiteStack`.

## Working assumptions

- Assets must be `status=ready` and `visibility=public` for `GET /public/combos/random` selection.
- For private library/editor flows, auth is Cognito JWT-backed through API Gateway.
- Markdown planning/checklist files are now in `raw_sources/` and not co-located with runtime code.
