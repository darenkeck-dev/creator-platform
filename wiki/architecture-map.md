# Architecture Map

## Layers

- **Frontend apps**
  - `apps/web`: authenticated media manager UI (upload/library/asset/combo admin).
  - `apps/darenkeck`: public personal site using React Router, with random combo playback at `/`, a Markdown-backed resume at `/dev`, and an explicit not-found route.
- **Shared packages**
  - `packages/contracts`: shared schemas/types for API payloads and records.
- `packages/shared`: shared playback/review components (`ComboPlayer`, `ComboToneReviewPlayer`) and playback utilities.
  - `packages/tone-core`: TypeScript tone schemas, OpenAI analysis helpers, ffmpeg frame extraction, combo scoring, and nearest-neighbor utilities for Lambda-native tone processing.
- **Infra**
  - `infra/cdk`: stacks + lambda handlers for auth, api, processing, storage, streaming, vectors, observability, darenkeck site.

## Data and media flow

1. Create asset metadata via API.
2. Upload original media to originals S3 bucket.
3. Confirm upload -> asset status `uploaded`.
4. Originals S3 object-created events enter the shared processing eventing pattern: EventBridge routes the upload event to per-workflow SQS queues.
5. The media conversion queue feeds `upload-trigger`, which resolves profile:
   - video: MediaConvert ladder
   - audio: MediaConvert audio HLS transcode
   - image/folder/passthrough profiles as configured
6. MediaConvert status lambda updates `stream` metadata + `ready/error`.
7. The tone-analysis queue feeds `tone-analysis`, which independently analyzes original audio/video assets with the OpenAI primary tone pipeline and writes artifacts under `derived/<assetId>/tone/`.
8. Node lambdas append public-safe asset lifecycle entries to `asset.auditLog` through `infra/cdk/lambda/shared/asset-audit-log.ts`.
9. The dedicated Review UI submits human keywords for audio, video, or combo targets through `POST /tone-reviews`; the API validates ownership, derives audio/video score vectors from versioned keyword mappings, ignores client score input, and stores review records in DynamoDB. `GET /tone-reviews` reads the review-source GSI for global review lists, or directly queries a target partition when `targetType` and `targetId` are provided.
10. After an audio/video curator review, the API queries that target's curator reviews and materializes a versioned OpenAI-plus-curator weighted mean on the asset. The tone worker repeats this rebuild after OpenAI reanalysis; combo reviews remain isolated from source assets.
11. Generic asset jobs use API-created job records plus an SQS-fed processing worker; `delete_assets` recursively expands selected folders via the container GSI and deletes deepest children first, while tone/conversion reprocess jobs queue existing processing workers.
12. Playback APIs return stream URLs (`hlsMasterUrl` preferred).
13. The MVP vector foundation uses one retained S3 Vectors bucket and a 10-dimensional Euclidean `asset-tone-v1` index. Future synchronization overlays sparse curator adjustments on model scores and writes the result in the canonical `asset-tone-vector/v1` order; DynamoDB remains authoritative and no combination vectors are persisted.

Eventing note: EventBridge is the common router. Separate SQS queues keep conversion and tone analysis operationally isolated so tone retries/backlogs do not delay playback processing.

Job note: generic jobs are intended to cover long-running folder-wide actions such as recursive delete and future tone reprocessing. The web app creates/monitors jobs through same-origin Next API proxy routes, while backend execution happens in Lambda workers.

See also: [Current State](current-state.md), [Recent Changes](recent-changes.md).

## Public combo path

- Endpoint: `GET /public/combos/random`
- Candidate sources:
  - derived random public video+audio pair
  - existing saved public combo
- Optional query hint:
  - `previousAudioAssetId` (or alias `previousTrack`)
- Behavior:
  - avoids returning same audio track as previous when possible
  - same video track is acceptable

## Public developer profile

