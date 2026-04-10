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

Execution status (2026-02-27):

- [x] Added facet selector + weight selector controls in asset detail edit mode.
- [x] Added freeform tag input with Enter-to-add support.
- [x] Added tag chips display for both read mode and edit mode.
- [x] Wired tag edits to `PATCH /api/assets/{id}` save flow.

Done when:

- Tags persist and render correctly.

---

## 7.2 searchText Generation

Server-side:

```
searchText = title + description + all tags + metadata
```

Store in META record.

Execution status (2026-02-27):

- [x] Added server-side `searchText` composition on asset create using title + description + tags + key metadata.
- [x] Updated PATCH flow to recompute `searchText` when tags, title, or description change.
- [x] Included metadata terms in `searchText` generation (`type`, `processingProfile`, `original.contentType` when present).
- [x] Added/updated lambda tests to verify `searchText` generation and update behavior.

Done when:

- searchText updates on edits.

---

## 7.3 Basic Filtering

Implement:

- Filter by type
- Filter by facet tag
- Sort newest

Execution status (2026-02-27):

- [x] Added API support for list query filters (`type`, `facet`) and sort (`newest`, `oldest`) in assets lambda.
- [x] Added query validation for list filters in both app API proxy and infra lambda handlers.
- [x] Updated library page with filter UI controls for type/facet and sort selection.
- [x] Wired library page to request filtered/sorted assets from API.
- [x] Added lambda tests for type/facet filter behavior and invalid query handling.

Done when:

- Library filters correctly.

---

# Phase 8 — Security + Observability

## 8.1 Security Checks

- [x] Buckets private
- [x] Only CloudFront reads derived
- [x] Only API issues pre-signed URLs
- [x] JWT required for API
- [x] Email allow-list enforced in Lambda

Execution status (2026-02-27):

- [x] Added stack-level security tests in `infra/cdk/test/stacks/security.test.ts`.
- [x] Verified S3 buckets use block public access settings.
- [x] Verified derived bucket policy only grants `s3:GetObject` to CloudFront service principal with `AWS:SourceArn` condition.
- [x] Verified all `/assets` API routes (including upload/multipart/playback endpoints) require JWT authorization.
- [x] Verified Cognito pre-token generation trigger and DynamoDB allowlist lookup policy remain configured.

---

## 8.2 Logging + Alerts

- [x] CloudWatch logs enabled
- [x] DLQ for SQS
- [x] Budget alert in AWS console

Execution status (2026-02-27):

- [x] Added CloudWatch retention-managed log groups for auth/api/processing Lambdas.
- [x] Added API Gateway HTTP API access logs on the `$default` stage.
- [x] Added SQS dead-letter queue wiring for upload event processing queue.
- [x] Added `MediaManagerObservabilityStack` with monthly AWS budget notification resource.
- [x] Added stack assertion tests in `infra/cdk/test/stacks/observability.test.ts`.

---

# Phase 9 — Data Type Readiness (Do Not Implement Yet)

Goal:

- Make asset contracts ready for upcoming data model expansions without enabling AI runtime features yet.

Readiness baseline:

- Stable ID for each asset
- Maintained `searchText`
- Structured facet tags
- Freeform tags

## 9.1 Nested Media Structure (Planned)

Goal:

- Support hierarchy/lineage relationships between assets (folders/containers and derived-from links).

Planned tasks:

- [x] Extend asset schema/contracts with hierarchy + lineage fields (`containerId`, `parentId`, `rootId`, `sourceAssetIds`).
- [x] Add API endpoints for hierarchy operations (`move`, `list children`, lineage traversal).
- [x] Add server-side validation to prevent cycles and invalid cross-owner references.
- [x] Add library UI support for nested browsing and lineage context.

Execution status (2026-02-28):

- [x] Added nested + lineage contract fields and responses in `packages/contracts/src/index.ts`.
- [x] Added API endpoints `GET /assets/{id}/children`, `GET /assets/{id}/lineage`, `POST /assets/{id}/move`.
- [x] Added create/move validation for cross-owner references and cycle-prevention on moves.
- [x] Added library nested browsing controls (`containerId`) and lineage context on asset detail.

