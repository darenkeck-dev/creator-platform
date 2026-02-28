# Media Uploader on AWS — Implementation Plan

## Overview

Goal:

- Upload video/audio/images
- Store original 4K source
- Transcode to max 1080p HLS for streaming
- Stream publicly via CloudFront
- Google SSO via Cognito
- Tag assets (facet + freeform)
- Prepare for future LLM/semantic search

Tech stack:

- Next.js + shadcn/ui
- Bun (package manager/runtime)
- Turborepo (monorepo task runner)
- AWS CDK (TypeScript)
- Cognito (Google SSO)
- S3 (originals + derived)
- API Gateway + Lambda
- MediaConvert
- CloudFront
- DynamoDB (initial metadata store)

---

# Phase 0 — Repository Setup (Bun + Turbo)

## 0.1 Create Monorepo Structure

```
apps/
  web/                # Next.js app
infra/
  cdk/                # AWS CDK stacks
packages/
  contracts/          # shared schemas/types/contracts
```

Tasks:

- [x] Initialize repo and create folders: `apps/web`, `infra/cdk`, `packages/contracts`
- [x] Create root `package.json` with:
  - [x] `workspaces: ["apps/*", "infra/*", "packages/*"]`
  - [x] scripts: `dev`, `build`, `lint`, `typecheck` (all via `turbo run ...`)
  - [x] devDependencies: `turbo`, `typescript`, `eslint`, `prettier`
- [x] Create `turbo.json` pipeline:
  - [x] `dev` (no cache, persistent)
  - [x] `build` depends on `^build`, outputs include `.next/**` and `dist/**`
  - [x] `lint` and `typecheck` depend on `^lint`/`^typecheck`
- [x] Add root TypeScript config files:
  - [x] `tsconfig.base.json` for shared compiler options
  - [x] `tsconfig.json` with references to workspace projects
- [x] Add formatting/linting baseline:
  - [x] `.eslintrc.*` (or flat config)
  - [x] `.prettierrc`
  - [x] `.prettierignore`
- [x] Add `.env.example` at repo root with shared vars placeholder
- [x] Run `bun install` and confirm `bun.lock` is generated and committed

Done when:

- `bun run dev --filter=web` starts the Next.js app from monorepo root
- `bun run typecheck` passes across all configured workspaces
- `bun run lint` runs from root through Turbo

---

## 0.2 Next.js + shadcn Setup

Tasks:

- [x] Create Next.js app in `apps/web` (TypeScript + App Router)
- [x] Ensure `apps/web/package.json` scripts exist: `dev`, `build`, `lint`, `typecheck`
- [x] Install and initialize shadcn/ui in `apps/web`
- [x] Configure Tailwind and `components.json`
- [x] Add baseline UI shell (`Header`, page container, navigation)
- [x] Create base routes:
  - `/login`
  - `/library`
  - `/upload`
  - `/asset/[id]`
- [x] Add placeholder route guards/middleware stub for protected pages

Done when:

- App runs locally with placeholder pages.
- App can also be started via Turbo from repo root.
- `bun run build --filter=web` succeeds.

---

## 0.3 Contracts Package + Infra Workspace Wiring

Tasks:

- [x] Initialize `packages/contracts` with `package.json`, `tsconfig.json`, and `src/index.ts`
- [x] Add initial shared exports:
  - [x] `AssetType` enum/union (`video | audio | image`)
  - [x] basic asset status constants (`draft`, `uploaded`, `processing`, `ready`, `error`)
- [x] Initialize `infra/cdk` workspace with `package.json` and TypeScript config
- [x] Ensure `infra/cdk` has scripts: `build`, `typecheck`, `synth`
- [x] Add workspace dependency usage test:
  - [x] import one type from `packages/contracts` in `apps/web`
  - [x] import one type from `packages/contracts` in `infra/cdk`

Done when:

- `bun run typecheck` validates shared imports in both app and infra workspaces
- `bun run build --filter=@media-manager/contracts` succeeds

---

# Phase 1 — AWS Setup + CDK Bootstrap

## 1.1 AWS CLI

