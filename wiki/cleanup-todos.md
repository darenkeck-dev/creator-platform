# React Cleanup TODOs

## Status

Ready for a post-release audit pass.

This cleanup is a source-first React audit and remediation pass. It is follow-up work rather than a release gate.

## Goal

Audit the two React applications and their shared React package for correctness, performance, accessibility, maintainability, and missing tests:

- `apps/web`: React 19 and Next.js 16 authenticated Media Manager.
- `apps/darenkeck`: React 19, React Router, and Vite public site.
- `packages/shared`: shared playback, review, and tone-picker components used by both applications.

The audit must distinguish framework-specific guidance. Next.js server-component and App Router rules apply only to `apps/web`; they must not be applied to the Vite application.

## Audit Tooling

Install project-local copies of Vercel's React and interface-review skills for OpenCode:

```bash
DO_NOT_TRACK=1 npx skills add vercel-labs/agent-skills \
  --skill vercel-react-best-practices \
  --skill web-design-guidelines \
  --agent opencode \
  --copy \
  --yes
```

Add `.opencode/agents/react-auditor.md` as a read-only subagent that:

- Denies file edits and shell commands.
- Loads both installed Vercel skills.
- Treats official React documentation as the correctness authority.
- Applies Next.js guidance only within `apps/web`.
- Includes `packages/shared` whenever either application depends on shared behavior.
- Reports confirmed findings before risks and testing gaps.
- Orders findings by severity and includes file and line references.
- Avoids speculative memoization and generic style-only recommendations.

Restart OpenCode after adding the skills or agent because configuration-time files are not hot-reloaded.

## Source Audit

### Shared React

Prioritize `packages/shared/src/combo-player.tsx` and its supporting playback helpers. Review:

- Video-master and audio-master timeline handoff.
- Asynchronous `play()` races, stale promises, and unmount cleanup.
- HLS instance creation, replacement, errors, and destruction.
- Pause, stall, seek, loop, end, replay, and follower-media behavior.
- Browser interruption and native media-control assumptions.
- Global listeners, effect dependencies, and callback freshness.
- Keyboard, screen-reader, reduced-motion, and loading-state behavior.
- Missing direct tests for the shared media state machine.

Also review the shared tone picker and review player for selection semantics, pending submissions, duplicate actions, focus behavior, and accessible state announcements.

### Darenkeck

Prioritize `apps/darenkeck/src/App.tsx`, `src/lib/slot-manager.ts`, and `src/components/ToneExplorer.tsx`. Review:

- Persistent state across `/` and `/dev` navigation.
- Search, walk, random fallback, and queued-transition serialization.
- Overlapping app-level and shared-player media control.
- Route-transition timers and retained outlet cleanup.
- Mobile focus loss, background/foreground transitions, screen lock, and native controls.
- Reduced-motion behavior for every animation and timer.
- Print-mode isolation from combo and HLS requests.
- Modal focus trapping, focus restoration, and hidden mounted controls.
- Browser-check coverage beyond the current route-continuity and PDF smokes.

### Media Manager

Prioritize `apps/web/components/asset-detail-editor.tsx`, `apps/web/app/(app)/upload/page.tsx`, `apps/web/components/combo-explorer.tsx`, and `apps/web/components/tone-review-workbench.tsx`. Review:

- Server and client component boundaries.
- Sequential data fetching and avoidable request waterfalls.
- Data serialized from server components into client components.
- Polling lifecycle, stale requests, intervals, and navigation cleanup.
- Upload retries, multipart cancellation, object URL cleanup, and duplicate completion.
- Review submission and automatic-walk re-entry.
- Custom menus, dialogs, folder trees, status announcements, and keyboard navigation.
- Bundle boundaries and conditional loading of browser-only media dependencies.
- Missing route, component, accessibility, upload, and authenticated browser tests.

## Validation Baseline

Run the existing checks before remediation so pre-existing failures remain separate from newly introduced regressions:

```bash
bun run --cwd apps/web test
bun run --cwd apps/web typecheck
bun run --cwd apps/web lint
bun run --cwd apps/web build

bun run --cwd apps/darenkeck test
bun run --cwd apps/darenkeck typecheck
bun run --cwd apps/darenkeck lint
bun run --cwd apps/darenkeck build

bun run --cwd packages/shared typecheck
bun run --cwd packages/shared lint
bun run --cwd packages/shared build
```

Run `bun run --cwd apps/darenkeck check:route-continuity` when its local API and browser prerequisites are available. Authenticated Media Manager browser testing is a separate pass and requires a usable environment and Cognito session.

## Output

Produce a review report rather than changing application code during the initial scan. Each finding should include:

- Severity.
- Confirmed behavior or concrete failure mode.
- File and line reference.
- Why the behavior matters in this repository.
- Smallest appropriate remediation.
- Test needed to prevent regression.

Separate confirmed defects from performance opportunities, accessibility findings, and residual testing risks. Agree on remediation order before making code changes.

## Initial Risk Order

1. Shared dual-media playback state and browser lifecycle handling.
2. Darenkeck persistent route and selection state.
3. Media Manager upload and asset-detail asynchronous workflows.
4. Review and controlled-explorer submission or transition races.
5. Accessibility of custom controls and overlays.
6. Next.js request waterfalls, serialization, and bundle boundaries.
7. Missing component and browser-level regression coverage.