Backend scalability follow-up (next step for 9.1):

- [x] Add first-class folder items in contracts (`assetKind` or equivalent) so containers are explicit entities, not inferred media items.
- [x] Add a container-focused GSI in `DataStack` for direct child queries (for example `gsi2pk=CONTAINER#<id|ROOT>`, sortable `gsi2sk`).
- [x] Update create/move write paths to persist container index keys (`gsi2pk/gsi2sk`) alongside metadata.
- [x] Switch nested list/children APIs to query the new GSI directly (remove created-at index + in-memory filtering).
- [ ] Add cursor pagination to children/list endpoints (`nextToken` style) to avoid fixed-size result caps.
- [ ] Add optional root/subtree index strategy if descendant queries are needed (`rootId` + depth aware key).
- [x] Update tests for GSI-backed child queries and pagination behavior.

Folder entity status (2026-03-03):

- [x] Added `folder` as a first-class asset type in contracts.
- [x] Updated create flow so folders can be created without file uploads.
- [x] Updated frontend upload/create UI to support folder creation.
- [x] Blocked upload/playback endpoints for folder assets.

Implementation note:

- We can skip compatibility/backfill for old items and require fresh writes for nested data correctness.
- Existing records without new index keys can be removed manually during rollout.

## Phase 9 Release Gate (Before 9.3/9.4)

- [ ] Complete 9.2 schema + API readiness for AI-generated media fields first.
- [ ] Keep basic media upload/playback stable for video + audio assets.
- [ ] Add a lightweight client integration test app/page that loads video and audio at the same time from uploaded assets.
- [ ] Verify simultaneous playback behavior end-to-end (API -> storage/streaming -> browser playback) and document known limitations.

## 9.2 AI-Generated Media Data Fields (Planned)

Goal:

- Extend schema/contracts so generated media can be ingested as first-class assets with full provenance.

Planned tasks:

- [x] Add provenance fields (`origin`, `model`, `provider`, `workflowId`, `promptHash`, `seed`, `createdBy`).
- [x] Extend write-path contracts/validation for generated vs uploaded source metadata.
- [x] Ensure `searchText` and provenance fields remain consistent on create/update flows.
- [x] Add UI indicators and filtering for uploaded vs generated assets.

Execution status (2026-03-09):

- [x] Added origin and generation provenance schema fields in contracts.
- [x] Added create-input validation for provenance variance (`generated` requires `generation`, `derived` requires `sourceAssetIds`, folder uses `manual`).
- [x] Updated create/patch search text generation to include provenance terms.
- [x] Added API/list filtering by `origin` and surfaced origin indicators/filters in library UI.
- [x] Added tests covering provenance acceptance/rejection and list filtering behavior.

Done when:

- Generated assets are clearly distinguishable from uploaded assets in both API and UI.
- Generated provenance metadata is present, validated, and searchable.

## 9.3 Saved Combo Entity + Voting (Planned)

Goal:

- Represent video+audio pairings as first-class saved entities and support user voting on those entities.

Data model tasks:

- [x] Add `combo` entity schema with stable ID and ownership metadata.
- [x] Store `videoAssetId` + `audioAssetId` references and optional playback parameters (offsets/gain/trim).
- [x] Add aggregate vote fields and per-user vote records to prevent duplicate votes.

API tasks:

- [x] Create combo CRUD/list endpoints (create, read, list by owner/folder, delete).
- [x] Add vote endpoints (`upvote`, `downvote`, `clear vote`) with idempotent behavior.
- [x] Add authorization checks so only owner-accessible media can be paired.
- [x] Support ad-hoc video+audio preview without pre-creating combo records; first vote lazily creates combo entity.

UI tasks:

- [x] Add combo detail/player view that loads video + audio together.
- [x] Add voting controls bound to saved combo entity IDs.
- [x] Add combo cards/list view with score and playback metadata.

Execution status (2026-03-09):

