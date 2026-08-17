# Wiki Log

## [2026-08-16] web | rename bulletin routes to news

- Renamed the public bulletin archive and detail routes to `/news` and `/news/:slug`, including breadcrumbs, page metadata, homepage links, and not-found copy; the Pages CMS collection and generated manifest remain named `bulletins` internally.

## [2026-08-16] web | unify Darenkeck minimize mode

- Replaced the homepage-only bulletin toggle with one persistent content minimize mode shared by the homepage, resume, blog, and news routes.
- Added the minus control to existing sticky document navigation, reused the fixed `Daren Keck [+]` restore view, kept route and playback trees mounted, restored per-route scroll offsets, and returned compact media controls to floating positions while minimized.
- Pinned the document minus control directly to the sticky card's upper-right corner, outside navigation padding, while reserving inline room for route and tone controls.
- Moved the homepage minus into the same true upper-right card-corner position while retaining the Daren Keck wordmark above the panel.
- Kept a 4px right inset while vertically centering document minus controls on breadcrumbs and the homepage control on the inline `Hey!` title.
- Replaced the homepage Resume, Blog, and Wayfarer pill buttons with a thin divided text-link footer rail; only the external Wayfarer link retains an arrow icon.
- Moved the News archive link into the homepage footer rail and removed the standalone `View all` row from the bulletin section.
- Extended desktop and compact browser continuity checks for focus, scroll, DOM/media identity, control placement, and homepage/document minimize restoration.

## [2026-08-16] content | refresh Darenkeck source

- Fetched Darenkeck content revision `9e6eb043f4a05729771d569057edda3f7f746a66`.
- Regenerated two blog posts, two bulletins, one diagram, and the resume PDF.

## [2026-08-16] web | add CMS-backed Darenkeck bulletins

- Added validated build-time extraction for Pages CMS bulletin Markdown with draft filtering, newest-first ordering, summaries, and optional featured images.
- Replaced the hardcoded homepage announcement with the latest three published bulletins and `View all`, plus news archive and detail routes that retain the persistent media experience.
- Standardized homepage and archive rows on a leading thumbnail column, using a neutral bulletin placeholder when an entry has no featured image.
- Rendered bulletin summaries as compact Markdown so Pages CMS-authored links work on homepage, archive, and detail surfaces; generated plain summary text separately for page metadata.
- Compacted the homepage introduction into one paragraph beginning with bold `Hey!` and removed the extra project-link sentence to preserve vertical space for bulletins.
- Replaced the homepage bulletin's full-viewport flex wrapper with an auto-height container using an explicit fixed bottom inset, keeping its bottom gap invariant while additional rows expand upward.
- Aligned bulletin archive titles, dates, and summaries in one top-aligned content column beside the leading thumbnail.
- Matched the compact homepage panel to the blog and bulletin document surfaces with the same black translucency, blur, border, and shadow treatment.
- Bottom-aligned bulletin detail cards within the document shell so shorter entries keep the same viewport-bottom gap and differing content lengths grow upward.

## [2026-08-15] deploy | publish pushed Darenkeck content

- Published Darenkeck production from content revision `7134d65095f54314d99e38e288d87a60822d5d08` and completed CloudFront invalidation `IEYWU4C1WM0UQMSSPS550SUOD8`.
- Verified the live homepage, updated resume, generated PDF, blog index, and tone article routes, including browser rendering of the resume.

## [2026-08-15] deploy | republish Darenkeck content

- Published Darenkeck production and completed CloudFront invalidation `I8PG60X0RK0W89HOAXPUNA60VH`.
- The content fetch resolved to revision `8ddcf96d6e0f7eaf1fbe86069d195967f7f2755c`, unchanged from the previous content deploy.
- Verified the live homepage, resume, generated PDF, blog index, and tone article routes, including browser rendering of the resume.

## [2026-08-13] docs | refresh monorepo README

- Replaced the stale pre-release roadmap README with a current guide to every application, package, infrastructure layer, runtime flow, content pipeline, validation command, deployment path, and maintained documentation source.

## [2026-08-13] docs | retire completed root plans

- Removed the completed `MVP_RELEASE_PLAN.md`, moved the React audit checklist to `wiki/cleanup-todos.md`, and archived `TONE_REVIEW_PLAN.md` under `raw_sources/`.
- Updated the wiki index, open issues, review notes, and historical vector-plan reference to point at the maintained or archived locations.

## [2026-08-13] docs | remove stale Essentia runbook

- Removed the duplicated root `AUDIO_TONE_MODEL_RUNBOOK.md`; the app-local `apps/tone-embedding/docs/audio-tone-extraction.md` remains the reference for the experimental Essentia workflow.

## [2026-08-13] deploy | publish resume update

- Published Darenkeck production from content revision `8ddcf96d6e0f7eaf1fbe86069d195967f7f2755c` and completed CloudFront invalidation `I9DQLQWX57UYCM92BLH5RHNCLD`.
- The first PDF-generation attempt timed out waiting for local `networkidle`; a clean retry completed the full fetch, preparation, PDF, build, sync, and invalidation workflow.
- Verified the live homepage, resume, generated PDF, and blog routes, including browser rendering of the updated resume.

## [2026-08-10] deploy | publish tone scroll lock

- Published Darenkeck production from content revision `9bdcd466e525ce4502a52f81cac107acc8ac9a47` and completed CloudFront invalidation `I85LJMQV64C28VP7XL9MDTDJRA`.
- Verified homepage, blog, tone article, resume, and PDF routes, plus live compact tone selection locking and restoring a scrolled document at its exact prior offset.

## [2026-08-10] web | lock tone overlay scrolling

- Locked document scrolling at its current position while the full-screen tone explorer is open, absorbed backdrop touch/overscroll input, and restored prior styles and scroll position on close.
- Extended mobile browser coverage to verify the fixed-body lock and exact scroll restoration.

## [2026-08-10] deploy | publish refined tone overlay

- Published Darenkeck production from content revision `138959fbd3095fc2a33a1e60cc397449c8bc9250` and completed CloudFront invalidation `IDJWFM8XNDTYGX4MRFM91LACNA`.
- Verified homepage, blog, tone article, resume, and PDF routes, plus compact tone mode hiding mute, exposing its separate close control, holding the submit check for about one second, and restoring document controls.

## [2026-08-10] web | hold tone submit confirmation

- Showed the tone submit success check for one second before closing the full-screen explorer and restoring compact document controls.
- Extended mobile browser coverage to verify the success state remains readable for the intended interval and submission still starts the next random journey.

## [2026-08-10] web | separate compact tone close control

- Kept the compact document bar's tone icon launcher-only, hid its embedded mute control during tone selection, and added a dedicated close control above the full-screen overlay.
- Updated mobile browser coverage for launcher identity, mute-control removal, overlay close placement, and control restoration after closing.

## [2026-08-10] web | expand tone selection overlay

- Added a full-screen translucent tone-selection backdrop and moved suggested keywords to roughly one-third of the viewport height while preserving top media controls and the bottom selected-keyword pile.
- Extended mobile browser coverage to verify the backdrop fills the viewport and suggestions do not obstruct the close control.

## [2026-08-10] web | bottom-align blog index

- Positioned the blog entry list near the viewport bottom to match the homepage card while keeping individual posts and the resume top-aligned.

## [2026-08-10] deploy | publish tone article and resume update

- Published Darenkeck production from content revision `c394fc13683cd9a4194147b5bbcbd197469e16b4` and completed CloudFront invalidation `IA4N7J51L9S28MNY01GX0PXV0B`.
- Generated two published blog posts and one Mermaid SVG, including the newly published `/blog/audio-visual-tone-exploration` article.
- Verified the homepage, blog index, tone article, generated diagram, updated resume, PDF, and persistent playback through live browser navigation.

## [2026-08-10] deploy | publish blog and tone integration

- Published Darenkeck production from content revision `26783ccfe35c6967fbb04abe098adbd048579010` and completed CloudFront invalidation `I18836UGI00VNSZ3RIX3PSJ4W8`.
- Verified homepage, blog index, direct post, resume, PDF, public random API, persistent playback navigation, visible tone controls, exact search, and a subsequent walk that changed both sources.
- Published one blog post; `audio-visual-tone-exploration.md` remained excluded because its canonical frontmatter still sets `draft: true`.

## [2026-08-10] web | amplify first-use tone control

- Replaced the unacknowledged tone control's subtle pulse with a softly moving cyan glow that slowly oscillates in brightness, retaining a static treatment for reduced-motion users.

## [2026-08-10] web | center responsive document breadcrumbs

- Centered Resume/Blog breadcrumbs whenever media controls are embedded in the sticky row, retaining left alignment only when controls float at desktop widths.

## [2026-08-10] web | expand responsive document controls

- Made Resume/Blog cards edge-to-edge below the desktop breakpoint and embedded controls at mobile and medium widths.
- Positioned audio left of the breadcrumbs and tone right, retaining Resume Download in the right action group.
- Added 390px and 820px browser coverage for full-width layout, control ordering, sticky scrolling, and playback continuity.

## [2026-08-10] web | embed mobile media controls in document navigation

- Moved the single mute and tone control group into the sticky Resume/Blog breadcrumb row on mobile while retaining floating controls on the homepage and desktop.
- Added mobile browser coverage for placement, mute/tone interaction, sticky scrolling, route continuity, and media-element identity.

## [2026-08-10] web | simplify blog index

- Removed the `/blog` headline and introduction so the dated entry list begins directly below the blog breadcrumb.

## [2026-08-10] web | flatten sticky document navigation

