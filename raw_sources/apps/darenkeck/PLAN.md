# darenkeck Plan

1. Scaffold `apps/darenkeck` as a frontend-only Vite + React + TypeScript app in the monorepo.
2. Add workspace scripts (`dev`, `build`, `typecheck`, `lint`) and wire `turbo` filters similar to other apps.
3. Set up shared styling baseline (global CSS, tokens, fonts) and port the current landing content structure.
4. Port reusable UI pieces first (profile header, links section, bulletin section) with matching visuals.

## Phase 1: Player foundation (no slots/preload complexity)

5. Integrate the core combo player component that will eventually live inside a slot (treat this as the primary deliverable first).
6. Keep loading behavior intentionally simple: maintain one active player only.
7. On combo timeline end, fetch one new random combo and replace the current combo.
8. Add focused debug logging/HUD for basic lifecycle events only (loaded, ready, ended, next-fetch start/success/fail).
9. Validate this single-player flow in Chrome and Safari and smooth out basic playback mechanics.

## Phase 2: Deployment and cutover

10. Set deployment target as static S3 + CloudFront with separate staging and production distributions/buckets.
11. Define environment configuration for each deploy mode (`.env.staging`, `.env.production`) with `VITE_COMBO_API_BASE_URL`.
12. Add and validate environment-specific build commands for staging and production (`vite --mode staging|production`).
13. Create deployment runbook for `dist` upload + CloudFront invalidation + smoke checks.
14. Run final parity review against current `apps/darenkeck`, then prepare rename/cutover by removing `-v2`.

## Phase 3: Slots and preloading (separate problem)

15. Design and introduce slot orchestration (`slotList`) only after Phase 1 is stable.
16. Add queued-slot preloading and slot-to-slot swap behavior.
17. Validate long-running behavior (no stuck states, no dropped transitions) and tune Safari performance.
