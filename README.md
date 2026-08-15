# Media Manager

Media Manager is a Bun/TypeScript monorepo for ingesting media, producing browser-ready streams, extracting and curating tone metadata, indexing effective tone vectors, and exploring audio/video combinations. It also contains the public [darenkeck.com](https://darenkeck.com) experience and a separate Python research CLI for experimental tone models.

The production system supports authenticated media management, asynchronous conversion and tone analysis, curator reviews, S3 Vectors-backed tone search, automatic tone walking, random fallback, and persistent public playback across resume and blog routes.

## Repository Layout

| Path                  | Responsibility                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`            | Next.js 16 authenticated Media Manager for uploads, folders, asset metadata, playback, queued jobs, curator reviews, and controlled combo exploration.       |
| `apps/darenkeck`      | React 19 + Vite public SPA for persistent combo playback, tone selection/walking, Markdown resume, generated blog routes, and resume PDF generation.         |
| `apps/tone-embedding` | Python 3.11 reference/research CLI for experimental audio/video models, bundles, and local analysis. It is not the production tone worker.                   |
| `packages/contracts`  | Zod schemas and shared API/data contracts for assets, combos, reviews, jobs, and public selection.                                                           |
| `packages/shared`     | Shared React playback, review, and tone-picker components, including `ComboPlayer`, `ComboToneReviewPlayer`, and `ToneWordPicker`.                           |
| `packages/tone-core`  | Production TypeScript tone analysis, taxonomy, vector, keyword-query, combo prediction, and OpenAI/ffmpeg helpers used by Lambda and browser-safe consumers. |
| `infra/cdk`           | AWS CDK stacks, Lambda handlers, operational scripts, backfills, reconciliation, and infrastructure tests.                                                   |
| `scripts`             | Root content-fetch and static deployment workflows.                                                                                                          |
| `research`            | Tone-taxonomy reports, findings, and supporting research artifacts.                                                                                          |
| `wiki`                | Maintained architecture, current state, operations, open issues, cleanup TODOs, and append-only change log.                                                  |
| `raw_sources`         | Archived and superseded plans retained as historical source material.                                                                                        |

## System Architecture

### Media ingestion and processing

1. The authenticated web app creates asset metadata and uploads originals to S3 with signed URLs.
2. S3 object-created events flow through EventBridge into separate SQS queues for conversion and tone analysis.
3. MediaConvert produces video ladders and normalized audio HLS while preserving original files.
4. The Node tone-analysis Lambda uses `@media-manager/tone-core`, OpenAI, and an account-local ffmpeg layer to analyze original audio/video independently of conversion.
5. DynamoDB remains authoritative for asset state, display-ready tone metadata, audit history, curator adjustments, and vector-sync fingerprints.
6. Generic SQS-backed jobs handle recursive delete and queued tone/conversion reprocessing.

### Reviews, vectors, and selection

- Curators submit keyword-only reviews through the authenticated `/review` route.
- Audio/video review keywords are mapped server-side into sparse `tone-taxonomy/v2` scores. Raw OpenAI scores are preserved; effective scores overlay materialized curator adjustments.
- Eligible public audio/video assets converge into a retained 10-dimensional Euclidean S3 Vectors index. Combination vectors are not persisted.
- `POST /public/combos/select` supports global keyword search and nearby walk continuation. Candidate pair tones are predicted on demand with `combo-tone-predictor/v0` (`60%` audio, `40%` video), reranked exactly, and sampled from the nearest valid results.
- Walks change both source assets, apply bounded history exclusions, and fall back to the public random path if controlled selection fails.

### Public Darenkeck site

- `/` provides persistent audio/video playback and a full-screen keyword-driven tone explorer.
- `/dev` renders the fetched Markdown resume and serves a generated print-friendly PDF.
- `/blog` and `/blog/:slug` render validated published Markdown while preserving playback state across navigation.
- Public content is fetched at build time from the private `darenkeck-dev/darenkeck-content` repository. Generated content, transformed Markdown, media, diagrams, and PDFs are ignored in this repository.
- Mermaid is an authoring format only. Deployment renders fenced or standalone Mermaid sources into static SVGs; no Mermaid runtime ships to browsers.

## AWS Infrastructure

`infra/cdk` defines these stage-aware stacks:

- `MediaManagerCoreStack`
- `MediaManagerAuthStack`
- `MediaManagerDataStack`
- `MediaManagerVectorStack`
- `MediaManagerStorageStack`
- `MediaManagerStreamingStack`
- `MediaManagerDarenkeckSiteStack`
- `MediaManagerApiStack`
- `MediaManagerProcessingStack`
- `MediaManagerObservabilityStack`

Production uses Cognito, API Gateway, Lambda, DynamoDB, S3, S3 Vectors, SQS, EventBridge, MediaConvert, CloudFront, Route 53, SSM Parameter Store, and CloudWatch.

## Requirements

- Bun `1.1.38` or a compatible release using the checked-in lockfile
- Node.js `22.x`
- AWS CLI credentials for infrastructure or static-site deployment
- Existing Git SSH access to `darenkeck-dev/darenkeck-content` for public-site content preparation
- Playwright Chromium for resume PDF generation: `bun run setup:darenkeck:pdf`
- Python `3.11+` and `uv` only when working in `apps/tone-embedding`

## Setup

```bash
bun install
cp .env.example .env
bun run setup:darenkeck:pdf
```

Populate only the environment values needed for the app or stack being used. Backend tone analysis expects the OpenAI key in SSM SecureString at `/media-manager/<stage>/openai-api-key` unless `OPENAI_API_KEY_PARAMETER_NAME` overrides it.

## Development

```bash
# Run workspace development tasks
bun run dev

# Run one frontend
bun run dev:web
bun run dev:darenkeck

# Fetch content, prepare posts/diagrams, and regenerate the resume PDF
bun run content:darenkeck:prepare
```

The Media Manager runs through Next.js. Darenkeck uses Vite on port `3002`. To prepare a non-default content source, set `DARENKECK_CONTENT_REPO` and/or `DARENKECK_CONTENT_REF` before running the content workflow.

The Python research app is managed separately:

```bash
cd apps/tone-embedding
uv sync --no-editable
uv run --no-editable tone-embedding --help
```

## Validation

```bash
# Entire TypeScript workspace
bun run typecheck
bun run lint
bun run test
bun run build

# Infrastructure and Lambda bundles
bun run --cwd infra/cdk build:lambda
bun run test:infra

# Darenkeck browser continuity smoke
bun run --cwd apps/darenkeck check:route-continuity
```

Package-specific `test`, `typecheck`, `lint`, and `build` scripts are available in each TypeScript workspace where applicable.

## Deployment

Root commands load `.env` where required:

```bash
bun run deploy:auth
bun run deploy:data
bun run deploy:vectors
bun run deploy:api
bun run deploy:processing
bun run deploy:darenkeck-site
bun run deploy:observability
```

Storage and streaming stacks currently use their package-level commands:

```bash
bun run --cwd infra/cdk deploy:storage
bun run --cwd infra/cdk deploy:streaming
```

Deploy public static content and application code with:

```bash
bun run deploy:darenkeck:prod
```

That workflow fetches `darenkeck-content/main`, validates and prepares published posts, renders Mermaid SVGs, regenerates the resume PDF, builds the production SPA, syncs S3 with deletion and symlink safeguards, and creates a CloudFront invalidation. Infrastructure deployment is only needed when the site stack itself changes.

See [Deploy and Ops](wiki/deploy-and-ops.md) for deployment order, environment details, reconciliation, smoke checks, and operational queries.

## Current Boundaries

- Darenkeck tone search, automatic walking, resume, and blog are deployed publicly.
- The authenticated Media Manager is implemented and builds locally, but this repository does not define its web hosting target.
- The legacy public random endpoint remains the initialization and operational fallback path.
- Anonymous public reviews, learned combo-tone prediction, dashboards, richer public recovery UI, and broader content collections are follow-up work.
- The Python tone app remains experimental; production analysis runs through the TypeScript `tone-core` Lambda.

## Documentation

Start with [wiki/index.md](wiki/index.md). The wiki is the maintained synthesis layer; archived plans in `raw_sources/` are historical and should not be treated as current behavior.

Important references:

- [Current State](wiki/current-state.md)
- [Architecture Map](wiki/architecture-map.md)
- [Upload Processing Flow](wiki/upload-processing-flow.md)
- [Current Walk Algorithm](wiki/walk-algorithm.md)
- [Deploy and Ops](wiki/deploy-and-ops.md)
- [Open Issues](wiki/open-issues.md)
- [React Cleanup TODOs](wiki/cleanup-todos.md)

Agent sessions must follow [AGENTS.md](AGENTS.md), including wiki-first startup and ongoing wiki maintenance.
