# darenkeck

Frontend-only Vite + React + TypeScript app for the next version of the darenkeck landing page.

## Local development

1. Create `apps/darenkeck/.env` with:

   ```bash
   VITE_COMBO_API_BASE_URL=<your-api-base-url>
   ```

2. Start dev server:

   ```bash
   bun run --cwd apps/darenkeck dev
   ```

## Dev proxy note (important)

- In development, Vite proxies requests from `/public/*` to `VITE_COMBO_API_BASE_URL`.
- This avoids browser CORS errors from `http://localhost:3002`.
- This proxy behavior is **dev-only** and does not exist in production builds.
- If you change `.env` or `vite.config.ts`, restart the dev server.

## Mermaid diagrams as committed SVG

The site does not render Mermaid at runtime. Mermaid is an authoring format; the website and resume PDF display the same committed SVG asset.

Keep Mermaid source in the `darenkeck-content` repository under `diagrams/`, and write generated SVG files under `media/diagrams/`. From this repository, render with the exact pinned CLI version through:

```bash
bun run --cwd apps/darenkeck diagram:svg -- \
  /path/to/darenkeck-content/diagrams/upload-flow.mmd \
  /path/to/darenkeck-content/media/diagrams/upload-flow.svg
```

Then reference the committed SVG from content Markdown:

```markdown
![Asset upload processing flow](/media/diagrams/upload-flow.svg)
```

The wrapper uses Mermaid CLI `11.16.0`, the neutral theme, a white background, and atomic output replacement. Invalid Mermaid fails before replacing an existing SVG. The first invocation may download the pinned authoring package and its headless-browser dependency.

Use `accTitle` and `accDescr` in Mermaid source where supported, and always provide useful Markdown alt text. Regenerate and commit the SVG whenever its `.mmd` source changes.

## Static deploy (S3 + CloudFront)

Deployment model for this app is static hosting via S3 behind CloudFront.

### Environments

- **staging**: build with Vite `staging` mode and `VITE_COMBO_API_BASE_URL` for staging API
- **production**: build with Vite `production` mode and `VITE_COMBO_API_BASE_URL` for prod API

Use these templates:

- `apps/darenkeck/.env.staging.example`
- `apps/darenkeck/.env.production.example`

Create real env files (do not commit secrets):

- `apps/darenkeck/.env.staging`
- `apps/darenkeck/.env.production`

### Build commands

```bash
bun run build:darenkeck:staging
bun run build:darenkeck:prod
```

### Deploy outline

1. Build the target env.
2. Upload `apps/darenkeck/dist` to the environment's S3 bucket.
3. Invalidate CloudFront cache (at minimum `/index.html`; commonly `/*` for first rollout).

Example AWS CLI shape:

```bash
aws s3 sync apps/darenkeck/dist s3://<bucket-name> --delete
aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*"
```
