# Current State

## Live shape

- Monorepo: `apps/web`, `apps/darenkeck`, `infra/cdk`, `packages/contracts`, `packages/shared`, `packages/tone-core`.
- Workspace/package manifests are now versioned at `1.0.1` for upcoming release tracking.
- Primary runtime flows are working: upload -> processing -> ready -> combo playback.
- `darenkeck` static site is deployed on S3 + CloudFront with security headers and crawl metadata.
- `apps/darenkeck` uses React Router for public routes. `/dev` is deployed and lazy-loads the fetched `content/resume.md` with styled Markdown components plus a generated print-friendly PDF download. `/blog` and `/blog/:slug` use the same persistent media layout and document styling for a generated newest-first post index and individual entries.
- Public-site content lives as Pages CMS-managed Markdown in the private `darenkeck-dev/darenkeck-content` repository. Darenkeck deploys fetch and validate that content before building; news/blog collection routes remain pending.
- Content diagrams use Mermaid only as an authoring format. Deployment renders fetched `.mmd` sources with a pinned CLI into ignored static SVG assets; web and PDF consume the generated files without runtime Mermaid or committed generated content.

See also: [Architecture Map](architecture-map.md), [Deploy and Ops](deploy-and-ops.md).

## Key behavior now

- Audio uploads default to `audio-transcode-hls-v1` (normalized HLS output), originals still preserved.
- Random public combo API accepts optional previous audio hint and avoids repeating prior audio track when possible.
- `ComboPlayer` now uses video timeline while muted and switches to audio timeline once unmuted playback is user-activated.
- Streaming CloudFront now emits CORS headers for derived HLS objects and supports preflight header forwarding.
- `apps/darenkeck` local playback debug overlay is currently disabled for release preparation.
- `ComboPlayer` startup now avoids audio `play()` during muted autoplay; audio playback begins on user unmute interaction.
- `packages/tone-core` is the TypeScript-native tone analysis core for Lambda-native extraction; the existing Python `apps/tone-embedding` CLI remains unchanged as the experimental/reference implementation.
- Prod processing now uses the zip-based Node `tone-core` tone-analysis worker with an account-local ffmpeg Lambda layer for video frame extraction.
- Audio tone analysis now normalizes source audio to a known-good MP3 with ffmpeg before sending it to OpenAI, avoiding strict `input_audio` format failures on decodable originals.
- New `tone-core` analyses use research-informed `tone-taxonomy/v2`: expanded descriptor keywords and weighted multi-dimension keyword mappings, with dominance defined as perceived potency/force/scale.
- Asset records now support a bounded public `auditLog` trail for upload, conversion, MediaConvert, and tone-analysis lifecycle events; the asset detail UI renders it as an activity log.
- Library and folder child views now use the list display exclusively, with multi-select, select-all, bulk actions, and direct Review links for audio/video assets.
- Selected library items now use one Action disclosure for Make Public, Make Private, tone reprocessing, and conversion reprocessing; Delete remains a separate destructive button. Visibility changes use bounded per-asset PATCH requests, skip folders, report partial failures, and automatically trigger vector convergence.
- Upload supports multi-file batches with MIME/extension type inference for audio, video, and images; each file gets editable title/type, independent status/progress, and bounded-concurrency upload over the existing per-asset APIs. Batches default to private and to the folder from which Upload was opened.
- Media Manager now has a generic job framework for long-running asset actions; recursive delete and queued tone/conversion reprocessing report progress through a bottom status bar.
- Tone reviews are submitted only through the dedicated Review page as target-centered human keywords; asset and combo detail pages no longer contain review forms.
- Media Manager includes a dedicated `Review` route with a top-right Combo/Audio/Video switch; it defaults to a random public combo, switches to fresh random audio/video assets from the full owned asset pool, uses an adaptive five-keyword tone picker biased toward the latest selected descriptor, and shows only reviews for the current asset/combo target.
- Combo review playback now uses a reusable shared `ComboToneReviewPlayer` surface with background combo playback, overlaid Next, adaptive keyword selection, selected chips, and submit. Media Manager wires it to authenticated review submission; no anonymous public submission path is included in the MVP.
- Public anonymous combination reviews are explicitly post-MVP. The current release target is public keyword-driven tone selection with automatic tone walking and reliable random fallback.
- The MVP keeps Darenkeck's existing top busy indicator and does not add a new retry/no-result surface. Public selection and vector convergence now emit consistent structured outcome logs; dashboards, new alarms, notifications, and richer recovery UI are deferred hardening.
- Standalone audio and video playback loops continuously on the Review route; ordinary asset-detail playback remains non-looping.
- Human review capture starts blank/neutral for combo, audio, and video targets. OpenAI-extracted tone remains displayed on asset detail pages, but review inputs are independent human judgments rather than edits to model output.
- The `Combos` page is now the all-combo-review index, linking reviewed combinations back into the review surface.
- Audio/video tone scores now preserve OpenAI output in `toneAnalysis.scores` and materialize `adjustedScores` by weighting OpenAI as one vote and each taxonomy-compatible curator review as one vote. Combo reviews never adjust source assets.
- Combo reviews currently store keywords and source asset IDs without derived combo scores or review-time source-vector snapshots. The agreed future boundary computes combo tone on demand from effective audio/video vectors, starting with a versioned deterministic predictor and allowing a learned forward implementation later; no combo vectors are persisted. A combo vector alone cannot uniquely recover both source vectors, so future target decomposition should retrieve/rank candidate pairs or condition on one fixed source rather than learn a single-valued inverse.
- Audio/video curator keywords are mapped server-side into taxonomy score vectors; client-provided scores are ignored. Asset detail dumbbell bars compare extracted and adjusted values with a colored delta connector.
- Audio/video asset pages list their target-specific review history at the bottom and link directly to `/review` with that asset preselected for manual review.
- Production tone reviews were reset on 2026-07-15 so curator calibration starts clean under the adjusted-score workflow.
- The MVP S3 Vectors foundation is deployed. Production has the provider-neutral vector index/query boundary, AWS adapter, SQS- and DynamoDB Stream-backed convergence worker, lifecycle producers, fingerprinted asset sync state, queue/DLQ alarms, and dry-run/apply/force reconciliation with orphan detection. The initial reconciliation indexed all 20 eligible assets; all 94 authoritative asset records are current with zero orphan vectors. Published clients still use the random path.
- `POST /public/combos/select` is deployed for explicit `mode="walk"`. It includes strict versioned contracts, typed S3 Vectors retrieval, deterministic combo-tone prediction, exact local ranking, distance-weighted top-five sampling, bounded-history enforcement, controlled random fallback, throttling, a four-second vector deadline, and embedded metrics. Production smoke requests returned exact walk selections and honored recent history; the integrated Media Manager client remains unpublished.
- The same endpoint supports `mode="search"` with one combined tone-word query. Search maps shared picker words into sparse taxonomy-v2 dimensions, performs typed direct plus target-conditioned source retrieval bounded to three anchors per type, predicts transient combo tones, and reranks by exact masked distance. The deployed API carries prior combo/audio/video history into search and requires both audio and video to change during subsequent walks and fallback selection.
- Public random and controlled-selection responses now return an optional complete `predictedTone` object computed by `combo-tone-predictor/v0` when both selected assets have eligible taxonomy-v2 vectors. The deployed random and search production smokes each returned ten finite bounded dimensions.
- The adaptive 54-word picker hierarchy and suggestion algorithm now live in `tone-core`, with reusable React state/UI in `packages/shared`. Media Manager `/combos` has a locally built controlled explorer with initial sound enabled, review-aligned top suggestions and selected-word submission, visible chip remove controls, initial random playback, tone search, manual/automatic walking, bounded combo/audio/video history, diagnostics, and review deep links; this web UI is not published from this repository.
- Darenkeck `/` now has a locally built curiosity-gated tone explorer. First use shows a versioned local explainer, selected words start global search and bounded automatic walking, and empty submission starts a fully random sequence. The explorer reuses the shared picker/submit pile, temporarily collapses the bulletin, and remains unpublished pending staging and target browser-matrix validation.
- Darenkeck has locally built persistent blog routes. The homepage exposes Resume and Blog controls; navigating through the blog index and entries retains the same playback elements. A preparation step validates post frontmatter, excludes explicit and filename-marked drafts from the generated bundle, and sorts published posts newest-first.
- Darenkeck `App` now persists across `/` and `/dev`: the same media elements, audio state, picker selections, and walk history survive SPA navigation while playback keeps advancing behind the translucent resume. The tone control maps the playing combo's ten signed predicted dimensions around a polar wheel and morphs between profiles, with a static lopsided fallback when tone data is unavailable. The resume fades, lifts, and scales during route entry and exit, including browser Back, while print and reduced-motion modes remain transition-free. New tone searches retain prior bounded history and the departing pair. Direct `/dev` starts a muted random combination; internal `/dev?print=1` suppresses all media for deterministic PDF generation.
- Auth guard middleware covers app and same-origin API routes; missing/expired Cognito JWT cookies redirect page requests to login with the original path preserved and return JSON `401` for API requests. Cognito web client ID/access token validity is configured for 12 hours.

Details: [Recent Changes](recent-changes.md).

## Most relevant deployed outputs

- API URL: `https://adenvmeabg.execute-api.us-west-2.amazonaws.com`
- Primary site domain: `https://darenkeck.com` (Route 53 apex alias -> `EUQDAU6DH3BMC`)
- Darenkeck site bucket: `darenkeck-site-prod`
- Darenkeck CloudFront distribution: `EUQDAU6DH3BMC`
- Darenkeck CloudFront domain: `d2fmm3qe2rclf2.cloudfront.net`
- Route 53 apex `A/AAAA` records for `darenkeck.com` are now stack-managed in `MediaManagerDarenkeckSiteStack`.
- Asset tone vector index: `arn:aws:s3vectors:us-west-2:125455294948:bucket/media-manager-asset-tone/index/asset-tone-v1`

## Working assumptions

- Assets must be `status=ready` and `visibility=public` for `GET /public/combos/random` selection.
- For private library/editor flows, auth is Cognito JWT-backed through API Gateway.
- Markdown planning/checklist files are now in `raw_sources/` and not co-located with runtime code.