- Route: `/dev`
- `apps/darenkeck/src/main.tsx` defines the public route table with React Router. Current routes are `/`, `/dev`, and `*`.
- CloudFront's existing `403/404 -> /index.html` fallback supports direct requests to the static SPA route.
- The route lazy-loads `DevPage`, which imports fetched `content/resume.md` as a Vite raw asset and renders it with `react-markdown`, `remark-gfm`, and `remark-frontmatter`.
- YAML frontmatter is recognized and omitted from the document output. Resume headings, lists, links, and typography are mapped to styled React components.
- A print media stylesheet converts the dark web presentation to a compact white, black-text US Letter layout. Playwright prints `/dev` through a temporary Vite development server to `public/daren-keck-resume.pdf`; Vite then copies it into `dist`, and the page exposes it through a Download PDF action.
- The homepage links to the developer profile, and the route is included in `public/sitemap.xml`.

## Planned public content pipeline

- Content source: a separate `darenkeck-content` repository containing Markdown files edited through Pages CMS.
- Initial content includes general news plus developer news, resume, and project/profile material.
- `/dev` currently serves the resume. Intended collection routes include `/news`, `/news/:slug`, `/dev/news`, and `/dev/news/:slug`; final file-to-route conventions remain to be defined.
- `scripts/fetch-darenkeck-content.sh` shallow-fetches `main` by default before darenkeck staging/prod builds, validates `content/`, `media/`, and non-empty `content/resume.md`, and records the resolved commit in `apps/darenkeck/.generated-content/REVISION`.
- Fetched Markdown is stored under the gitignored `apps/darenkeck/.generated-content/content/`; media is copied to the gitignored `apps/darenkeck/public/media/` for Vite deployment.
- `DARENKECK_CONTENT_REPO` and `DARENKECK_CONTENT_REF` override the private SSH repository and `main` defaults. Local access uses existing Git credentials; future CI requires read-only repository credentials.
- Collection indexing and frontmatter metadata extraction remain pending. Use MDX only if content later needs embedded interactive React components.
- The first version remains a client-rendered SPA. Static generation/prerendering and broader SEO work are deferred.

## Deployment model

- API/processing/vectors: CDK stacks via root scripts (`deploy:api`, `deploy:processing`, `deploy:vectors`).
- Darenkeck infra: `deploy:darenkeck-site` (CloudFront/S3 config).
- Darenkeck static assets: `deploy:darenkeck:prod` or staging variant.

Details: [Deploy and Ops](deploy-and-ops.md).

## Auth/session behavior

- `apps/web` stores a Cognito JWT in the `mm_auth_token` HTTP-only cookie after Hosted UI callback.
- Middleware protects authenticated app routes and same-origin `/api` proxy routes, clears missing/expired auth cookies, redirects page requests to `/login?error=expired&next=...`, and returns JSON `401` for API requests.
- The Cognito web client is configured with 12-hour ID/access token validity; silent refresh is not implemented because the web app does not persist a refresh token.

## Review navigation

- `/review` remains the capture surface. It defaults to random combos, supports `targetType=combo|audio|video`, and shows only reviews for the currently loaded target.
- Audio/video asset detail pages are read-only review-history surfaces. Their Review actions deep-link with `assetId` so `/review` loads that exact asset instead of selecting a random target.
- Combo capture uses `packages/shared` `ComboToneReviewPlayer`; app-specific loaders own target selection, review history, and submit callbacks.
- Review capture starts with no selected keywords and has no score sliders. Audio/video review scores are derived server-side from selected keywords; source model values are not copied into review submissions.
- Keyword capture shows five leaf keywords at a time. The initial set is target-seeded random; each `>` advances to a new set using the latest selected keyword as an anchor, preferring three taxonomy-adjacent leaves plus two random exploration leaves. Selected keywords remain removable from the bottom chip row.
- `darenkeck.com` can reuse the shared combo review surface, but anonymous public review writes require a separate public submission endpoint from the authenticated Media Manager `POST /tone-reviews` path.
- `/combos` is the all-combo-review index. It lists combo review records and links each record back to `/review?targetType=combo&comboId=...`, including source asset ids when available for synthetic/random combos.