- Removed the sticky breadcrumb row's inset border, expanded it flush to the document's top and full width with matching top corners, and pinned it to the viewport top with an opaque-to-90%-transparent vertical background gradient.

## [2026-08-10] web | keep document navigation visible

- Made the shared resume/blog breadcrumb bar sticky below the fixed media controls with an opaque blurred surface.
- Extended the browser continuity smoke to verify the bar remains visible while scrolling a blog entry.

## [2026-08-10] web | remove Markdown image frames

- Removed added backgrounds, borders, and padding from blog/resume Markdown images so screenshots and diagrams render edge-to-edge.

## [2026-08-10] web | style Markdown tables

- Added responsive horizontal overflow, borders, header contrast, row separation, and print styles for GFM tables shared by blog and resume documents.

## [2026-08-10] content | render Mermaid diagrams for dark documents

- Switched generated Mermaid SVGs to the dark theme with transparent backgrounds.
- Applied the dark image frame only to generated diagram paths while preserving light cards for ordinary post images.

## [2026-08-10] content | render fenced blog Mermaid diagrams

- Extended content preparation to extract Mermaid fences from published blog posts, render deterministic static SVGs, and rewrite the generated Markdown to image links.
- Verified the latest content revision produces two published posts and two SVG diagrams without shipping Mermaid runtime code.

## [2026-08-10] web | replace document minimize controls with breadcrumbs

- Replaced the resume/blog minimize icon with upper-left breadcrumb navigation back to the homepage and blog index.
- Moved Resume's PDF download action to the upper-right of the shared document header.

## [2026-08-10] web/content | add persistent generated blog

- Added persistent `/blog` and `/blog/:slug` document routes that retain combo playback and share the resume card and Markdown styling.
- Added deploy-time post validation/indexing with published-only generated output, explicit and filename-based draft exclusion, and newest-first ordering.
- Moved Mermaid SVG generation into content preparation so fetched `.mmd` sources are the single source of truth and stale or invalid diagrams cannot deploy.

## [2026-08-10] planning | reconcile MVP implementation status

- Marked implementation-order items 3 through 7 complete and deployed, with Darenkeck integration complete in source for item 8.
- Kept item 9 open for client publishing, target browser/playback validation, and production structured-log smoke verification.

## [2026-08-10] planning | defer React cleanup audit

- Added a post-MVP source-audit plan for both React applications and the shared playback/review package.
- Deferred audit-agent setup, remediation, and authenticated browser testing until after the tone-selection and automatic-walk release.

## [2026-08-06] web | simplify asset browsing and review playback

- Removed the underdeveloped asset card/grid view so library and folder contents always use the operational list view.
- Added per-row Review links for audio/video assets and enabled review-only looping for standalone asset playback.

## [2026-08-06] ops | prepare structured release logs

- Added consistent final-outcome logs for public combo selection and per-operation success/failure logs for vector convergence.
- Kept the existing Darenkeck busy indicator and random fallback for MVP; deferred new recovery UI, dashboards, alarms, notifications, and expanded cost controls.

## [2026-08-06] planning | narrow MVP to tone selection and walking

- Changed the MVP launch boundary to public keyword-driven tone selection plus automatic tone walking with random fallback.
- Deferred anonymous public combination reviews, their UI, abuse/privacy controls, metrics, and operations to a separate post-MVP release.

## [2026-08-06] content | authored Mermaid SVG workflow

- Added a pinned manual Mermaid-to-SVG authoring command, responsive light-card Markdown images, and PDF image-load failure checks.
- Kept Mermaid out of the browser and deployment pipeline: `darenkeck-content` commits both source `.mmd` and generated `media/diagrams/*.svg`, and web/PDF consume the same static SVG.

## [2026-08-06] docs | wiki architecture synthesis

- Added and cross-linked maintained references for tone-vector dimensions, upload-processing dependencies, review experience, and the current S3 Vectors-backed walk algorithm.
- Updated current/recent state, active risks, and future ideas with the latest commits, public review prerequisites, and the non-identifiable inverse-combo boundary.

## [2026-08-06] docs | current walk algorithm

- Added a detailed reference for walk requests, S3 Vectors source retrieval, effective vectors, transient 60/40 combo prediction, exact ten-dimension ranking, weighted top-five sampling, history exclusions, candidate resolution, and staged random fallback.

## [2026-08-06] docs | review experience notes

- Added rough product and architecture notes covering the current review flow, adaptive keyword selection, responsive behavior, combined playback synchronization, stored review data, and future privacy-aware personalization.

## [2026-08-06] docs | upload processing architecture

- Added a dependency-focused Mermaid diagram and reference tables covering upload confirmation, EventBridge fan-out, isolated conversion and tone-analysis branches, playback readiness, failure boundaries, and vector convergence.

## [2026-08-06] docs | tone vector dimension reference

- Added a concise table defining the ten canonical tone dimensions, signed poles, evidence notes, canonical range, and current combo weighting.

## [2026-08-04] web/backend | predicted-tone wheel

- Added optional complete `predictedTone` output to public random and controlled-selection contracts, computed from authoritative effective source vectors with `combo-tone-predictor/v0`.
- Carried predicted tone through Darenkeck combo state and mapped signed values inward/outward around a neutral-radius ten-axis wheel with reduced-motion-aware profile interpolation.
- Added contract, random/select Lambda, slot-state, wheel-mapping, and route-continuity coverage.
- Deployed `MediaManagerApiStack`; production random and search responses each returned all ten finite `predictedTone` dimensions within `[-1, 1]`.

## [2026-08-04] web | radial tone control icon

- Replaced the abstract orbital tone control mark with a 36-pixel polar amplitude chart using varied radial samples, a neutral-radius guide, a lightweight connected profile, and a central hub without an outer bounding circle.
- Darenkeck lint, type-check, and production build passed.

## [2026-08-04] web/backend | history-preserving fresh-source selection

- Extended bounded selection history with three recent video IDs and carried prior history plus the departing combo into new tone searches.
- Required both audio and video to change during walks, including random fallback paths that may relax older history but never either current source.
- Added a visible remove `X` to selected tone chips and updated focused contract, explorer, journey, and Lambda tests.
- Deployed `MediaManagerApiStack`. A production initial search, history-aware second search, and subsequent walk all returned exact selection metadata; both source IDs changed at each transition.

## [2026-08-04] web | resume route transition

- Retained the routed resume during navigation long enough to animate opacity, vertical position, scale, and blur on both entry and exit, including browser Back.
- Kept print and reduced-motion modes transition-free; Darenkeck lint, type-check, production build, and route-continuity browser smoke passed.

## [2026-08-03] web | persistent Darenkeck experience

- Nested `/` and lazy `/dev` under the persistent Darenkeck `App` layout so the same player, audio state, tone selections, and random/search/walk journey survive SPA navigation and browser Back.
- Rendered the scrolling resume as a translucent foreground over fixed continuing playback, retained global mute/tone controls, and made suppressed background video keyboard-inert.
- Added `/dev?print=1` media suppression with generator request assertions plus a Playwright continuity smoke covering player identity, request count, mute state, and selected words.
- Added left-aligned `Download` and a right-aligned homepage-style minimize control inside the resume card; print generation asserts that this control row is hidden.
- Removed the homepage Links heading, added the boxed maximize icon to Dev work, and marked Wayfarer Records with an external-link arrow.
- Added a subtle translucent black backdrop and blur behind selected tone-word chips for readability over resume content and varied media.
- Applied the same translucent backdrop and blur to top tone-word suggestions while retaining a bright selected state.

## [2026-08-03] web | Darenkeck tone explorer

- Added a curiosity-gated homepage tone explorer with a versioned local first-use explainer, shared top keyword picker and bottom submit pile, bulletin collapse/restore, selected-word search, five-combo/three-audio automatic walking, and a fully random zero-word mode.
- Generalized the Darenkeck slot manager around one serialized next-combo selector, moved explorer request/history and submit-pile behavior into `packages/shared`, and added focused journey, preference, and manager tests. Publishing and browser validation remain pending.
- Replaced the global Darenkeck canvas gradient with solid black across all routes.
- Kept the handwritten name beside the minimize control while expanded and beside the restored maximize control at viewport-right when minimized; Tone Submit uses matching viewport-left padding, selected words stack upward, and the active tone control changes to an `X`.
- Added a crossfade/slide and borderless card expansion transition between minimized and expanded bulletin states; maximizing the bulletin now also exits tone mode.
- Kept the tone picker mounted while its overlay is closed so the `X` hides the UI without clearing selected words or changing the active playback journey.

## [2026-08-03] docs | future ideas backlog

- Added a canonical deduplicated future-ideas page for tone extraction vNext and hybrid natural-language clip search across tone and concrete content.

## [2026-08-03] web/backend | shared tone explorer and search

- Moved the duplicated 54-word review hierarchy and deterministic adaptive suggestion logic into browser-safe `tone-core`; added reusable `useToneWordPicker` and `ToneWordPicker` exports in `packages/shared` and migrated combo/audio/video reviews without changing their exploration modes.
- Added sparse taxonomy-v2 tone queries, zero-filled approximate source retrieval, exact masked combo-tone distance, and target-conditioned complementary source queries bounded to three direct anchors per type and 20 counterpart matches per anchor.
- Extended `POST /public/combos/select` with strict `mode="search"` requests and versioned search/fallback metadata while retaining existing walk contracts and random fallback.
- Added a Media Manager `/combos` controlled explorer above the existing review list with initial random playback, combined tone-word search, manual and end-of-playback walking, five-combo/three-audio history, keyboard playback control, selection diagnostics, and review links.
- Enabled sound by default in the Media Manager explorer, aligned tone selection with the combo review overlay, reused its submit control to establish a new walk anchor, moved the unmuted speaker waves up two pixels, and kept the mute control above the tone overlay.
- Deployed the search backend with the final three-anchor complementary retrieval bound. A production `serene + loving` request returned `resolvedMode="search"` with masked distance and dimensions; walking from that result returned `resolvedMode="walk"` with new audio while retaining the video. The first post-deploy search took 5.4 seconds during cold start, while two warm searches took 1.2-1.5 seconds. The Media Manager web UI built locally but is not published from this repository.