Tasks:

- [x] Configure AWS CLI profile
- [x] Choose region
- [x] Verify:

```
aws sts get-caller-identity
```

Done when:

- CLI returns account identity.

---

## 1.2 CDK Initialization

In `infra/cdk`:

Tasks:

- [x] Initialize CDK (TypeScript)
- [x] Bootstrap environment:

```
node ./node_modules/aws-cdk/bin/cdk bootstrap aws://ACCOUNT_ID/REGION
```

Done when:

- `bun run synth` runs successfully in `infra/cdk`.

---

# Phase 2 — Auth (Cognito + Google SSO)

## 2.1 Auth Stack

Create `AuthStack`.

Resources:

- Cognito User Pool
- User Pool Client (OAuth enabled)
- Hosted UI domain

Outputs:

- USER_POOL_ID
- USER_POOL_CLIENT_ID
- COGNITO_DOMAIN
- REGION

Done when:

- Stack deploys and outputs values.

---

## 2.2 Google Identity Provider

Tasks:

- [x] Create Google OAuth app
- [x] Configure redirect URIs
- [x] Add Google IdP to Cognito
- [x] Pass Google client secret to CDK deploy as `NoEcho` parameter

Implementation notes:

- CDK parameters:
  - `GoogleOAuthClientId`
  - `GoogleOAuthClientSecret` (`NoEcho`)
- Deploy without persisting secret in repo/env files:

```
node ./node_modules/aws-cdk/bin/cdk deploy MediaManagerAuthStack \
  --parameters GoogleOAuthClientId=<google-client-id> \
  --parameters GoogleOAuthClientSecret=<google-client-secret>
```

- Cognito redirect URI to add in Google OAuth app:

```
https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse
```

Done when:

- Hosted UI login works.

---

## 2.3 Next.js Login Flow

Tasks:

- [x] Redirect to Cognito Hosted UI
- [x] Handle callback route
- [x] Store JWT securely (httpOnly cookie)
- [x] Protect `/library` and `/upload`

Done when:

- Unauthenticated users are redirected.
- Login returns to protected page.

---

## 2.4 Access Control (Pre-Token Lambda + Allowlist)

Goal:

- Restrict sign-in to approved emails using a hardcoded list for the initial auth rollout.

Tasks:

- [x] Add Cognito **Pre Token Generation** Lambda trigger in `AuthStack`
- [x] Configure trigger to read user email from Cognito event attributes
- [x] Add a hardcoded allowlist array of approved emails in the Lambda
- [x] Normalize and validate email format before allowlist check
- [x] Reject token issuance when email is missing or not in allowlist
- [x] Add a short update workflow note for changing the hardcoded list (code change + deploy)
- [x] Add explicit validation steps for allowlisted, denied, and edge-case auth flows

Follow-up note:

- This phase is intentionally hardcoded.
- After Phase 3.1 deploys DynamoDB, migrate the allowlist to table-backed lookup in Phase 3.1.1.
- Hardcoded allowlist location: `infra/cdk/lambda/pre-token-allowlist/index.ts` (`ALLOWED_EMAILS` set)
- Update flow for allowlist changes in this phase:
  1. edit `ALLOWED_EMAILS`
  2. deploy `MediaManagerAuthStack`

Status update:

- Completed in Phase 3.1.1: allowlist source moved from hardcoded array to DynamoDB-backed lookup.

Future data model for migration:

- Reuse the media metadata DynamoDB table with reserved auth keys:

```
PK = AUTH#ALLOWLIST
SK = EMAIL#user@example.com

PK = AUTH#ALLOWLIST
SK = DOMAIN#example.com
```

Suggested attributes:

- `enabled` (boolean)
- `note` (optional)
- `updatedAt` (ISO timestamp)
- `updatedBy` (optional)

Done when:

- Non-allowlisted users authenticate with Google but are denied Cognito token issuance.
- Allowlisted users receive tokens successfully.
- Validation procedure is documented and can be executed manually.

Validation steps:

1. Deploy latest auth changes:

```
cdk deploy MediaManagerAuthStack
```

