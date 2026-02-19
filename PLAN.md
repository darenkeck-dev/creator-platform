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

- [ ] Configure AWS CLI profile
- [ ] Choose region
- [ ] Verify:

```
aws sts get-caller-identity
```

Done when:

- CLI returns account identity.

---

## 1.2 CDK Initialization

In `infra/cdk`:

Tasks:

- [ ] Initialize CDK (TypeScript)
- [ ] Bootstrap environment:

```
bunx cdk bootstrap aws://ACCOUNT_ID/REGION
```

Done when:

- `bunx cdk synth` runs successfully.

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

- [ ] Create Google OAuth app
- [ ] Configure redirect URIs
- [ ] Add Google IdP to Cognito
- [ ] Store Google client secret securely

Done when:

- Hosted UI login works.

---

## 2.3 Next.js Login Flow

Tasks:

- [ ] Redirect to Cognito Hosted UI
- [ ] Handle callback route
- [ ] Store JWT securely (httpOnly cookie)
- [ ] Protect `/library` and `/upload`

Done when:

- Unauthenticated users are redirected.
- Login returns to protected page.

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
```

Include GSI for listing by created date.

Done when:

- Can insert and read dummy asset record.

---

## 3.2 API Stack

Create `ApiStack`.

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

---

## 3.3 Asset Schema

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

---

## 4.2 Small File Upload (Single PUT)

Endpoint:

- POST /assets/{id}/upload-url

Flow:

1. Generate pre-signed PUT
2. Client uploads directly to S3
3. Update asset status to `uploaded`

Done when:

- Small file uploads work.

---

## 4.3 Multipart Upload (Large Video)

Endpoints:

- POST /assets/{id}/multipart/init
- POST /assets/{id}/multipart/sign
- POST /assets/{id}/multipart/complete
- POST /assets/{id}/multipart/abort

Client module responsibilities:

- Slice file (e.g., 32MB chunks)
- Upload 4–6 parts concurrently
- Retry parts
- Capture ETags
- Complete upload

Done when:

- Multi-GB upload succeeds reliably.

---

# Phase 5 — Processing (MediaConvert)

## 5.1 Event Trigger

Recommended:

- S3 ObjectCreated event
- EventBridge rule
- SQS queue
- Lambda consumer

Done when:

- Upload triggers job initiation.

---

## 5.2 MediaConvert Job Template

Output ladder (AVC only):

- 1080p
- 720p
- 480p
- AAC audio
- Poster frame

No 4K output.

Outputs to:

```
derived/{assetId}/hls/master.m3u8
derived/{assetId}/thumbs/poster.jpg
```

Done when:

- HLS files appear in derived bucket.

---

## 5.3 Job Status Updates

EventBridge rule for MediaConvert status.

Lambda:

- Update asset status:
  - processing
  - ready
  - error
- Store rendition metadata

Done when:

- Asset transitions to `ready`.

---

# Phase 6 — Streaming

## 6.1 CloudFront

Create distribution:

- Origin: derived bucket
- OAC enabled
- Private S3 bucket

Output:

- CLOUDFRONT_DOMAIN

Done when:

- HLS accessible via CloudFront.

---

## 6.2 Playback

In Next.js:

- Use hls.js for video
- Use CloudFront URLs
- Use poster image
- Add fallback UI

Done when:

- Video plays in browser.

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
- Auth works
- Small file upload works
- Asset record persists
- Library page lists assets

### Milestone 2
- Multipart upload works
- MediaConvert generates HLS
- CloudFront streams
- Asset detail plays video

---

# Cost Expectations (Your Scale)

- Conversion: ~$12 one-time
- Storage: ~$2–3/month
- Streaming: Likely $0/month (under 1TB free tier)

---

End of PLAN.