## [2026-08-03] backend | predicted combo-tone walk endpoint

- Added strict versioned contracts and an isolated read-only `POST /public/combos/select` Lambda for initial `mode="walk"` requests.
- Added required audio/video filters to the provider-neutral vector query boundary and S3 Vectors adapter; no index replacement or backfill is required.
- Implemented `combo-tone-predictor/v0`, exact squared-Euclidean ranking, `1 / (1 + distance)` top-five sampling, current/recent exclusions, controlled history relaxation, and explicit random fallback reasons without persisting combo vectors.
- Added route throttling, payload bounds, a four-second vector-query abort deadline, public CORS reuse, read-only DynamoDB/S3/S3 Vectors IAM, embedded request/error/latency metrics, and focused package/Lambda/CDK tests.
- The first API rollout failed because the stage attempted to apply route throttling before CloudFormation created the route; rollback was recovered and an explicit stage-to-route dependency was added.
- The first live request correctly fell back but exposed Smithy big-decimal objects in returned `float32` data. The adapter now normalizes runtime vector values and distances to finite numbers, with a production-shaped regression test.
- Redeployed `MediaManagerApiStack` successfully. Random health returned `200`; two walk smokes returned `resolvedMode="walk"` with exact distances, recent-history exclusions changed the selected pair, CORS preflight returned `204`, the Lambda is active on Node 22 with a 15-second timeout, route throttling is 10 requests/second with burst 20, and CloudWatch published walk metrics. Frontend integration remains pending.

## [2026-08-02] docs | current tone review and predictor plan

- Replaced the stale review-plan outline with current authenticated keyword capture, server trust boundaries, sparse per-dimension curator materialization, vector convergence, listing, privacy, and purge behavior.
- Documented on-demand combo-tone prediction from effective source vectors: deterministic `combo-tone-predictor/v0` first, with server-derived sparse labels and source snapshots required before a learned residual model.
- Kept combination vectors out of DynamoDB and S3 Vectors; the existing relationship geometry remains experimental and transient.
- Fixed the initial walk boundary as `POST /public/combos/select` with explicit `mode="walk"`: S3 Vectors retrieves typed source candidates using Euclidean distance, while exact squared-Euclidean predicted combo-tone ranking and sampling happen in application code.

## [2026-08-02] web | bulk visibility actions

- Added Make Public and Make Private for selected non-folder assets using five-at-a-time PATCH requests with deterministic partial-failure reporting.
- Consolidated visibility and reprocessing controls under one Action disclosure while retaining Delete as a separate destructive button; visibility is now visible in list and grid layouts.
- Added owner authorization and a conditional owner check to asset PATCH, preserving automatic vector convergence on visibility changes.

## [2026-08-02] web | bulk media upload

- Added multi-file upload with MIME/extension inference for audio, video, and images, editable per-file metadata, shared private/current-folder defaults, and two-file bounded concurrency.
- Added byte-weighted batch progress, per-file status and retry recovery, multipart worker settling before abort, folder-context validation, and accessible progress/action labels.
- Reused existing singular create, signed upload, multipart, and confirmation APIs; no infrastructure deployment is required.

## [2026-08-02] deploy | asset vector lifecycle and backfill

- Deployed Data, Vector, API, and Processing in dependency order, enabling the Assets `NEW_AND_OLD_IMAGES` stream and the SQS/stream-backed vector convergence worker.
- Ran production reconciliation in dry-run and apply modes. The steady-state verification found 20 indexed eligible assets, 74 ineligible assets, all 94 authoritative records current, zero orphan vectors, and empty sync/DLQ queues.
- Verified `GET /public/combos/random` still returns a playable derived pair; public selection remains on the existing random path.

## [2026-08-02] foundation | asset vector lifecycle

- Added a provider-neutral vector index/query boundary and an AWS S3 Vectors adapter with canonical metadata hydration.
- Added SQS- and DynamoDB Stream-backed asset convergence, provider-neutral fingerprinted sync state, lifecycle enqueue hooks across API and processing mutations, and queue/DLQ alarms.
- Added dry-run/apply/force reconciliation with indexed-key and orphan detection. Deployment, initial apply, and backend-vs-local search verification remain pending.

## [2026-07-30] foundation | canonical asset tone vector record

- Tightened the provider-neutral `asset-tone-vector/v1` schema in `tone-core` with shared provenance constants and strict unknown-field rejection.
- Added a canonical record builder that overlays sparse curator adjustments on complete model scores.
- Expanded tone-core documentation and tests for ordering, bounds, provenance, eligibility boundaries, and provider independence.

## [2026-07-30] docs | remove stale tone embedding plan

- Removed `TONE_EMBEDDING_APP_PLAN.md` because its standalone Python app, persistent combo-vector, and deferred-review direction was superseded by the MVP release and tone review plans.
- Kept `MVP_RELEASE_PLAN.md` and `TONE_REVIEW_PLAN.md` as the active planning documents.

## [2026-07-30] deploy | refreshed resume content

- Fetched `darenkeck-content` revision `d9439b2bd277843224af67c99dde1f86375a69eb`, regenerated the resume PDF, and published the updated darenkeck static site.
- Completed CloudFront invalidation `I1KCVEG9V3SHK0HHUS6UGMMTNB`.
- Verified `/dev` rendering and confirmed the deployed PDF checksum matches the generated artifact.

## [2026-07-30] deploy | darenkeck developer profile

- Published the React Router homepage and `/dev` Markdown resume using `darenkeck-content` revision `94a63029c6189303991f1cf60f927b277290406d`.
- Uploaded the matching two-page resume PDF and completed CloudFront invalidation `I1735IYCVYLSTJCZ58Z8TQYAVI`.
- Verified homepage copy and links, direct `/dev` rendering, PDF MIME and checksum, sitemap inclusion, security headers, and public combo API health.

## [2026-07-29] security | content symlink hardening

- Rejected symlinks, submodules, and other non-regular Git entries under fetched `content/` and `media/` before copying.
- Added staged-tree non-regular-file validation and disabled symlink following during darenkeck S3 sync.
- Created a local gitignored security audit handoff for remaining medium findings to address on a dedicated branch.

## [2026-07-29] content | simplify homepage profile

- Reduced darenkeck.com homepage links to Dev work and Wayfarer Records.
- Replaced the DEPT-specific introduction with a general full-stack developer summary reflecting a decade of experience.

## [2026-07-28] fix | resume PDF dev URL

- Fixed `/daren-keck-resume.pdf` returning the SPA HTML fallback during local development because the generated file existed only under `dist`.
- Changed PDF generation to use a temporary Vite development server and write the artifact under gitignored `public/`, then build it into `dist`.
- Added `content:darenkeck:prepare` and reordered deployment to fetch content, generate PDF, build, and sync.

## [2026-07-28] refactor | resume print styling

- Moved natural element-level print styling from global CSS into Tailwind `print:` utilities on the Markdown component mappings.
- Retained only paper setup, the document-wide print canvas, and sibling-aware pagination logic in `index.css`.
- Regenerated the same two-page, extractable-text resume PDF after the refactor.

## [2026-07-28] build | print-friendly resume PDF

- Added a Playwright generator that prints the built `/dev` route as a US Letter PDF after the Vite build and before static-site upload.
- Added print-only white-paper styling, compact pagination, a `/dev` Download PDF action, and a one-time Chromium setup command.
- Generated and inspected a two-page PDF with extractable text; deployment remains pending.

## [2026-07-28] app | Markdown resume at /dev

- Replaced the `/dev` planning stub with a lazy-loaded viewer for fetched `content/resume.md`.
- Added `react-markdown`, GFM, and YAML frontmatter handling plus responsive styled Markdown elements and resume-specific page metadata.
- Verified darenkeck typecheck, lint, and production build; deployment remains pending.

## [2026-07-28] build | darenkeck content fetch

- Added a standalone shallow fetch command for private `darenkeck-content` Markdown and media with repository/ref overrides, required-path validation, and resolved commit recording.
- Added gitignored generated content/media destinations and wired fetching before both staging and production darenkeck builds.
- Kept Markdown parsing and resume route rendering for the next implementation slice.

## [2026-07-27] planning | external public content pipeline

- Chose a separate `darenkeck-content` repository as the Pages CMS-managed source for resume, news/blog, and project/profile Markdown.
- Planned build-time content fetching and Markdown-to-React rendering for routes including `/news`, `/dev/news`, and `/dev/resume`.
- Selected an SPA-first approach using plain Markdown and `react-markdown`; MDX and SEO-oriented prerendering remain optional later phases.

## [2026-07-27] refactor | public site routing

- Added React Router to `apps/darenkeck` with explicit `/`, `/dev`, and not-found routes in preparation for blog and public review pages.
- Kept `/dev` as a minimal planning stub and linked it from the homepage and public sitemap.
- Relies on the existing CloudFront SPA fallback for direct route requests; deployment remains pending.

