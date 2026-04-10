# CDK Stacks Overview

This directory defines the AWS infrastructure for Media Manager as multiple CDK stacks.
Each stack owns a clear slice of the system and shares values through CloudFormation exports/imports.

## Stage naming

- Stage is controlled by `APP_STAGE` (defaults to `prod`).
- Non-prod stages get suffixes on stack/resource names (for example `MediaManagerApiStack-dev`).
- Export names are also stage-scoped (see `lib/stage.ts`).

## Stacks

### `MediaManagerCoreStack` (`lib/core-stack.ts`)

Responsibility:

- Publishes shared constants used across environments.

Creates:

- CloudFormation output/export for supported asset types (`video,audio,image`).

### `MediaManagerAuthStack` (`lib/auth-stack.ts`)

Responsibility:

- Authentication and authorization entry points.
- User allowlist enforcement during token generation.

Creates:

- Cognito User Pool.
- Cognito User Pool Client (authorization code flow).
- Cognito hosted domain.
- Google identity provider integration.
- `pre-token-allowlist` Lambda trigger.

Imports:

- `ASSETS-TABLE-NAME` (from `DataStack`) for allowlist lookup.

Exports:

- `USER-POOL-ID`
- `USER-POOL-CLIENT-ID`
- `COGNITO-DOMAIN`
- `REGION`

### `MediaManagerDataStack` (`lib/data-stack.ts`)

Responsibility:

- Persistent metadata storage.

Creates:

- DynamoDB `Assets` table (`pk`/`sk`).
- GSI `AssetByCreatedAt` (`gsi1pk`/`gsi1sk`) for listing by creation time.

Exports:

- `ASSETS-TABLE-NAME`
- `ASSETS-CREATED-AT-GSI`

### `MediaManagerStorageStack` (`lib/storage-stack.ts`)

Responsibility:

- Object storage for source uploads and derived outputs.

Creates:

- S3 originals bucket (`media-originals-<stage>`), EventBridge enabled.
- S3 derived bucket (`media-derived-<stage>`).

Exports:

- `MEDIA-ORIGINALS-BUCKET-NAME`
- `MEDIA-DERIVED-BUCKET-NAME`

### `MediaManagerStreamingStack` (`lib/streaming-stack.ts`)

Responsibility:

- Secure read delivery of derived media.

Creates:

- CloudFront Origin Access Control (OAC).
- CloudFront distribution backed by derived S3 bucket.
- S3 bucket policy allowing CloudFront service principal read access.

Imports:

- `MEDIA-DERIVED-BUCKET-NAME` (from `StorageStack`).

Exports:

- `CLOUDFRONT-DOMAIN`

### `MediaManagerDarenkeckSiteStack` (`lib/darenkeck-site-stack.ts`)

Responsibility:

- Static site hosting for `apps/darenkeck` via S3 + CloudFront.

Creates:

- Private S3 bucket (`darenkeck-site-<stage>`) for static build artifacts.
- CloudFront Origin Access Control (OAC).
- CloudFront distribution with SPA fallback to `/index.html` for 403/404 responses.
- S3 bucket policy allowing read access only from the created CloudFront distribution.

Exports:

- `DARENKECK-SITE-BUCKET-NAME`
- `DARENKECK-SITE-CLOUDFRONT-DOMAIN`
- `DARENKECK-SITE-CLOUDFRONT-DISTRIBUTION-ID`
- `DARENKECK-SITE-DOMAIN` (when custom domain inputs are provided)

Optional custom domain inputs (environment variables):

- `DARENKECK_SITE_DOMAIN_NAME`: CloudFront alternate domain (for example `darenkeck.com`).
- `DARENKECK_SITE_CERT_ARN`: ACM cert ARN in `us-east-1` for the domain.
- `DARENKECK_SITE_MANAGE_DNS`: set `true` to let this stack manage Route 53 alias records.
- `DARENKECK_SITE_HOSTED_ZONE_ID`: required when `DARENKECK_SITE_MANAGE_DNS=true`.
- `DARENKECK_SITE_DNS_RECORD_NAME`: optional Route 53 record name override (defaults to `DARENKECK_SITE_DOMAIN_NAME`).