2. Validate allowlisted login path:

- Sign in with an email present in `ALLOWED_EMAILS`.
- Confirm callback completes and a session is established.
- Confirm protected routes (`/library`, `/upload`) load without redirecting to login.

3. Validate denied login path:

- Sign in with a Google account not present in `ALLOWED_EMAILS`.
- Confirm Google auth succeeds, but Cognito token issuance is blocked.
- Confirm app remains unauthenticated (no valid session cookie / redirected to login).

4. Validate edge cases:

- Verify mixed-case/whitespace email input still matches after normalization.
- Verify missing/invalid email in event attributes is rejected.

Validation execution status (2026-02-23):

- [x] Deployed `MediaManagerAuthStack` successfully via CDK.
- [x] Confirmed Cognito user pool has `PreTokenGeneration` trigger configured to the deployed Lambda.
- [x] Confirmed allowlist Lambda resource exists in stack with `CREATE_COMPLETE` status.
- [x] Manual allowlisted login path verification in browser.
- [x] Manual denied login path verification in browser.
- [x] Manual edge-case verification (normalized and invalid/missing emails).

---

# Phase 3 — Data Model + API

## 3.1 DynamoDB Table

Create `DataStack`.

Table: `Assets`

Keys:

- PK: `pk`
- SK: `sk`

Design:

```
ASSET#{id}     META
ASSET#{id}     TAG#{facet}#{value}
ASSET#{id}     RENDITION#{type}
AUTH#ALLOWLIST EMAIL#{email}
AUTH#ALLOWLIST DOMAIN#{domain}
```

Include GSI for listing by created date.

Done when:

- Can insert and read dummy asset record.

Execution status (2026-02-23):

- [x] Added `DataStack` with DynamoDB table `Assets` (`pk`, `sk`) in `infra/cdk/lib/data-stack.ts`.
- [x] Added GSI `AssetByCreatedAt` with keys `gsi1pk`, `gsi1sk`.
- [x] Wired `MediaManagerDataStack` in `infra/cdk/bin/cdk.ts`.
- [x] Deployed `MediaManagerDataStack` successfully.
- [x] Inserted and read dummy asset record (`PK=ASSET#dummy-001`, `SK=META`) in DynamoDB table `Assets`.

---

## 3.1.1 Migrate Auth Allowlist to DynamoDB

Tasks:

- [x] Replace hardcoded email list in pre-token Lambda with DynamoDB lookup
- [x] Use key pattern:
  - [x] `PK=AUTH#ALLOWLIST, SK=EMAIL#<email>`
  - [x] `PK=AUTH#ALLOWLIST, SK=DOMAIN#<domain>`
- [x] Add least-privilege IAM read access for allowlist keys
- [x] Seed initial allowlist entries in DynamoDB
- [x] Document operator workflow to add/remove users without redeploy

Operator workflow:

1. Add or update an allowlist entry in table `Assets`:
   - email allow: `PK=AUTH#ALLOWLIST`, `SK=EMAIL#user@example.com`
   - domain allow: `PK=AUTH#ALLOWLIST`, `SK=DOMAIN#example.com`
   - optional controls: `enabled` (BOOL), `note`, `updatedAt`, `updatedBy`
2. Revoke access by deleting the item or setting `enabled=false`.
3. No Lambda or stack redeploy is required for allowlist updates.

CLI helpers:

- Add email: `bun run allowlist:add-email -- user@example.com`
- Remove email: `bun run allowlist:remove-email -- user@example.com`
- Add domain: `bun run allowlist:add-domain -- example.com`
- Remove domain: `bun run allowlist:remove-domain -- example.com`

Done when:

- Allowlist updates are applied by DynamoDB data changes only.
- No code deploy is needed to allow or revoke a user.

Execution status (2026-02-23):