## [2026-07-21] foundation | S3 Vectors asset index

- Selected S3 Vectors for the MVP and fixed the initial `combo-selection/v1` behavior: controlled-route rollout, five recent combo exclusions, three recent audio exclusions, and distance-weighted top-five sampling.
- Added the canonical `asset-tone-vector/v1` contract and ten-dimension ordering to `tone-core`, including tested sparse-adjustment overlay semantics.
- Added `MediaManagerVectorStack` with a retained S3 vector bucket, retained 10-dimensional Euclidean `asset-tone-v1` index, stage-aware outputs, deployment commands, and synthesis tests.
- Kept DynamoDB authoritative; vector deployment, lifecycle synchronization, reconciliation, and public selection remain pending.

## [2026-07-20] planning | MVP release plan

- Added `MVP_RELEASE_PLAN.md` with release gates for the 20-audio/20-video corpus, curator calibration, public combo reviews, `darenkeck.com` integration, playback validation, privacy, operations, and rollback.
- Defined a vector-database architecture that indexes effective source asset tone vectors only, generates candidate pairs dynamically, performs global tone-search restarts, and continues with nearest-neighbor walks requiring new audio while allowing the same video.
- Kept combination precomputation, combination vector indexing, live learning from public reviews, free-text interpretation, accounts, and personalization outside the MVP.

## [2026-07-20] ui | condensed status activity table

- Moved the asset Activity Log into the collapsed Status Details disclosure.
- Replaced stacked activity cards with a compact table for time, level, activity, source, and details, with horizontal overflow on narrow screens.

## [2026-07-20] ui | asset playback placement

- Moved the Playback card directly below Status on asset detail pages.

## [2026-07-20] ui | simplified asset status details

- Removed Depth from the asset Status card.
- Moved Container, Root, MediaConvert Job, Tone Analysis Artifact, and Original into a collapsed Details disclosure below the primary status fields.
- Reduced the primary Status grid to Status, Conversion, Tone Analysis, Type, and Visibility; all remaining operational metadata now lives under Details.
- Renamed the vague Profile label to Conversion Profile.
- Promoted the overall state into the card title (`Status: Ready`) and compacted Conversion, Tone Analysis, Type, Visibility, and the refresh action into the same responsive row when space allows.

## [2026-07-20] ui | asset action ordering

- Moved asset deletion to the far-right end of the header actions after Review, reprocessing, and Move.
- Replaced the Delete text button with a separated, accessible trash icon using a subtle destructive treatment; the confirmation dialog remains unchanged.

## [2026-07-20] ui | metadata-scoped asset editing

- Renamed the asset `Editable Metadata` card to `Metadata` and moved Edit, Save Changes, and Leave Edit Mode controls into the card header.
- Removed page-level metadata edit controls so edit mode is visually scoped to the fields it affects.

## [2026-07-20] ui | asset review history and deep links

- Added target-specific review history to the bottom of audio/video asset pages.
- Added asset Review actions that open `/review?targetType=<audio|video>&assetId=<id>` and load the selected asset directly; review capture remains exclusive to the Review route.

## [2026-07-20] ui | tone score dumbbell bars

- Replaced asset tone score fill/delta bars with a single signed dumbbell track: hollow OpenAI marker, solid adjusted marker, and a colored connector showing direction and magnitude.
- Removed the upper-right numeric score text; exact values remain available through marker tooltips and accessible labels.

## [2026-07-20] behavior | keyword-only curator reviews

- Removed review forms from asset and combo detail pages; review capture now exists only on the dedicated Review route.
- Removed tone score sliders from audio, video, and combo review flows.
- Added deterministic mappings from every review-picker keyword to production taxonomy descriptors; the API derives audio/video score vectors from keywords and ignores client-supplied scores.
- Updated asset score bars to show OpenAI and curator delta as distinct color segments with a line at the original OpenAI endpoint.

## [2026-07-20] fix | tone review transaction permission

- Added the DynamoDB `ConditionCheckItem` permission required by transactional audio/video review writes; missing permission caused production submissions to return `500` before storing a review.
- Added Lambda exception logging and preserved backend error detail through the web API proxy for future review-submission diagnostics.

## [2026-07-15] feature | curator-adjusted asset tone scores

- Preserved original OpenAI audio/video scores and added versioned materialized adjusted scores using OpenAI weight one plus one vote per taxonomy-compatible curator review.
- Kept combo reviews isolated from source audio/video assets and rebuilt adjustments after both review submission and OpenAI reanalysis.
- Added three-marker audio/video score sliders showing OpenAI, curator input, adjusted result, and delta, plus effective-score display on asset details.
- Added a dry-run-first production review purge command, deleted all 21 existing reviews (all curator combo reviews), and verified zero review records remain.
- Deployed `MediaManagerApiStack` and `MediaManagerProcessingStack`; public combo health returned `200` afterward. The authenticated web UI build passed locally but remains unpublished because this repo has no web deployment command.

## [2026-07-10] bug | combo player end-state frame jump

- Added playback watchlist item: combo video appears to jump frames when reaching the end. Debug ended/replay state, loop flags, pause-at-end behavior, and final sync/seek signals.

## [2026-07-10] refactor | shared combo review surface

- Added `packages/shared` `ComboToneReviewPlayer`, wrapping `ComboPlayer` with adaptive keyword selection, selected chips, submit, loading overlay, and overlaid Next.
- Refactored Media Manager combo review mode to use the shared component; audio/video review remains in the web-specific workbench.
- Kept submission app-owned via callback so Media Manager can submit authenticated curator reviews and `darenkeck.com` can later wire anonymous public reviews through a separate endpoint.

## [2026-07-10] ui | review keyword picker

- Replaced the Review page tone tree interaction with an adaptive five-keyword picker.
- The initial option set is target-seeded random; each `>` advances using the latest selected keyword as a taxonomy anchor, preferring three adjacent leaf descriptors plus two random exploration descriptors.
- Selected keyword chips remain removable at the bottom of the media area and review submit still appears after the descriptor threshold is met.

## [2026-07-10] behavior | independent human review capture

- Changed dedicated Review and detail-page review panels so audio, video, and combo review inputs start with empty keywords and neutral zero scores.
- Stopped UI review submissions from sending `modelScoresSnapshot`; extracted OpenAI tone remains available from asset records and visible on asset detail pages.
- Preserved combo review `sourceVideoAssetId` and `sourceAudioAssetId` so source media and current source tone analyses can be reloaded when needed without caching source values on review records.

## [2026-07-10] behavior | review listing split

- Added `targetId` support to `GET /tone-reviews` so the API can query reviews for a specific audio/video/combo target partition.
- Updated `/review` to show only reviews for the currently loaded target at the bottom of the page.
- Converted `/combos` into the all-combo-review index, resolving source asset titles when available and linking records back into `/review`.

## [2026-07-10] fix | expired auth handling

- Expanded `apps/web` auth middleware coverage to Review, Combos, Combo detail, and same-origin API proxy routes.
- Middleware now detects expired JWT cookies, clears them, redirects page requests to login with the original path preserved, and returns JSON `401` for API calls instead of allowing server components to throw `Missing auth token`.
- Set Cognito web client ID/access token validity to 12 hours in `MediaManagerAuthStack`; silent refresh remains future work because the app does not persist refresh tokens.

## [2026-04-10] bootstrap | wiki initialized

- Created `wiki/` synthesized context layer with cross-linked pages.
- Added current state, architecture map, deploy/ops notes, recent changes, and open issues.
- Confirmed source-planning docs live under `raw_sources/`.

## [2026-04-10] infra | darenkeck custom-domain wiring hooks

- Added optional `MediaManagerDarenkeckSiteStack` env-driven custom-domain support (CloudFront alias + ACM cert) in `infra/cdk/lib/darenkeck-site-stack.ts`.
- Added optional Route 53 alias A/AAAA record management gated by `DARENKECK_SITE_MANAGE_DNS`.
- Documented new env vars in `infra/cdk/README.md` and rollout notes in `wiki/deploy-and-ops.md`.

## [2026-04-10] deploy | darenkeck-site no-op validation

- Ran `bun run deploy:darenkeck-site` with all `DARENKECK_SITE_*` vars unset after loading base `.env`.
- CloudFormation result: `MediaManagerDarenkeckSiteStack` reported `no changes`.
- Confirmed outputs remained unchanged (`darenkeck-site-prod`, distribution `EUQDAU6DH3BMC`, domain `d2fmm3qe2rclf2.cloudfront.net`).

## [2026-04-10] cutover | darenkeck.com moved to MediaManager distribution

- Deployed `MediaManagerDarenkeckSiteStack` with `DARENKECK_SITE_DOMAIN_NAME=darenkeck.com`, existing ACM cert ARN, and `DARENKECK_SITE_MANAGE_DNS=false`.
- CloudFront update completed and stack now outputs `DARENKECK-SITE-DOMAIN=darenkeck.com`.
- Updated Route 53 apex aliases (`A` and `AAAA`) to target `d2fmm3qe2rclf2.cloudfront.net` (change id `/change/C0013184Y38GFKB6W7DB`, status `INSYNC`).

## [2026-04-10] deploy | phase-3 DNS ownership migration complete

