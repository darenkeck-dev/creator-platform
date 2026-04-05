# darenkeck Deploy Runbook

This app is deployed as a static site to S3 + CloudFront.

## Environments

- **staging**
  - env file: `apps/darenkeck/.env.staging`
  - build command: `bun run build:darenkeck:staging`
- **production**
  - env file: `apps/darenkeck/.env.production`
  - build command: `bun run build:darenkeck:prod`

Both env files must set:

```bash
VITE_COMBO_API_BASE_URL=<api-base-url>
```

## Pre-deploy checklist

1. Confirm target env API URL is correct.
2. Run local checks:
   - `bun run --cwd apps/darenkeck typecheck`
   - `bun run --cwd apps/darenkeck lint`
3. Build target environment.

## Deploy steps

1. Build target env:

```bash
bun run build:darenkeck:staging
# or
bun run build:darenkeck:prod
```

2. Upload static output:

```bash
aws s3 sync apps/darenkeck/dist s3://<bucket-name> --delete
```

3. Invalidate CloudFront cache:

```bash
aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*"
```

## Helper script snippets

You can use root helper scripts to run build + S3 sync + CloudFront invalidation in one command:

```bash
bun run deploy:darenkeck:staging
bun run deploy:darenkeck:prod
```

The scripts resolve bucket/distribution IDs from CloudFormation exports and then deploy static assets.

Use CloudFormation exports from `MediaManagerDarenkeckSiteStack` so you do not hardcode bucket/distribution values.

### Staging

```bash
STAGE=staging
BUCKET_EXPORT="DARENKECK-SITE-BUCKET-NAME-STAGING"
DIST_EXPORT="DARENKECK-SITE-CLOUDFRONT-DISTRIBUTION-ID-STAGING"

BUCKET_NAME=$(aws cloudformation list-exports --query "Exports[?Name=='${BUCKET_EXPORT}'].Value | [0]" --output text)
DIST_ID=$(aws cloudformation list-exports --query "Exports[?Name=='${DIST_EXPORT}'].Value | [0]" --output text)

bun run build:darenkeck:staging
aws s3 sync apps/darenkeck/dist "s3://${BUCKET_NAME}" --delete
aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*"
```

### Production

```bash
STAGE=prod
BUCKET_EXPORT="DARENKECK-SITE-BUCKET-NAME"
DIST_EXPORT="DARENKECK-SITE-CLOUDFRONT-DISTRIBUTION-ID"

BUCKET_NAME=$(aws cloudformation list-exports --query "Exports[?Name=='${BUCKET_EXPORT}'].Value | [0]" --output text)
DIST_ID=$(aws cloudformation list-exports --query "Exports[?Name=='${DIST_EXPORT}'].Value | [0]" --output text)

bun run build:darenkeck:prod
aws s3 sync apps/darenkeck/dist "s3://${BUCKET_NAME}" --delete
aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*"
```

## Post-deploy smoke checks

1. Load homepage in a fresh browser session.
2. Verify top loader and shell handoff behavior.
3. Verify `/public/combos/random` playback starts.
4. Validate mute button cycles full -> 50% -> mute.
5. Confirm combo transitions to next combo at end.

## Rollback

If rollout fails:

1. Re-sync previous known-good `dist` build to S3.
2. Re-run CloudFront invalidation.
3. Re-check homepage and playback.