- [x] Pre-token Lambda now checks DynamoDB keys `EMAIL#<email>` and `DOMAIN#<domain>` under `PK=AUTH#ALLOWLIST`.
- [x] Auth Lambda IAM policy allows only `dynamodb:GetItem` on table `Assets` with leading key constraint `AUTH#ALLOWLIST`.
- [x] Seeded initial email allowlist entry for `darenkeck@gmail.com`.
- [x] Deployed `MediaManagerAuthStack` with migrated Lambda and verified allow/deny behavior via direct Lambda invoke.

---

## 3.2 API Stack

Create `ApiStack`.

Tasks:

- [x] Add `MediaManagerApiStack` with API Gateway HTTP API resources
- [x] Add Lambda handlers for `POST /assets` and `GET /assets`
- [x] Add Lambda handler for `GET /assets/{id}` and `PATCH /assets/{id}`
- [x] Configure JWT authorizer with Cognito user pool issuer + audience
- [x] Attach JWT protection to all `/assets` routes
- [x] Grant Lambda least-privilege DynamoDB access for asset CRUD/list operations
- [x] Add deploy script for API stack
- [x] Deploy API stack and validate route behavior

Resources:

- API Gateway (HTTP API)
- Lambda functions
- JWT authorizer using Cognito

Endpoints:

- POST /assets
- GET /assets
- GET /assets/{id}
- PATCH /assets/{id}

Done when:

- Authenticated requests succeed.

Execution status (2026-02-23):

- [x] Deployed `MediaManagerApiStack` successfully.
- [x] API URL output: `https://adenvmeabg.execute-api.us-west-2.amazonaws.com`
- [x] Verified all required routes exist and are configured with `AuthorizationType=JWT`.
- [x] Verified unauthenticated request to `GET /assets` returns `401`.
- [x] Verified authenticated handler flow via Lambda invocation simulation:
  - `POST /assets` creates a record in DynamoDB
  - `GET /assets` lists created records
  - `GET /assets/{id}` returns created record
  - `PATCH /assets/{id}` updates record fields

---

## 3.3 Asset Schema

Tasks:

- [x] Define and enforce META schema fields for asset records
- [x] Support tag model with controlled facets, freeform values, weight, and source
- [x] Validate create/update payloads with schema checks in API lambdas
- [x] Ensure create and patch flows persist tag updates to DynamoDB
- [x] Add lambda tests covering asset + tag create/update validation

META fields:

- id
- ownerEmail
- type (video | audio | image)
- title
- description
- status
- original { bucket, key, size, contentType }
- createdAt
- updatedAt
- searchText

Tags:

- Controlled facets
- Freeform
- weight
- source

Done when:

- Asset + tags can be created and updated.

Execution status (2026-02-24):

- [x] Added controlled tag facet schema and stricter tag validation in `packages/contracts/src/index.ts`.
- [x] Added request schemas (`CreateAssetInputSchema`, `UpdateAssetInputSchema`) and exported types in contracts package.
- [x] Updated API lambda validation to enforce controlled facets and bounded tag weight.
- [x] Fixed PATCH behavior to recompute `searchText` when title and/or description changes.
- [x] Added Bun tests for API lambdas covering create/update and invalid tag facet scenarios.

---

## 3.4 Asset Deletes

Goal:

- Add safe, owner-scoped asset deletion across API, storage, and data records.

Endpoint:

- DELETE /assets/{id}

Planned steps:

1. API contract and route
   - Add `DELETE /assets/{id}` route in `ApiStack`.
   - Keep JWT authorizer required on delete route.
   - Extend contracts package with delete response shape.

2. Authorization and ownership guard
   - Resolve caller email from JWT claims.
   - Load asset META item and verify `ownerEmail` matches caller.
   - Return `403` for non-owner, `404` for missing asset.

3. DynamoDB delete behavior
   - Delete `ASSET#{id} / META` item.
   - Delete related items for same partition key (tags, renditions, future child items).
   - Ensure idempotent behavior (`404` when already deleted).

4. S3 object cleanup
   - Delete original object at `original.key` from originals bucket.
   - Delete derived prefix for the asset from derived bucket (for processed outputs).
   - Ignore missing object errors so retry is safe.

