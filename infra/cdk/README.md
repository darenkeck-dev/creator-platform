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

### `MediaManagerApiStack` (`lib/api-stack.ts`)

Responsibility:

- Authenticated HTTP API for asset CRUD, upload lifecycle, and playback URL endpoints.

Creates:

- `api-assets` Lambda (list/create assets).
- `api-asset-by-id` Lambda (get/update/delete, upload URL, multipart, playback URL, upload-complete).
- API Gateway HTTP API + JWT authorizer.
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
- SQS queue for upload events.
- EventBridge rule: S3 Object Created -> SQS.
- EventBridge rule: MediaConvert state changes -> status updater Lambda.

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
  5. `AuthStack`
  6. `ApiStack`
  7. `ProcessingStack`
- Project scripts in `infra/cdk/package.json` wrap these (for example `bun run deploy:api`).