Notes:

- Domain and cert must be set together.
- Leaving these unset preserves CloudFront-domain-only behavior.
- `DARENKECK_SITE_MANAGE_DNS` is safe to keep `false` during phased migration.

### `MediaManagerApiStack` (`lib/api-stack.ts`)

Responsibility:

- Authenticated HTTP API for asset CRUD, upload lifecycle, and playback URL endpoints.

Creates:

- `api-assets` Lambda (list/create assets).
- `api-asset-by-id` Lambda (get/update/delete, upload URL, multipart, playback URL, upload-complete).
- API Gateway HTTP API + JWT authorizer.
- API Gateway access log group for the `$default` stage.
- Route mappings for all `/assets` endpoints.

Imports:

- `USER-POOL-ID`, `USER-POOL-CLIENT-ID`, `REGION` (from `AuthStack`).
- `ASSETS-TABLE-NAME`, `ASSETS-CREATED-AT-GSI` (from `DataStack`).
- `MEDIA-ORIGINALS-BUCKET-NAME`, `MEDIA-DERIVED-BUCKET-NAME` (from `StorageStack`).

Exports:

- `API-URL`

### `MediaManagerProcessingStack` (`lib/processing-stack.ts`)

Responsibility:

- Media processing orchestration and status updates.

Creates:

- MediaConvert service role.
- `upload-trigger` Lambda (responds to original uploads, submits MediaConvert jobs or passthrough updates).
- `mediaconvert-status` Lambda (updates asset status/stream metadata from MediaConvert events).
- SQS queue for upload events + DLQ.
- EventBridge rule: S3 Object Created -> SQS.
- EventBridge rule: MediaConvert state changes -> status updater Lambda.

### `MediaManagerObservabilityStack` (`lib/observability-stack.ts`)

Responsibility:

- Cost and alerting baseline.

Creates:

- AWS Budget (monthly cost budget).
- Email notification subscriber for budget threshold alerting.

Imports:

- `ASSETS-TABLE-NAME` (from `DataStack`).
- `MEDIA-ORIGINALS-BUCKET-NAME`, `MEDIA-DERIVED-BUCKET-NAME` (from `StorageStack`).
- `CLOUDFRONT-DOMAIN` (from `StreamingStack`).

## Deployment notes

- App entry point: `bin/cdk.ts`.
- Typical deploy flow for a fresh environment:
  1. `CoreStack`
  2. `DataStack`
  3. `StorageStack`
  4. `StreamingStack`
  5. `DarenkeckSiteStack`
  6. `AuthStack`
  7. `ApiStack`
  8. `ProcessingStack`
  9. `ObservabilityStack`
- Project scripts in `infra/cdk/package.json` wrap these (for example `bun run deploy:api`).

## Asset schema migrations

Asset metadata records are versioned with `schemaVersion` in contracts.

Current migration behavior:

- Read paths in API/processing lambdas run assets through a version-aware upgrader before schema validation.
- If an item is upgraded during read, the upgraded shape is written back to DynamoDB.
- This enables forward rollout where existing records can be upgraded lazily as they are accessed.

When introducing a new asset schema version:

1. Add the next migration step in `lambda/shared/asset-record-versioning.ts`.
2. Bump `ASSET_SCHEMA_VERSION` in `packages/contracts/src/index.ts`.
3. Deploy lambdas/stacks.
4. Optionally run an eager backfill so upgrades happen proactively instead of on first read.

Backfill command:

- Dry run: `bun run --cwd infra/cdk backfill:asset-schema-version`
- Apply writes: `bun run --cwd infra/cdk backfill:asset-schema-version -- --apply`