- [x] Added combo contracts and vote payload schemas in shared contracts package.
- [x] Added `api-combos` lambda with combo CRUD/list and idempotent vote transitions.
- [x] Added API routes for combos (`/combos`, `/combos/{id}`, `/combos/{id}/vote`) with JWT auth.
- [x] Added web API proxy handlers and frontend combo pages (`/combos`, `/combo/{id}`) with synchronized player + voting controls.
- [x] Added tests for combo schema payloads, combo lambda behavior, and JWT route coverage.

Done when:

- A saved combo can be created from existing uploaded media and replayed reliably.
- Votes persist and aggregate correctly with per-user vote constraints.

## 9.4 English Search for Video+Audio Combinations (Planned)

Goal:

- Let users find saved combos using natural English queries.

Planned tasks:

- [ ] Build combo `searchText` from video/audio titles, descriptions, tags, and combo notes.
- [ ] Add API query endpoint for combo text search with deterministic filtering/sorting first.
- [ ] Add semantic retrieval extension point (embedding-ready contract) for future ranking improvements.

Done when:

- Users can search with plain English phrases and retrieve relevant saved combos.

---

# Phase 10 — Frontend Combo App (Next.js)

## Public Combo Query Rules (DarenKeck Site)

Decisions:

- Combos are always public (no combo-level visibility toggle).
- A combo is eligible for public playback only when both referenced assets are public.
- Public combo query must return a valid video+audio pair that is present and playable.

Implementation notes:

- Add/maintain asset-level `visibility` (`private` or `public`) in contracts and write paths.
- Public random combo endpoint must filter for:
  - `video` asset: `status=ready`, `visibility=public`
  - `audio` asset: `status=ready`, `visibility=public`
- Public endpoint should return playback-ready sources for both tracks.

### Public Random Selection Strategy (Planned)

Goal:

- On each homepage load, give equal probability to two sources: existing saved public combos and derived random public video+audio pairs.

Selection policy:

- Use source-first randomization: flip a fair coin on every request.
- If heads, attempt `derived` first; if tails, attempt `existing` first.
- If the primary source has no valid candidate, fallback to the secondary source.
- Return `404` only when both sources fail.

API behavior (`GET /public/combos/random`):

- Keep a single public endpoint for darenkeck page load.
- Return a unified payload with existing fields plus:
  - `source`: `"derived" | "existing"`
  - `selection`: `"primary" | "fallback"`
- Preserve existing playback contract (`videoSrc`, `audioSrc`, titles, asset IDs, combo ID).

Lambda implementation tasks:

- [ ] Split candidate lookup into two helpers:
  - [ ] `pickExistingPublicComboCandidate(tableName, bucketName)`
  - [ ] `pickDerivedPublicPairCandidate(tableName, bucketName)`
- [ ] Add a small coordinator `pickRandomPublicComboCandidate()` implementing coin-flip + fallback flow.
- [ ] Ensure `existing` candidates validate referenced assets are still `public` + `ready` before return.
- [ ] Keep all candidate resolution strict: if either playback URL fails, continue searching.
- [ ] Add structured logs per request: `primarySource`, `servedSource`, `selection`, `fallbackUsed`, `statusCode`.

Data access tasks:

- [x] Near-term: allow `dynamodb:Scan` for combos lambda for candidate discovery.
- [ ] Near-term: cap scan page count/limit for bounded latency and cost.
- [ ] Follow-up: add a public-combo index (or projection records) to remove full-table scans.
- [ ] TODO: replace scan-based public candidate discovery with queryable index-backed reads (`Query` over `Scan`).

IAM tasks:

- [x] Update `infra/cdk/lib/api-stack.ts` policy for `CombosFunction` to include required scan permission.
- [x] Prefer least privilege: add dedicated `dynamodb:Scan` statement only for resources used by public-random query.

Testing tasks:

- [ ] Unit tests: primary source success for `derived` and `existing` paths.
- [ ] Unit tests: fallback from `derived -> existing` and `existing -> derived`.
- [ ] Unit tests: both sources empty returns `404`.
- [ ] Unit tests: invalid/now-private assets in existing combos are skipped.
- [ ] Unit tests: response payload includes `source` and `selection`.