5. Failure handling strategy
   - Prefer data-consistent flow: mark delete intent, perform S3 cleanup, then finalize metadata delete; or document accepted eventual consistency tradeoff.
   - Add clear logs and error surfaces for partial cleanup.
   - Define retry approach for transient S3/DynamoDB failures.

6. Tests
   - Unit tests for owner delete success, non-owner `403`, missing `404`.
   - Verify related DynamoDB items are removed.
   - Verify S3 delete commands are issued for originals + derived paths.

7. Frontend integration plan
   - Add delete action on asset detail page with confirmation dialog.
   - Call server route, then redirect to library on success.
   - Show success/error toast states.

Done when:

- Owner can delete an asset end-to-end (metadata + storage artifacts).
- Non-owners cannot delete assets.
- Delete operation is safe to retry and tested.

Execution status (2026-02-25):

- [x] Added `DELETE /assets/{id}` route with JWT auth in `MediaManagerApiStack`.
- [x] Added owner check based on JWT `email` claim before delete operations.
- [x] Delete flow now removes original object, derived prefix (`derived/{assetId}/`), and all DynamoDB items under `PK=ASSET#{id}`.
- [x] Added delete response schema in contracts package and wired web server route proxy.
- [x] Added delete action with confirmation dialog on asset detail page.
- [x] Added Lambda tests for delete success and non-owner `403` behavior.

---

# Phase 4 — S3 + Upload

## 4.1 Storage Stack

Create `StorageStack`.

Buckets:

- media-originals-{env}
- media-derived-{env}

Settings:

- Block public access ON
- Versioning optional

Done when:

- Buckets deploy.

Execution status (2026-02-25):

- [x] Added `StorageStack` with S3 buckets `media-originals-<stage>` and `media-derived-<stage>` in `infra/cdk/lib/storage-stack.ts`.
- [x] Configured both buckets with block public access ON, SSE-S3 encryption, SSL-only policy, and retain-on-delete policy.
- [x] Exported bucket names as `MEDIA-ORIGINALS-BUCKET-NAME` and `MEDIA-DERIVED-BUCKET-NAME`.
- [x] Wired `MediaManagerStorageStack` in `infra/cdk/bin/cdk.ts`.
- [x] Added deploy script `deploy:storage` in `infra/cdk/package.json`.
- [x] Deployed `MediaManagerStorageStack` successfully with outputs:
  - [x] `media-originals-prod`
  - [x] `media-derived-prod`

---

## 4.2 Small File Upload (Single PUT)

Endpoint:

- POST /assets/{id}/upload-url

Tasks:

- [x] Add authenticated route `POST /assets/{id}/upload-url` in `ApiStack`
- [x] Add authenticated route `POST /assets/{id}/upload-complete` in `ApiStack`
- [x] Generate S3 pre-signed PUT URL targeting originals bucket
- [x] Return upload URL + object key to client
- [x] Confirm uploaded object exists in S3 before setting metadata status to `uploaded`
- [x] Add least-privilege IAM permission for upload signing (`s3:PutObject` on originals bucket)
- [x] Add Lambda tests covering upload URL generation path

Flow:

1. Generate pre-signed PUT
2. Client uploads directly to S3
3. Confirm object in S3 (`HEAD`) and update asset status to `uploaded`

Done when:

- Small file uploads work.

Execution status (2026-02-25):

- [x] Added upload URL route `POST /assets/{id}/upload-url` to `MediaManagerApiStack`.
- [x] Added upload confirm route `POST /assets/{id}/upload-complete` to `MediaManagerApiStack`.
- [x] Updated asset-by-id Lambda to generate signed PUT URLs using `@aws-sdk/s3-request-presigner`.
- [x] Wired originals/derived bucket env vars and S3 IAM permissions for sign, head, and cleanup operations.
- [x] Upload URL handler keeps asset in `draft` and stores upload bucket/content type.
- [x] Upload confirm handler performs `HeadObject` check and only then updates asset to `status=uploaded` with final size/content type.
- [x] Added request/response schemas for upload URL flow in `packages/contracts/src/index.ts`.
- [x] Added lambda unit test for upload URL generation and update behavior.
- [x] Deployed `MediaManagerApiStack` with new upload route.
- [x] Updated web upload client flow to call `POST /api/assets`, `POST /api/assets/{id}/upload-url`, direct browser `PUT`, then `POST /api/assets/{id}/upload-complete`.

