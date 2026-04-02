# darenkeck-v2 Plan

1. Scaffold `apps/darenkeck-v2` as a frontend-only Vite + React + TypeScript app in the monorepo.
2. Add workspace scripts (`dev`, `build`, `typecheck`, `lint`) and wire `turbo` filters similar to other apps.
3. Set up shared styling baseline (global CSS, tokens, fonts) and port the current landing content structure.
4. Port reusable UI pieces first (profile header, links section, bulletin section) with matching visuals.

## Phase 1: Player foundation (no slots/preload complexity)

5. Integrate the core combo player component that will eventually live inside a slot (treat this as the primary deliverable first).
6. Keep loading behavior intentionally simple: maintain one active player only.
7. On combo timeline end, fetch one new random combo and replace the current combo.
8. Add focused debug logging/HUD for basic lifecycle events only (loaded, ready, ended, next-fetch start/success/fail).
9. Validate this single-player flow in Chrome and Safari and smooth out basic playback mechanics.

## Phase 2: Slots and preloading (separate problem)

10. Design and introduce slot orchestration (`slotList`) only after Phase 1 is stable.
11. Add queued-slot preloading and slot-to-slot swap behavior.
12. Validate long-running behavior (no stuck states, no dropped transitions) and tune Safari performance.

## Phase 3: Deployment and cutover

13. Hook up production API/env configuration for `/public/combos/random` in frontend-only deployment.
14. Run final parity review against current `apps/darenkeck`, then prepare rename/cutover by removing `-v2`.