- Attempted CloudFormation import for Route 53 record sets, but `AWS::Route53::RecordSet` import is unsupported in this environment.
- Executed controlled delete-then-create takeover: removed manual apex `A/AAAA` aliases, then deployed `MediaManagerDarenkeckSiteStack` with `DARENKECK_SITE_MANAGE_DNS=true` and hosted zone id.
- Verified stack-managed resources `DarenkeckSiteAliasARecord` and `DarenkeckSiteAliasAaaaRecord` are `CREATE_COMPLETE` and apex still resolves to `d2fmm3qe2rclf2.cloudfront.net`.
- Persisted `DARENKECK_SITE_*` settings in local `.env` and confirmed follow-up `deploy:darenkeck-site` is `no changes`.

## [2026-04-10] release | monorepo v1.0.0 baseline

- Updated workspace/app/package manifest versions to `1.0.0` (`package.json`, `apps/*/package.json`, `packages/*/package.json`, `infra/cdk/package.json`).
- Confirmed `MediaManagerDarenkeckSiteStack` continues to deploy with no changes under stack-managed DNS settings.
- Updated wiki current/recent state to capture release readiness posture.
- Release validation checks passed: `bun run typecheck` and `bun run test:infra`.

## [2026-04-10] fix | streaming CORS for browser HLS playback

- Added CloudFront CORS response headers policy on `MediaManagerStreamingStack` default cache behavior in `infra/cdk/lib/streaming-stack.ts`.
- Added CloudFront origin request policy forwarding `Origin`, `Access-Control-Request-Method`, and `Access-Control-Request-Headers` for S3 preflight handling.
- Added stack security test coverage in `infra/cdk/test/stacks/security.test.ts` for streaming CORS policies.
- Deployed `MediaManagerStreamingStack` and verified:
  - `GET` HLS manifest now returns `Access-Control-Allow-Origin: *`.
  - `OPTIONS` preflight with `Access-Control-Request-Headers: range` returns `200` with CORS headers.

## [2026-04-10] debug | local playback diagnostics for Chrome/Firefox

- Added `onAudioElementChange` callback support to shared `ComboPlayer` in `packages/shared/src/combo-player.tsx`.
- Wired debug media element refs through `apps/darenkeck/src/components/SingleComboSlot.tsx`.
- Added DEV-only debug overlay in `apps/darenkeck/src/App.tsx` with controls for mute/unmute, volume slider, play/pause probe, sync audio to video, next combo trigger, and live media state snapshots.
- Verified compile/build with `bun run typecheck` and `bun run --cwd apps/darenkeck build`.

## [2026-04-10] fix | strict sync playback startup in Chrome

- Updated `packages/shared/src/combo-player.tsx` startup semantics so audio is mandatory for successful playback start; video is paused on any start failure.
- Added autoplay retry scheduling for transient `AbortError` startup failures to reduce first-load races without requiring user controls.
- Updated seek-resume path to reuse strict `startPlayback` flow instead of independently starting tracks.
- Added unmute-click fallback in `apps/darenkeck/src/App.tsx` to align audio to video time and request `play()` for both media elements in a user gesture.
- Verified compile/build with `bun run typecheck` and `bun run --cwd apps/darenkeck build`.

## [2026-04-10] fix | remove setState-in-render warning from ComboPlayer

- Refactored `packages/shared/src/combo-player.tsx` so `onPlaybackStateChange` is emitted from a `useEffect` on `phase` changes instead of inside `setPhase` updater.
- This eliminates React warning: `Cannot update a component (App) while rendering a different component (ComboPlayer)`.
- Verified with `bun run typecheck` and `bun run --cwd apps/darenkeck build`.

## [2026-04-10] refactor | remove ComboPlayer autoplay retry logic

- Removed autoplay retry loop/state from `packages/shared/src/combo-player.tsx` (`AUTOPLAY_RETRY_DELAYS_MS`, retry refs/timers, and retry scheduler).
- Simplified startup flow so autoplay attempts once; on failure the strict sync behavior still pauses both tracks (no background retry machinery).
- Verified with `bun run typecheck` and `bun run --cwd apps/darenkeck build`.

## [2026-04-10] behavior | defer audio playback until unmute interaction

- Updated `packages/shared/src/combo-player.tsx` so muted autoplay does not call `audio.play()`; autoplay now starts video-only while muted.
- Timeline authority is now dynamic by mute state (video while muted, audio while unmuted).
- Updated pause/wait/play signal handling to avoid follower-audio pauses forcing stalled state during muted video mode.
- Verified with `bun run typecheck` and `bun run --cwd apps/darenkeck build`.

## [2026-04-10] release prep | hide debug surfaces and bump 1.0.1

- Disabled local debug overlay rendering by setting `SHOW_LOCAL_DEBUG_CONTROLS=false` in `apps/darenkeck/src/App.tsx`.
- Set `ENABLE_COMBO_PLAYER_DEBUG_LOGS=false` in `packages/shared/src/combo-player.tsx`.
- Bumped workspace/package versions to `1.0.1` (`package.json`, `apps/*/package.json`, `packages/*/package.json`, `infra/cdk/package.json`) and updated `README.md` release status.

## [2026-04-11] deploy | darenkeck static prod update

- Ran `bun run deploy:darenkeck:prod` from repo root.
- Built `apps/darenkeck` in production mode and synced to `s3://darenkeck-site-prod`.
- Created CloudFront invalidation for distribution `EUQDAU6DH3BMC` (id `ID641RJ3EYBUDQ5UTOWHG370Q5`) and verified status `Completed`.

## [2026-04-11] deploy | remove .DS_Store from static site pipeline

- Updated `scripts/deploy-darenkeck-static.sh` to run `aws s3 sync` with `.DS_Store` excludes and to remove existing `.DS_Store` objects from the destination bucket.
- Redeployed prod via `bun run deploy:darenkeck:prod`; confirmed deletion of stale object (`s3://darenkeck-site-prod/.DS_Store`).
- Created CloudFront invalidation `I2RWPF93GYBEJAAO3IQT3HFNMY` and verified status `Completed`.

## [2026-04-11] planning | darenkeck mobile playback TODO capture

- Added high-priority follow-ups for mobile focus-loss and native play/pause handling in `wiki/open-issues.md`.
- Added playback watchlist item for interruption-path state transitions (`visibilitychange`, app switch, screen lock, native media controls).

## [2026-06-22] tooling | opencode branch command

- Added repo-local opencode slash command `/open-branch` in `.opencode/commands/open-branch.md`.
- Command workflow checks dirty worktree state, derives `<type>/<slug>` branch names, rejects duplicate local/remote branches, and creates the branch with `git switch -c`.

## [2026-06-23] planning | tone embedding app plan

- Added root-level `TONE_EMBEDDING_APP_PLAN.md` for the proposed standalone tone embedding/training-data app.
- Moved exploratory tone-based audio/video markdown files into `raw_sources/` as source material.

## [2026-06-23] tooling | devflow MCP config

- Added repo-local opencode MCP server config at `.opencode/opencode.json`.
- Configured `devflow` to run from `/Users/daren/darenkeck-dev/devflow-mcp` via `uv run --directory ... devflow-mcp`.

## [2026-06-23] app | tone embedding skeleton

- Added `apps/tone-embedding/` Python app skeleton for manifest validation, executable preprocessing, placeholder tone extraction, congruence scoring, and JSONL training-row export.
- Added unit and CLI smoke-test coverage for the first implementation slice.
- Added optional Essentia audio adapter scaffolding for music valence/arousal extraction and expanded model-stack guidance in `TONE_EMBEDDING_APP_PLAN.md`.
- Added `scripts/setup-essentia-models.sh` to download ignored Essentia model artifacts for local tone extraction tests.
- Added `scripts/run-essentia-audio-test.sh` and `docs/audio-tone-extraction.md` for Docker-based Essentia test runs and expected output shape.
- Added dev-only tone-to-words descriptors to exported rows for quick audio/video tone verification.
- Added a reusable local Essentia Docker smoke-test image to avoid reinstalling `essentia-tensorflow` on every run.

## [2026-06-24] tooling | audio test covers two demo files