---

## 4.3 Multipart Upload (Large Video)

Endpoints:

- POST /assets/{id}/multipart/init
- POST /assets/{id}/multipart/sign
- POST /assets/{id}/multipart/complete
- POST /assets/{id}/multipart/abort

Tasks:

- [x] Add authenticated multipart routes (`init`, `sign`, `complete`, `abort`) in `ApiStack`
- [x] Add multipart S3 flow in asset-by-id Lambda:
  - [x] init upload and return `uploadId`
  - [x] sign part upload URLs
  - [x] complete multipart upload using collected ETags
  - [x] abort multipart upload on failure/cancel
- [x] Keep status transition semantics: only mark `uploaded` after confirmed completion
- [x] Add web proxy routes for multipart operations in Next.js API
- [x] Add client multipart uploader module with 32MB chunks, 4-way concurrency, retries, ETag capture
- [x] Update upload page to use multipart flow for large videos
- [x] Add Lambda tests for multipart init/sign/complete/abort

Client module responsibilities:

- Slice file (e.g., 32MB chunks)
- Upload 4–6 parts concurrently
- Retry parts
- Capture ETags
- Complete upload

Done when:

- Multi-GB upload succeeds reliably.

Execution status (2026-02-25):

- [x] Added backend routes in `MediaManagerApiStack` for `POST /assets/{id}/multipart/init|sign|complete|abort`.
- [x] Implemented multipart handlers in `infra/cdk/lambda/api-asset-by-id/index.ts` using S3 multipart APIs.
- [x] Added contract schemas/types for multipart requests and responses in `packages/contracts/src/index.ts`.
- [x] Added Next.js API proxy endpoints under `apps/web/app/api/assets/[id]/multipart/*`.
- [x] Added browser multipart uploader utility in `apps/web/lib/multipart-upload.ts`.
- [x] Upload page now chooses multipart flow for large video files and falls back to single PUT for smaller files.
- [x] Added/updated lambda tests covering multipart lifecycle.

---

# Phase 5 — Processing (MediaConvert)

## 5.1 Event Trigger

Recommended:

- S3 ObjectCreated event
- EventBridge rule
- SQS queue
- Lambda consumer

Tasks:

- [x] Enable EventBridge notifications on originals bucket
- [x] Add EventBridge rule for S3 `Object Created` on originals bucket
- [x] Add SQS queue target for S3 object-created events
- [x] Add Lambda consumer subscribed to SQS queue
- [x] Update asset status to `processing` when upload object-created event is received
- [x] Add tests for upload-trigger event consumption path

Done when:

- Upload triggers job initiation.

Execution status (2026-02-25):

- [x] Enabled `eventBridgeEnabled` on originals bucket in `infra/cdk/lib/storage-stack.ts`.
- [x] Added `OriginalsObjectCreatedRule` (`aws.s3` + `Object Created`) in `MediaManagerProcessingStack`.
- [x] Added `UploadEventsQueue` and wired EventBridge -> SQS target.
- [x] Added `upload-trigger` Lambda (`infra/cdk/lambda/upload-trigger/index.ts`) with SQS event source.
- [x] Upload-trigger consumer now resolves `assetId` from `incoming/{assetId}` object key and updates asset status to `processing`.
- [x] Added unit tests in `infra/cdk/test/lambda/upload-trigger.test.ts`.

---

## 5.2 MediaConvert Job Template

Output ladder (AVC only):

- 1080p
- 720p
- 480p
- AAC audio
- Poster frame

Tasks:

- [x] Add upload-trigger -> MediaConvert job submission for video profile
- [x] Add flexible processing profile model (profile id on asset metadata)
- [x] Set default processing profiles by asset type:
  - [x] `video-standard-v1` (MediaConvert ladder)
  - [x] `audio-passthrough-v1`
  - [x] `image-passthrough-v1`
