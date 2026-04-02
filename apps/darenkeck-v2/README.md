# darenkeck-v2

Frontend-only Vite + React + TypeScript app for the next version of the darenkeck landing page.

## Local development

1. Create `apps/darenkeck-v2/.env` with:

   ```bash
   VITE_COMBO_API_BASE_URL=<your-api-base-url>
   ```

2. Start dev server:

   ```bash
   bun run --cwd apps/darenkeck-v2 dev
   ```

## Dev proxy note (important)

- In development, Vite proxies requests from `/public/*` to `VITE_COMBO_API_BASE_URL`.
- This avoids browser CORS errors from `http://localhost:3002`.
- This proxy behavior is **dev-only** and does not exist in production builds.
- If you change `.env` or `vite.config.ts`, restart the dev server.