- Updated `apps/tone-embedding/examples/manifest.example.json` to reference `audio-demo-00.mp3` and `audio-demo-01.mp3` as separate audio assets paired with the sample video.
- Updated `apps/tone-embedding/scripts/run-essentia-audio-test.sh` to require both audio demos and default host-visible JSONL output to `apps/tone-embedding/tests/output/tone-training-essentia.jsonl`.
- Git-ignored `apps/tone-embedding/tests/output/` and refreshed the audio extraction docs/readme references.
- Cached Essentia TensorFlow predictor objects per adapter instance so batch extraction does not reload graph files for each audio asset.
- Restructured default extraction around per-asset analysis rows; combo congruence is deferred to a later combo-evaluation layer.
- Added root `AUDIO_TONE_MODEL_RUNBOOK.md` explaining Essentia/TensorFlow setup, invocation, audio loading, score normalization, and output shape with code links.
- Added initial OpenCLIP video tone adapter, video-only example manifest, Docker smoke-test script, and video extraction runbook.
- Updated the OpenCLIP video test manifest/script to process `video-demo-00.m4v` and `video-demo-01.m4v` as separate asset analysis rows.
- Added initial DINOv2 video embedding adapter, Docker smoke-test script, and runbook for visual embedding extraction.
- Updated local video Dockerfiles to install CPU-only PyTorch wheels and avoid CUDA package disk exhaustion.
- Added CPU-only `torchvision` to the DINOv2 test image because `transformers.AutoImageProcessor` requires it.
- Restructured asset extraction output into asset analysis rows with `modelRuns`, aggregate `tone` only for tone models, and `embeddings` for DINOv2.
- Added combined video analysis test script that runs OpenCLIP and DINOv2 and merges their outputs into upload-style asset analysis rows.
- Added tone bundle creation with bundle-relative embedding paths and `bundle create/inspect/extract` CLI commands.
- Expanded `TONE_EMBEDDING_APP_PLAN.md` Step 5 with remaining video tone/embedding work and acceptance criteria.
- Updated tone bundle behavior to produce one bundle per asset instead of grouped multi-asset bundles.
- Added extraction parameters to asset analysis `modelRuns[]` for OpenCLIP, DINOv2, and Essentia model runs.
- Verified tone embedding script syntax for Essentia/OpenCLIP/DINOv2/combined video scripts and reran unit tests (`25` passed, `1` optional NumPy skip).
- Verified placeholder single-asset bundle create/inspect/extract preserves `modelRuns[].parameters`.
- Added SigLIP video prompt-pair scoring and Qwen-VL scene-tone extraction adapters, Docker smoke scripts/images, CLI options, combined pipeline merge support, and docs/plan updates for the stronger video analysis stack.
- Updated SigLIP scoring to use positive-vs-negative raw logit deltas instead of sigmoid probability deltas, avoiding near-zero score collapse from probability compression.
- Updated SigLIP scoring again to apply `tanh(delta / 4.0)` soft clamping so extreme logit deltas remain bounded without immediately saturating at `-1` or `1`.
- Reworked dev-only `tone_to_words()` from quadrant-first labels to ranked descriptor selection across all tone dimensions so strong cold/unstable/menacing/etc. dimensions can drive summaries.
- Added `apps/tone-embedding/docs/tone-terms.md` to define tone dimensions, descriptors, output groups, thresholds, examples, and caveats for dev-facing tone words.
- Tuned the Qwen-VL Docker smoke path for local feasibility: default 2B model, 1 sampled frame, 96 generated tokens, automatic dtype/device mapping with possible offload, disabled mkldnn in the Qwen adapter, and a persistent Hugging Face cache under ignored test output.
- Tightened the Qwen-VL prompt/decoder for JSON-only output, switched generation to deterministic `do_sample=False`, raised the local smoke token budget to 192, and added response previews to non-JSON parse errors.
- Changed Qwen-VL from JSON score generation to freeform qualitative descriptor output only; added deterministic `structured_descriptors_to_tone()` for the later structured-output model stage.
- Added native macOS MPS support for Qwen-VL via `--qwen-device-map mps` and `scripts/run-qwen-vl-mps-test.sh`, keeping Docker as CPU correctness smoke only.
- Simplified native Qwen/MPS setup with a `qwen-mps` optional dependency extra and updated the MPS runner to use `uv run --extra qwen-mps`.
- Added an OpenAI video tone adapter that requests structured descriptor scores, maps them into tone vectors deterministically, and keeps the provider isolated behind `--video-model openai` plus an `openai` optional dependency extra.
- Added `python-dotenv` to OpenAI/video extras, automatic `.env`/`.env.local` loading in the tone CLI, and `apps/tone-embedding/.env.example` for local OpenAI API key setup.
- Updated the OpenAI video tone adapter default model to `gpt-5`.
- Updated descriptor-score conversion so canonical dimensions are derived from descriptor words; provider-supplied dimensions are advisory metadata to tolerate OpenAI/Gemini variance.
- Added a tone-plan follow-up for OpenAI audio descriptor generation, including audio/video output-shape alignment and future combo delta tracking support.
- Implemented OpenAI audio descriptor generation with the shared `tone-descriptor-scores/v1` schema and deterministic descriptor-to-tone mapping.
- Updated OpenAI audio extraction to default to `gpt-audio` and use prompt-enforced JSON because `gpt-audio` accepts audio through Chat Completions but does not support strict structured outputs.
- Updated the OpenAI audio request to include the documented Chat Completions audio fields (`modalities`, `audio`, and `input_audio`) so `gpt-audio` receives the attached file.
- Updated OpenAI audio response parsing to read JSON from `message.audio.transcript` when `message.content` is empty.
- Added initial V1 combo analysis over existing asset analysis rows, computing audio/video `deltaTone`, `absDeltaTone`, `interactionTone`, descriptive congruence/contrast/intensity, strongest matches/contrasts, and a delta-heavy nearest-neighbor vector without producing combo quality or meaning judgements.
- Added `apps/tone-embedding/docs/combo-scoring-system.md` documenting the V1 combo-analysis shape, scoring definitions, nearest-neighbor vector layout, and future V2 user-input/training path.
- Removed stale direct combo/training-row language from the tone plan and deleted the unused `build_training_rows()` helper so the app language consistently uses asset analysis first and separate `combo-analysis/v1` rows later.
- Added `asset-analysis/v1` row versioning, bundle `analysisSchemas`, and `apps/tone-embedding/docs/media-manager-invocation.md` to define the V1 external invocation contract for Media Manager-managed jobs.
- Updated the combined video analysis script to use native Qwen-VL MPS by default and leave the Docker CPU Qwen path as a standalone smoke test only.
- Simplified the primary V1 video analysis run to OpenAI semantic+tone metadata plus DINOv2 embeddings; OpenCLIP, SigLIP, and Qwen-VL remain standalone experimental adapters.
- Expanded OpenAI audio analysis to emit `audio-semantic-tone/v1` metadata with semantic audio description fields plus descriptor scores for tone.
- Updated OpenAI audio analysis to use `gpt-audio` for natural-language audible metadata and always use `OPENAI_AUDIO_STRUCTURE_MODEL` (`gpt-5` by default) for strict JSON and calibrated descriptor values.

## [2026-07-01] docs | primary tone pipeline README

- Added `apps/tone-embedding/scripts/run-audio-analysis-test.sh` as the generic primary audio analysis runner, matching the existing primary video runner naming and producing per-asset bundles.
- Rewrote `apps/tone-embedding/README.md` to lead with primary audio/video pipeline usage, V1 output artifacts, manifest shape, direct CLI examples, environment variables, combo analysis, and experimental/model-specific runs later.
- Verified `bash -n` for primary audio/video runners, unit tests (`43` passed, `1` optional skip), and Python compile checks for `apps/tone-embedding/src`.

## [2026-07-01] cli | Python-native tone workflows

- Added `tone_embedding.workflows` helpers for single-file audio/video analysis, combined multi-model video analysis rows, direct combo analysis from audio/video analysis files, and JSON/JSONL analysis IO.
- Added `tone_embedding.neighbors` with local cosine-similarity top-k lookup over existing `nearestNeighborVector` values for development verification.
- Extended the CLI with `analyze audio`, `analyze video`, `combo build`, and `neighbors query` while preserving existing manifest extraction, bundle, and combo analyze commands.
- Added `apps/tone-embedding/VECTOR_DB_PREP_PLAN.md` to document the future backend-agnostic vector DB boundary and non-goals.
- Updated `apps/tone-embedding/README.md` with prerequisites and uv-first CLI examples, then made the README app-relative so it can move with `apps/tone-embedding` as a standalone repo. CLI examples now use `uv sync --no-editable`, then `uv run --no-editable ...`.
- Added packaged `tone-taxonomy/v1` data for descriptor keywords, dimension mappings, strength labels, and avoid rules; `tone.py` now derives descriptor behavior from that taxonomy and asset/combo rows record `toneTaxonomyVersion`.
- Updated CLI readiness for conversion-job use: `uv sync --no-editable` now documents and validates the `tone-embedding` console command without `PYTHONPATH`, schema contract fixtures were added for `asset-analysis/v1` and `tone-taxonomy/v1`, and the README/Media Manager invocation docs include exact production commands while leaving container implementation for review.
- Switched `--models primary` to OpenAI-only and updated README/Media Manager/video pipeline docs plus primary audio/video scripts for Lambda-first analysis. DINOv2 remains available as an explicit opt-in embedding adapter outside the primary path.

## [2026-07-06] validation | real OpenAI tone smoke

- Generated ignored local audio/video smoke fixtures under `apps/tone-embedding/examples/media/` and ran real OpenAI audio and primary video analysis.
- Created and inspected per-asset `.tonebundle.tar.gz` files for both smoke outputs.
- Fixed the OpenAI extra to include `numpy` for OpenCV frame sampling and updated bundle creation to accept the single JSON object shape emitted by direct `analyze audio/video` commands.

## [2026-07-06] packaging | tone CLI help and no-editable docs

- Standardized tone app docs on `uv run --no-editable ...` because editable console-script behavior is unreliable after switching install modes.
- Removed the stale `apps/tone-embedding/TODO.md` item and replaced it with explicit no-editable command guidance in the README/docs.
- Improved CLI help output with command descriptions, clearer positional metavars, examples, and complete option help.

## [2026-07-06] infra | tone analysis upload integration

- Added optional `toneAnalysis` metadata to asset records for OpenAI primary tone artifacts and status tracking.
- Added a separate tone-analysis SQS queue/DLQ and tone-analysis worker fed by originals S3 object-created events.
- Worker reads the OpenAI API key from SSM `SecureString`, analyzes original audio/video assets via the tone CLI, writes analysis/bundle artifacts to the derived bucket, and updates `toneAnalysis` without changing top-level asset readiness.
- Verified with `bun run typecheck`, `bun run test:infra`, `bun run --cwd infra/cdk build:lambda`, and `bun run build`.

## [2026-07-07] deploy | tone analysis processing stack