- [x] Add MediaConvert service role with least-privilege S3 read/write permissions
- [x] Build MediaConvert job settings for AVC ladder (1080p/720p/480p + AAC + poster)
- [x] Include MediaConvert user metadata (`assetId`) for status correlation
- [x] On MediaConvert submit failure, set asset status to `error`
- [x] Add tests for video job submission and passthrough profile behavior

No 4K output.

Outputs to:

```
derived/{assetId}/hls/master.m3u8
derived/{assetId}/thumbs/poster.jpg
```

Done when:

- HLS files appear in derived bucket.

Execution status (2026-02-25):

- [x] `upload-trigger` now submits MediaConvert jobs for `video-standard-v1` uploads.
- [x] Added profile-aware processing decision in `infra/cdk/lambda/upload-trigger/index.ts`.
- [x] Added MediaConvert role and permissions in `infra/cdk/lib/processing-stack.ts`.
- [x] Added MediaConvert SDK dependency and lambda build wiring in `infra/cdk/package.json`.
- [x] Added optional `processingProfile` to asset/create schemas for future upload-time selection.
- [x] Added unit tests in `infra/cdk/test/lambda/upload-trigger.test.ts` for video job submit and passthrough behavior.

---

## 5.3 Job Status Updates

EventBridge rule for MediaConvert status.

Tasks:

- [x] Add EventBridge rule for MediaConvert job state change events
- [x] Add Lambda consumer to process MediaConvert status updates
- [x] Map MediaConvert statuses into asset statuses (`processing`, `ready`, `error`)
- [x] Update asset META record in DynamoDB on status transitions
- [x] Store stream/rendition metadata on successful completion events
- [x] Add tests for processing and ready status update paths

Lambda:

- Update asset status:
  - processing
  - ready
  - error
- Store rendition metadata

Done when:

- Asset transitions to `ready`.

Execution status (2026-02-25):

- [x] Added `MediaManagerProcessingStack` with EventBridge rule `media-manager-mediaconvert-status`.
- [x] Added Lambda `infra/cdk/lambda/mediaconvert-status/index.ts` to handle MediaConvert state changes.
- [x] Added status mapping from MediaConvert events:
  - [x] `SUBMITTED`/`PROGRESSING`/`STATUS_UPDATE`/`INPUT_INFORMATION` -> `processing`
  - [x] `COMPLETE` -> `ready`
  - [x] `ERROR`/`CANCELED` -> `error`
- [x] On `COMPLETE`, store `stream.hlsMasterUrl`, `stream.posterUrl`, and rendition metadata from output details.
- [x] Added unit tests in `infra/cdk/test/lambda/mediaconvert-status.test.ts`.

---

# Phase 6 — Streaming

## 6.1 CloudFront

Create distribution:

- Origin: derived bucket
- OAC enabled
- Private S3 bucket

Output:

- CLOUDFRONT_DOMAIN

Tasks:

- [x] Add `StreamingStack` with CloudFront distribution for derived bucket origin
- [x] Configure Origin Access Control (OAC) for S3 origin
- [x] Keep derived bucket private and allow CloudFront service principal `s3:GetObject`
- [x] Export CloudFront domain output for downstream playback integration
- [x] Add deploy script for streaming stack

Done when:

- HLS accessible via CloudFront.

Execution status (2026-02-26):

- [x] Added `infra/cdk/lib/streaming-stack.ts` and wired `MediaManagerStreamingStack` in `infra/cdk/bin/cdk.ts`.
- [x] Created CloudFront distribution with derived-bucket origin and OAC.
- [x] Added derived bucket policy statement allowing only CloudFront distribution reads.
- [x] Exported CloudFront domain as `CLOUDFRONT-DOMAIN` (CloudFormation exports do not allow underscores).
- [x] Added deploy script `deploy:streaming` in `infra/cdk/package.json`.
- [x] Deployed `MediaManagerStreamingStack` successfully.
- [x] Current CloudFront domain output: `d1rudtwricc3v3.cloudfront.net`.

---

## 6.2 Playback

In Next.js:

- Use hls.js for video
- Use CloudFront URLs
- Use poster image
- Add fallback UI

Tasks:

- [x] Add CloudFront URL wiring for stream outputs in processing status Lambda
- [x] Add HLS player component for asset detail page using `hls.js`
- [x] Use native HLS when available (Safari) and `hls.js` fallback for other browsers
- [x] Render poster image in video player
- [x] Add non-ready fallback UI states during conversion
- [x] Add signed playback URL endpoint for original object fallback
- [x] Add audio player and image preview support in `AssetPlayer`

Done when:

- Video plays in browser.

Execution status (2026-02-26):

- [x] `mediaconvert-status` now emits CloudFront-based stream URLs when `CLOUDFRONT_DOMAIN` is configured.
- [x] Added `AssetPlayer` component in `apps/web/components/asset-player.tsx`.
- [x] Wired player into asset detail page section in `apps/web/components/asset-detail-editor.tsx`.
- [x] Added player fallback messaging for non-ready video/audio/image assets.
- [x] Updated processing stack to inject CloudFront domain env var into status Lambda.
- [x] Added backend route `GET /assets/{id}/playback-url` for signed original-object playback URLs.
- [x] `AssetPlayer` now renders:
  - [x] HLS video player (CloudFront stream URL)
  - [x] audio player (`<audio>` with signed playback URL)
  - [x] image preview (`<img>` with signed playback URL)

---

# Phase 7 — Tagging + Search

## 7.1 Tagging UI

Implement:

- Facet selectors (mood, energy, etc.)
- Freeform tag input
- Chips display
- Save via API

Done when:

- Tags persist and render correctly.

---

## 7.2 searchText Generation

Server-side:

```
searchText = title + description + all tags + metadata
```

Store in META record.

Done when:

- searchText updates on edits.

---

## 7.3 Basic Filtering

Implement:

- Filter by type
- Filter by facet tag
- Sort newest

Done when:

- Library filters correctly.

---

# Phase 8 — Security + Observability

## 8.1 Security Checks

- [ ] Buckets private
- [ ] Only CloudFront reads derived
- [ ] Only API issues pre-signed URLs
- [ ] JWT required for API
- [ ] Email allow-list enforced in Lambda

---

## 8.2 Logging + Alerts

- [ ] CloudWatch logs enabled
- [ ] DLQ for SQS
- [ ] Budget alert in AWS console

---

# Phase 9 — Future LLM Readiness (Do Not Implement Yet)

Ensure each asset has:

- Stable ID
- searchText
- Structured facet tags
- Freeform tags

Future:

- Generate embeddings from searchText
- Store in vector DB
- Retrieve topK
- Stochastic selection from topK

---

# Milestones

### Milestone 1

- Status: [x] Completed
- Auth works
- Small file upload works
- Asset record persists
- Library page lists assets

### Milestone 2

- Status: [x] Completed
- Multipart upload works
- MediaConvert generates HLS
- CloudFront streams
- Asset detail plays video

### Milestone 3 (Phase 7)

- Tagging UI supports facet + freeform tags
- Tag edits persist through API and render on asset detail
- `searchText` is generated/updated server-side from metadata + tags
- Library supports basic type/facet filtering and newest-first sorting

### Milestone 4 (Phase 8)

- Bucket and origin access policies are validated for private storage + CloudFront-only derived reads
- API access is JWT-protected and pre-signed URL issuance is limited to API flows
- CloudWatch logging, SQS failure handling (DLQ), and baseline alerting are in place
- Auth allowlist enforcement is verified end-to-end

### Milestone 5 (Phase 9 Readiness)

- Asset schema guarantees stable IDs, structured facet tags, freeform tags, and maintained `searchText`
- Data contracts are ready for embedding generation pipeline inputs (without enabling embeddings yet)
- Metadata quality and indexing shape are documented for future vector retrieval integration

---

# Cost Expectations (Your Scale)

- Conversion: ~$12 one-time
- Storage: ~$2–3/month
- Streaming: Likely $0/month (under 1TB free tier)

---

End of PLAN.
