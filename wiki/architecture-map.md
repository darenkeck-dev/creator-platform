# Architecture Map

## Layers

- **Frontend apps**
  - `apps/web`: authenticated media manager UI (upload/library/asset/combo admin).
  - `apps/darenkeck`: public personal site using React Router, with random combo playback at `/`, a Markdown-backed resume at `/dev`, and an explicit not-found route.
- **Shared packages**
  - `packages/contracts`: shared schemas/types for API payloads and records.
  - `packages/shared`: shared playback/review/explorer React components (`ComboPlayer`, `ComboToneReviewPlayer`, `ToneWordPicker`) and playback utilities.
  - `packages/tone-core`: TypeScript tone schemas, shared tone-word suggestion/query logic, OpenAI analysis helpers, ffmpeg frame extraction, combo scoring, and nearest-neighbor utilities for Lambda-native tone processing.
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
13. The MVP vector foundation uses one retained S3 Vectors bucket and a 10-dimensional Euclidean `asset-tone-v1` index behind the provider-neutral `AssetToneVectorIndex` boundary. Asset, processing, tone-analysis, curator-review, and deletion mutations enqueue only `{assetId}`, while the Assets DynamoDB Stream provides durable mutation/delete capture. The vector worker rereads DynamoDB and converges the index to the current eligibility state. Sparse curator adjustments overlay model scores in canonical `asset-tone-vector/v1` order, sync state is recorded on the asset, DynamoDB remains authoritative, and no combination vectors are persisted.
14. The implemented `ComboTonePredictor` boundary computes combo tone on demand from current effective audio/video vectors. `combo-tone-predictor/v0` is deterministic (`0.60 * audio + 0.40 * video`); a future learned residual may use server-derived sparse combo labels and review-time source snapshots without introducing a combo-vector index. Sparse labels are training evidence for reviewed dimensions, not persisted predicted combo vectors.
15. The deployed walking backend uses `POST /public/combos/select` with explicit `mode="walk"`. S3 Vectors performs filtered Euclidean retrieval of audio/video source candidates; the application forms pairs, predicts transient 10-dimensional combo tones, and ranks them with exact squared Euclidean distance. Retrieval is capped at 100 eligible sources per type with no source-distance cutoff; the nearest five are sampled with weight `1 / (1 + distance)`. Vector queries abort after four seconds so the 15-second Lambda retains time for random fallback.
16. The same endpoint supports `mode="search"`. Shared picker words map to a sparse taxonomy-v2 query; direct typed retrieval is supplemented by target-conditioned queries from three audio and three video anchors, then transient predicted combo tones are reranked by exact squared distance over requested dimensions only. Search establishes a new walk anchor while retaining bounded prior history.
17. The Darenkeck homepage keeps one `SlotManager` as playback authority. Its curiosity-gated tone explorer submits selected words as a one-shot search, continues through bounded nearby walks, and uses the legacy random endpoint for both immediate and automatic transitions when no words are submitted.
18. Public random and selection responses optionally expose the complete predicted combo tone when both source assets have eligible taxonomy-v2 vectors. Darenkeck carries that object through `SlotManager` and maps signed values around a neutral-radius polar wheel; no vector data is persisted on the client.

Eventing note: EventBridge is the common router. Separate SQS queues keep conversion and tone analysis operationally isolated so tone retries/backlogs do not delay playback processing.

Job note: generic jobs are intended to cover long-running folder-wide actions such as recursive delete and future tone reprocessing. The web app creates/monitors jobs through same-origin Next API proxy routes, while backend execution happens in Lambda workers.

See also: [Upload Processing Flow](upload-processing-flow.md), [Current Walk Algorithm](walk-algorithm.md), [Current State](current-state.md), [Recent Changes](recent-changes.md).

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

Deployed controlled walk path:

- Endpoint: `POST /public/combos/select`
- Request modes: `mode="search"` for a new combined tone-word target and `mode="walk"` for continuation.
- Current audio and video are always excluded from walks.
- Client history retains five recent combo IDs plus three recent audio and video IDs.
- The endpoint returns versioned selection metadata and may resolve to a random fallback.
- Random and controlled responses include `predictedTone` when both selected source vectors can be rebuilt from authoritative asset records.
- Fallback relaxes recent combo history first and recent source history second, while always prohibiting both current sources.
- The legacy random endpoint remains the initialization and operational fallback during rollout.

Media Manager controlled explorer:

- `/combos` retains the existing combo-review index below a client-side explorer.
- The explorer reuses `packages/shared` tone-word and playback UI, proxies selection through authenticated same-origin `/api/public/combos/select`, and shows requested/resolved mode, distance, predictor, fallback, and bounded-history diagnostics.
- Playback completion walks automatically by default; manual walking and keyboard play/pause remain available.

Darenkeck homepage explorer:

- A safe-area curiosity control opens a one-time locally acknowledged explainer before revealing the shared adaptive picker.
- Opening the explorer temporarily collapses the bulletin; closing it restores the prior bulletin state.
- Selected words use the shared review-style submit pile. Submit remains available with no words, which switches playback to a fully random sequence.
- `App` is the persistent React Router layout for `/` and `/dev`; it owns the fixed player, slot manager, mute state, picker state, and random/search/walk journey while child route content changes through an outlet.

## Public developer profile

- Route: `/dev`
- `apps/darenkeck/src/main.tsx` nests `/` and lazy `/dev` under the persistent `App` experience layout; `*` remains outside it.
- CloudFront's existing `403/404 -> /index.html` fallback supports direct requests to the static SPA route.
- The route lazy-loads `DevPage`, which imports fetched `content/resume.md` as a Vite raw asset and renders it with `react-markdown`, `remark-gfm`, and `remark-frontmatter`.
- YAML frontmatter is recognized and omitted from the document output. Resume headings, lists, links, and typography are mapped to styled React components.
- Normal `/dev` renders a scrolling translucent resume over the fixed playing combination and retains global mute/tone controls. A print media stylesheet converts it to a compact white, black-text US Letter layout.
- Playwright prints internal route `/dev?print=1` through a temporary Vite development server to `public/daren-keck-resume.pdf`. Print mode skips combo initialization, media, scrims, and global controls; the generator fails if a combo or HLS request occurs.
- The homepage links to the developer profile, and the route is included in `public/sitemap.xml`.

## Planned public content pipeline

- Content source: a separate `darenkeck-content` repository containing Markdown files edited through Pages CMS.
- Initial content includes general news plus developer news, resume, and project/profile material.
- `/dev` currently serves the resume. Intended collection routes include `/news`, `/news/:slug`, `/dev/news`, and `/dev/news/:slug`; final file-to-route conventions remain to be defined.
- `scripts/fetch-darenkeck-content.sh` shallow-fetches `main` by default before darenkeck staging/prod builds, validates `content/`, `media/`, and non-empty `content/resume.md`, and records the resolved commit in `apps/darenkeck/.generated-content/REVISION`.
- Fetched Markdown is stored under the gitignored `apps/darenkeck/.generated-content/content/`; media is copied to the gitignored `apps/darenkeck/public/media/` for Vite deployment.
- Mermaid diagrams are authored as `.mmd` files outside the deployed tree and manually rendered with the pinned `diagram:svg` command into committed `media/diagrams/*.svg`. Markdown references `/media/diagrams/...`; the viewer uses responsive light-card image styling and the PDF generator fails on broken images.
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