- Deployed `MediaManagerProcessingStack` with the initial tone-analysis container image Lambda, SQS queue/DLQ, EventBridge fan-out target, and IAM permissions.
- Verified live Lambda configuration uses `/media-manager/<stage>/openai-api-key`, `media-originals-<stage>`, and `media-derived-<stage>`.
- Verified `media-manager-originals-object-created` now targets both `media-manager-upload-events` and `media-manager-tone-analysis`.
- Clarified docs that EventBridge is the shared upload-event router and SQS provides separate durable work queues for conversion and tone analysis.

## [2026-07-07] web | expose async processing states

- Updated the Media Manager web UI so library and folder asset cards show both conversion and tone-analysis state.
- Updated asset details to show tone status, profile, artifact S3 paths, and errors, and to keep polling while tone analysis is queued/processing.
- Verified with `bun run typecheck` and `bun run --cwd apps/web build`.

## [2026-07-07] package | tone-core TypeScript foundation

- Added `packages/tone-core` as a Bun/TypeScript workspace package for Lambda-native tone analysis while keeping the Python `apps/tone-embedding` CLI unchanged.
- Ported v1 tone taxonomy, descriptor-to-tone mapping, tone word generation, combo scoring/vector layout, and nearest-neighbor helpers.
- Added OpenAI audio/video analysis entrypoints and direct `ffmpeg` frame extraction via `child_process.spawn`, with an optional local CLI for smoke tests.
- Verified with `bun run typecheck`, `bun run test`, and `bun run build`.

## [2026-07-07] infra | tone worker moved to tone-core

- Replaced the integrated Python/uv tone worker implementation with a bundled Node Lambda that imports `@media-manager/tone-core` directly.
- Removed the tone-analysis Dockerfile/build-context staging path from CDK; `build:lambda` now bundles tone analysis as a normal Node artifact.
- Added `FFMPEG_PATH` support for video frame extraction and optional `FFMPEG_LAYER_ARN` attachment for a Lambda ffmpeg layer.
- The Node worker currently writes `asset-analysis.json`; `.tonebundle.tar.gz` generation is deferred until bundle creation is ported into `tone-core`.

## [2026-07-07] deploy | node tone worker with ffmpeg layer

- Built an account-local ffmpeg-only Lambda layer from the static Linux x86_64 ffmpeg release, published as `<your ffmpeg layer arn>`.
- Deployed `MediaManagerProcessingStack` with `FFMPEG_LAYER_ARN` set to that layer ARN.
- Verified live tone worker `MediaManagerProcessingSta-ToneAnalysisWorkerFuncti-Voz3eWjvMUQ6` is `PackageType=Zip`, `Runtime=nodejs22.x`, `Handler=index.handler`, `FFMPEG_PATH=/opt/bin/ffmpeg`, and has the ffmpeg layer attached.

## [2026-07-07] fix | tone worker DynamoDB key and smoke test

- Fixed the Node tone worker to read/update asset records using the live table key shape `{ pk: ASSET#<id>, sk: META }` instead of `{ id }`.
- Added focused Lambda test coverage for tone-analysis DynamoDB key usage.
- Redeployed `MediaManagerProcessingStack` with the fixed worker and the same ffmpeg layer.
- Ran a live prod audio smoke with temporary asset `tone-smoke-20260707-node-audio`; the worker returned `processed=1`, wrote `asset-analysis.json`, and updated `toneAnalysis.status=ready`.
- Removed the temporary smoke DynamoDB record plus originals/derived S3 objects after verification.

## [2026-07-07] validation | node tone worker demo media smoke

- Ran live Node Lambda tone-analysis smokes against the original Python tone demo clips from `apps/tone-embedding/examples/media/`.
- Audio clips verified: `audio-demo-00.mp3`, `audio-demo-01.mp3`.
- Video clips verified: `video-demo-00.m4v`, `video-demo-01.m4v`; this exercised the deployed ffmpeg Lambda layer for frame extraction.
- All four temporary assets returned `processed=1`, reached `toneAnalysis.status=ready`, and wrote `derived/<assetId>/tone/asset-analysis.json`.
- Removed all temporary smoke DynamoDB records plus staged originals and derived tone artifacts; processing queues and DLQs were clear afterward.

## [2026-07-07] feature | asset audit log trail

- Added `asset.auditLog` contract metadata with bounded public-safe entries: timestamp, category, level, message, source, code, and primitive details.
- Added `infra/cdk/lambda/shared/asset-audit-log.ts` as the shared Node Lambda helper for appending and bounding audit entries.
- Wired initial log points into asset creation, upload URL/multipart init/upload confirmation, upload-trigger conversion queue/submission/passthrough/failure, MediaConvert status updates, and tone-analysis start/skip/ready/failure.
- Added an Activity Log section at the bottom of the Media Manager asset detail UI.

## [2026-07-07] deploy | audit log backend updates

- Deployed `MediaManagerApiStack` with audit-log-capable `api-assets` and `api-asset-by-id` lambdas.
- Deployed `MediaManagerProcessingStack` with audit-log-capable `upload-trigger`, `mediaconvert-status`, and `tone-analysis` lambdas, preserving ffmpeg layer `<your ffmpeg layer arn>`.
- Post-deploy checks passed: public API health returned `200`, upload/tone queues were empty, tone DLQ was empty, and updated lambdas reported fresh `LastModified` timestamps.
- `apps/web` audit-log UI was built locally but not published from this repo because no web deploy script, CDK web stack, `.vercel` link, or local Vercel CLI was available.

## [2026-07-07] feature | display tone on asset detail

- Extended `asset.toneAnalysis` with display-ready tone fields: summary, primary/secondary/avoid words, scores, semantic summary, caption, and mood.
- Updated the Node tone-analysis Lambda to copy display fields from `AssetAnalysis` into asset metadata when tone analysis reaches `ready`.
- Added an asset detail Tone Analysis section with summary, badges, score bars, and semantic notes so the UI does not need to fetch or unpack derived artifacts for normal display.

## [2026-07-08] fix | backfill tone display fields

- Deployed `MediaManagerApiStack` and `MediaManagerProcessingStack` so API reads and new tone analyses use the display-ready `toneAnalysis` fields.
- Added `bun run --cwd infra/cdk backfill:tone-analysis-display` to hydrate ready analyses that predated display-field writes.
- Ran the prod backfill for two affected assets; both now have `summary`, `primaryWords`, and `scores` in `toneAnalysis`, and the follow-up dry run reports zero missing display fields.

## [2026-07-08] fix | tone score chart bounds

- Updated the asset detail Tone Analysis score bars to clamp signed values to `[-1, 1]` and render as zero-centered bipolar bars that cannot overflow their track.

## [2026-07-08] research | tone taxonomy v2 brief

- Added a research brief for another agent to review affective norm literature and propose `tone-taxonomy/v2` keyword and weighted mapping changes while keeping OpenAI output keyword-based.

## [2026-07-08] feature | tone taxonomy v2 implementation

- Implemented `tone-taxonomy/v2` in `packages/tone-core` with 11 added descriptors, weighted multi-dimension descriptor mappings, and dominance defined as perceived potency/force/scale.
- Updated descriptor scoring to sum `strengthValue * mappingWeight` contributions by dimension and clamp final tone vector values to `[-1, 1]`.
- Updated schemas/contracts so new analyses emit `tone-taxonomy/v2` while parsers accept existing `tone-taxonomy/v1` artifacts.
- Verified with `bun run typecheck`, `bun run test`, `bun run --cwd infra/cdk build:lambda`, and `bun run build`.

## [2026-07-08] deploy | tone taxonomy v2 backend

- Deployed `MediaManagerApiStack` and `MediaManagerProcessingStack` with `tone-taxonomy/v2` support.
- Preserved ffmpeg layer `<your ffmpeg layer arn>` on the tone-analysis Lambda.
- Post-deploy checks passed: public API health returned `200`, tone queue was empty, tone DLQ was empty, and the tone worker reported a fresh `LastModified` timestamp.

## [2026-07-08] docs | release roadmap in README

- Replaced the stale root README with a concise repo overview, current state, common commands, and the roadmap to the next release milestone: collecting user input on combos.

## [2026-07-08] web | library list view and bulk delete

- Added a reusable `LibraryAssetBrowser` for library and folder child views with grid/list toggle, multi-select, select-all, and bulk delete through existing per-asset DELETE routes.
- Updated the README roadmap to mark list view and initial bulk delete support as started.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.

## [2026-07-08] web | media manager layout cleanup

- Removed the redundant top-nav `Library` link because breadcrumbs and the `Media Manager` header already link back to the library.
- Moved folder-child creation beside the folder name/edit/delete card on folder detail pages.
- Replaced text-only asset type labels in library/folder browsers with icons for audio, video, image, and folder assets.
- Verified with `bun run --cwd apps/web build` and a sequential `bun run --cwd apps/web typecheck` rerun after the known `.next/types` race.

## [2026-07-08] web | context-aware add menu

- Replaced direct create-folder surfaces with a compact `+` add menu that offers `Folder` and `Media upload` actions.
- Folder creation now opens a compact dialog and creates folders in the active root/folder context.
- Removed the top-nav `Upload` link; media upload is now reached through the contextual add menu.
- `/upload?containerId=<folderId>` now defaults the upload destination to the active folder, preserving context from library/folder views.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.

## [2026-07-08] web | remove library filters

- Removed the Media Manager library filter form and related page-level parsing for type, facet, origin, and sort filters.
- Library now loads the current root/folder asset set directly; backend/frontend API filter support remains available for internal folder pickers until filtering is redesigned.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.

## [2026-07-08] web | breadcrumb asset titles

