# PLAN

## Milestone 1 - App Foundation

### Goals

- Create a new mobile-first app at `apps/darenkeck`.
- Establish baseline routing, layout, and environment configuration.
- Reuse monorepo shared packages and conventions.

### Tasks

- Scaffold Next.js app workspace and scripts.
- Add shared dependencies (`@media-manager/shared`, `@media-manager/contracts` as needed).
- Add `.env` expectations for combo API URL and public runtime config.
- Add initial homepage route and basic app shell.

### Acceptance Criteria

- App boots locally with `bun run dev` filtered to `darenkeck`.
- App builds and typechecks cleanly in Turborepo.

## Milestone 2 - Core Experience (Background Combo + Collapsible Bulletin)

### Goals

- Make `ComboPlayer` the full-screen background.
- Add a compact foreground bulletin card with quick bio and links.
- Keep UI mobile-first and collapse/expand capable.

### Tasks

- Integrate `ComboPlayer` from `@media-manager/shared` as fixed background layer.
- Build bulletin card with:
  - short profile blurb,
  - primary links (music, articles, social),
  - collapse/expand toggle.
- Ensure touch-friendly controls and safe-area spacing.
- Add reduced-motion and loading/error states.

### Acceptance Criteria

- Background combo plays and loops behind content.
- Bulletin is readable, collapsible, and usable on mobile.
- Desktop layout remains clean without breaking mobile behavior.

## Milestone 3 - Combo Data Integration

### Goals

- Load combos from existing media-manager APIs.
- Support initial combo load and resilient fallback behavior.

### Tasks

- Implement app-local combo API client for read endpoints.
- Wire homepage to load an initial combo and pass sources to `ComboPlayer`.
- Add retry/fallback handling for fetch and playback URL errors.
- Add simple loading state until first combo is ready.

### Acceptance Criteria

- App can render and play a combo using existing API endpoints.
- Failures are handled gracefully with user-facing fallback messaging.

## Milestone 4 - Random Combo Rotation

### Goals

- Add random combo fetch behavior for continuous discovery.
- Keep transitions smooth and responsive.

### Tasks

- Implement random selection strategy (API-backed or client random from fetched pool).
- Preload/queue next combo to reduce transition delays.
- Add manual "next combo" action for testing and user control.
- Prevent immediate repeats when possible.

### Acceptance Criteria

- Random combo changes work reliably on mobile and desktop.
- Combo transitions do not visibly stall the experience.

## Milestone 5 - Public Voting (Safe Writes)

### Goals

- Allow public voting without account sign-in.
- Reduce abuse risk with layered protections.

### Tasks

- Add vote UI (up/down or equivalent) with optimistic feedback.
- Add human check (Turnstile/reCAPTCHA) before write.
- Enforce server-side protections:
  - rate limiting,
  - idempotency key,
  - per-IP/per-combo cooldown.
- Add abuse/failure telemetry and logs.

### Acceptance Criteria

- Public users can vote successfully through protection flow.
- Repeated/automated abuse attempts are rate-limited or blocked.
- Vote writes remain stable under normal traffic.

## Milestone 6 - Production Hardening + Launch

### Goals

- Prepare for public traffic and reliable operations.
- Finalize content and launch readiness.

### Tasks

- Add observability dashboards/alerts for combo fetch and vote endpoints.
- Run performance pass (mobile network conditions, image/video loading behavior).
- Finalize bulletin content and link destinations.
- Verify SEO basics and social metadata.
- Document deploy/runbook notes.

### Acceptance Criteria

- Build, deploy, and runtime checks pass.
- Core user journey (load -> watch -> expand/collapse -> vote -> next combo) is stable.
- Launch checklist is complete.