Observability and verification:

- [ ] Confirm Lambda logs show both source types over repeated requests.
- [ ] Add temporary dashboard/query for:
  - [ ] `% primarySource=derived`
  - [ ] `% primarySource=existing`
  - [ ] `% servedSource=derived|existing`
  - [ ] `% fallbackUsed=true`
- [ ] Verify homepage still renders fallback gradient when endpoint returns `404` or `500`.

Rollout plan:

- [ ] Deploy IAM + lambda changes to dev first.
- [ ] Validate endpoint by direct curl and through `apps/darenkeck` page load.
- [ ] Promote to prod after confirming source split and acceptable latency/cost.

Nice-to-have follow-up (separate change):

- [ ] Decide whether selected derived pairs should be materialized as persistent combo records.
- [ ] If yes, define ownership model for system-created/public combos and update contracts/routes accordingly.

Goal:

- Implement a dedicated frontend flow for requesting/playing video+audio combinations, with a reusable `ComboPlayer` architecture that can later support effects and voting.

Framework:

- Next.js remains the frontend framework.

## 10.1 ComboPlayer Core (Planned)

Responsibilities:

- Synchronize video + audio streaming timelines.
- Synchronize user playback input across both tracks (play/pause/seek/rate).
- Expose a future extension point for playback effects.

Planned tasks:

- [ ] Add `ComboPlayer` container component with load/ready/error playback states.
- [ ] Implement media sync engine with video as timing authority and audio drift correction.
- [ ] Implement source management for stream loading/fallback handling per track.
- [ ] Add shared playback state contract for controls and future voting/analytics hooks.

Done when:

- Video and audio play in sync through seeks, pauses, and resumes.
- Sync recovery works after buffering stalls and visibility/tab changes.

## 10.2 Frontend Combo UI (Planned)

Planned tasks:

- [ ] Add combo-focused page/workflow in Next.js app for selecting and previewing video+audio pairs.
- [ ] Add `ComboControls` UI (play/pause, scrub, rate, volume/mute).
- [ ] Add basic accessibility + keyboard behavior for combo playback controls.
- [ ] Add clear loading/error UX for partial or failed track loads.

Done when:

- User can open a combo view and reliably control synchronized playback.

## 10.3 Effects Extension Point (Planned)

Planned tasks:

- [ ] Define `EffectsPipeline` interface (`attach`, `setEffects`, `detach`) with no-op implementation.
- [ ] Add initial simple effect hooks (playback rate + basic color filter configuration surface).
- [ ] Ensure effects integration does not break base sync behavior.

Done when:

- Effects can be toggled/configured without destabilizing synchronized playback.

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
- Contract versioning/migration approach is defined for nested and generated media metadata
- Data model baseline is ready for future retrieval/AI layers (without enabling them yet)

### Milestone 6 (Phase 9.1 Nested Media)

- Status: [x] Completed
- Hierarchy + lineage fields are added to contracts and persisted in metadata records
- API supports child listing, move operations, and lineage traversal with cycle safeguards
- Library UX supports nested navigation and relationship context

### Milestone 7 (Phase 9.2 AI-Generated Media)

- Status: [x] Completed
- Generated-media fields are represented in contracts with clear provenance semantics
- Validation rules enforce consistent source/provenance metadata on write paths
- UI clearly distinguishes uploaded, derived, and generated assets

### Milestone 8 (Phase 9.3 Saved Combo Entity + Voting)

- Status: [x] Completed
- Saved combo entity exists for video+audio pairings with stable IDs
- Combo playback supports synchronized video+audio loading in client app
- Voting APIs/UI persist and reflect per-user votes and aggregate scores

### Milestone 9 (Phase 9.4 English Combo Search)

- Combo-level search text is generated and maintained
- English query endpoint returns relevant saved combos
- Semantic ranking extension point is documented and contract-ready

---

# Cost Expectations (Your Scale)

- Conversion: ~$12 one-time
- Storage: ~$2–3/month
- Streaming: Likely $0/month (under 1TB free tier)

---

End of PLAN.