- Updated breadcrumbs to resolve asset/folder IDs through the local asset API and display titles instead of raw IDs for asset pages and library folder context.
- Wrapped app-shell breadcrumbs in `Suspense` because the breadcrumb component now reads search params.
- Verified with `bun run --cwd apps/web build` and `bun run --cwd apps/web typecheck`.

## [2026-07-08] web | library list default and folder rows

- Changed the Media Manager library browser to default to list mode, with grid mode available through `view=grid`.
- Updated folder rows/cards to link into folder contents and omit asset-only status, conversion, tone, and source-count fields.

## [2026-07-08] feature | generic jobs and recursive delete

- Added shared contracts for generic asset jobs, previews, progress, and job status records.
- Added backend job APIs for preview/create/status and an API-owned `media-manager-bulk-actions` SQS queue.
- Added a processing `jobs-worker` that handles `delete_assets` jobs by recursively expanding selected folders through the container GSI and deleting deepest descendants first.
- Added web job proxy routes, reusable recursive delete confirmation dialog, and a bottom progress bar that polls active jobs.

## [2026-07-09] fix | job creation DynamoDB marshalling

- Fixed `api-jobs` and `jobs-worker` DynamoDB document clients to remove undefined values before marshalling nested job preview/progress data.
- Deployed `MediaManagerApiStack` and `MediaManagerProcessingStack` with the fix.
- Verified with a live folder-only recursive delete smoke: preview found two temporary folders, create returned `202`, worker completed the job, temporary records were removed, and bulk-actions queues/DLQ were empty.

## [2026-07-09] feature | queued tone and conversion reprocessing jobs

- Extended generic asset jobs with `reprocess_tone` and `reprocess_conversion` job types.
- Reprocessing jobs expand selected folders, mark unsupported items as skipped in preview, and queue existing tone/upload processing workers rather than doing media work inline.
- Added conversion profile selection for conversion reprocessing and manual status refresh controls in library and asset detail status areas.

## [2026-07-09] fix | normalize audio before OpenAI tone analysis

- Added `tone-core` audio normalization that transcodes source audio to a deterministic MP3 file with ffmpeg before OpenAI `input_audio` submission.
- Wired the tone-analysis Lambda to pass `FFMPEG_PATH` for audio normalization, matching the existing video frame extraction path.
- Added focused `tone-core` test coverage for the normalization command/output path.

## [2026-07-09] deploy | audio normalization processing smoke

- Deployed `MediaManagerProcessingStack` with audio normalization in the tone-analysis worker.
- Fixed processing stack ffmpeg-layer wiring so the account-local `media-manager-ffmpeg:1` layer is attached by default unless `FFMPEG_LAYER_ARN` overrides it.
- Verified live tone worker has `FFMPEG_PATH=/opt/bin/ffmpeg` and layer `<your ffmpeg layer arn>` attached.
- Requeued previously failing asset `ff2fde86-978e-4a7f-8c49-5a8025930ad6` (`audio/x-m4a`); it completed with `toneAnalysis.status=ready` and `tone-taxonomy/v2`.

## [2026-07-09] web | hide media asset lineage panel

- Removed the generic Lineage Context card from media asset detail pages because normal uploaded assets usually have no source/child relationships and the UI was folder-schema noise.
- Stopped fetching asset lineage and children for non-folder asset detail pages; folder detail pages still fetch and render child assets.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.

## [2026-07-09] web | asset move folder tree dialog

- Removed the media asset page `Nested Location` card.
- Added a move icon button next to `Edit` on asset detail pages; it opens a reusable move dialog with root selection and expandable folder tree navigation.
- The dialog supports selecting root or a folder and confirms through the existing `/assets/{id}/move` route; the component is structured around asset count and confirm callback so it can be reused for bulk moves.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.

## [2026-07-09] web | move dialog layout polish

- Tightened move dialog padding, centered folder row controls vertically, and added nested guide indentation for expanded folder levels.
- Verified with `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`.

## [2026-07-10] feature | tone review capture first slice

- Added shared tone review contracts for `audio`, `video`, and `combo` targets with human keywords, signed tone scores, and optional notes.
- Added authenticated `POST /tone-reviews` API handling in the combos Lambda; it validates target ownership/type and stores target-centered review records in DynamoDB without raw reviewer email.
- Added a reusable Media Manager tone review panel and wired it into standalone audio/video asset pages and combo detail pages.
- Combo detail pages can submit reviews for the combo, just the video source, or just the audio source.
- Added `TONE_REVIEW_PLAN.md` for the layered base mapping, human calibration, and local personalization approach.
- Verified with `bun run typecheck`, `bun run --cwd infra/cdk test`, `bun run --cwd infra/cdk build:lambda`, and `bun run build`.

## [2026-07-10] web | dedicated review tab

- Added `/review` as a Media Manager tab for combo-first tone review work.
- The review page loads a saved combo with playback, a sidebar queue of combos, and target switching between combo, video, and audio.
- Added keyword chip selection while keeping tone score sliders and `POST /tone-reviews` submission wiring available.

## [2026-07-10] web | random review queue and review listing

- Updated `/review` to default to `GET /public/combos/random` when no combo id is selected, matching the public site style of random combo review.
- The review workbench starts combo playback muted/autoplay and sends source video/audio asset ids with combo review submissions.
- Added `GET /tone-reviews` contracts, API route, web proxy/helper, and a paginated reviewed-combo sidebar backed by the review-source GSI.
- Verified with `bun run typecheck`, `bun run --cwd infra/cdk test`, `bun run --cwd infra/cdk build:lambda`, and `bun run build`.

## [2026-07-10] deploy | api tone review routes

- Deployed `MediaManagerApiStack` with tone review route updates.
- CloudFormation created `GET /tone-reviews` and `POST /tone-reviews` API Gateway routes and updated the API Lambda functions.
- API output remains `https://adenvmeabg.execute-api.us-west-2.amazonaws.com`.

## [2026-07-10] web | review keyword tree and slider guidance

- Updated the Review workbench keyword input from flat extracted chips to a 3-level broad-to-specific emotion tree covering joy, calm, intimacy, sadness, fear, anger, power, mystery, beauty, strangeness, and menace regions.
- Added hover/focus descriptions to keyword tree nodes and tone score slider info icons so reviewers can understand exactly what each descriptor applies to.
- Model-extracted keywords remain available as optional suggestions, while human-selected keywords start empty for each target.

## [2026-07-10] web | review media target switching

- Refactored `/review` around one active review target at a time: random combo by default, or a fresh random ready audio/video asset when switching target type.
- Moved the Combo/Audio/Video switch into the reviewer card header next to the target title.
- Added a large framed review media surface: combos reuse shared `ComboPlayer` background mode, videos use the same cover/center/scale treatment, and audio gets a focused visual panel.
- Muted-first playback remains the default; combo mode uses the shared darenkeck-style overlay mute button, and single audio/video modes use a matching overlay toggle.

## [2026-07-10] web/api | review header switch and full asset random pool

- Moved the Review Combo/Audio/Video switch into the page header, aligned right of the `Review` title.
- Added `scope=all` support to `GET /assets` so authenticated review asset selection can draw from all owned media, including assets nested inside folders.
- Updated random audio/video review selection to use the full owned asset pool and avoid the misleading `No ready video assets` state when reviewable nested videos exist.
- Verified with `bun run typecheck`, `bun run --cwd infra/cdk test`, `bun run --cwd infra/cdk build:lambda`, and `bun run build`.

## [2026-07-10] web | review single asset playback

- Updated Review audio/video modes to render the existing asset detail `AssetPlayer` instead of the custom review media surface.
- Combo mode still uses shared `ComboPlayer` background mode with the darenkeck-style overlay mute control.
- Tightened random video review selection to choose videos that the normal asset detail player can render (`status=ready` with HLS stream metadata).

## [2026-07-10] deploy | api asset scope all

- Deployed `MediaManagerApiStack` with the `GET /assets?scope=all` Lambda update for review audio/video random selection.
- CloudFormation updated `AssetsFunction`; API output remains `https://adenvmeabg.execute-api.us-west-2.amazonaws.com`.

## [2026-07-10] web | review full-width player layout

- Updated the Review workbench to use a full-width media player/reviewer flow instead of a two-column layout.
- Moved Review Queue and Reviewed Combos into below-player sections.
- Raised the shared combo background mute toggle z-index to match the darenkeck overlay behavior so it remains visible in the Review page.

## [2026-07-10] web | review next target control

- Added a `Next` button to the Review header that reloads the current target type and fetches a fresh random combo, audio asset, or video asset.

## [2026-07-10] shared | combo mute control anchored to player

- Updated the shared background `ComboPlayer` built-in mute control to use the darenkeck visual treatment while anchoring it absolutely inside the player instead of fixing it to the viewport.

## [2026-07-10] shared | combo pause and replay overlay

- Added background `ComboPlayer` click-to-pause behavior while playing.
- When paused or ended, the player dims the video and shows a centered play button; clicking play resumes from the current position when paused or restarts from the beginning after timeline end.

## [2026-07-10] web | compact tone selection overlay

- Reduced the Review tone roots from eleven regions to six compact roots: Positive, Calm/Tender, Sad/Longing, Fear/Suspense, Anger/Tension, and Power/Strange/Dark.
- Moved tone keyword selection onto the media surface as a transparent overlay with rows of buttons.
- Root buttons switch active branches; child nodes with children navigate deeper; final leaf keywords toggle selection without showing separate back, clear, selected-chip, or model-suggestion sections.
- Removed the tone overlay background container; tone buttons now stand alone, default to no root selected, and sit alongside the combo mute/unmute control.
