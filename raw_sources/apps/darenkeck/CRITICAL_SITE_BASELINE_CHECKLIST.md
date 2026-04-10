# Darenkeck Critical Site Baseline Checklist

Use this as the minimum launch baseline for the public site.

## Critical

- [x] Add `robots.txt` in `apps/darenkeck/public/` (allow crawl, include sitemap URL).
- [x] Add `sitemap.xml` in `apps/darenkeck/public/` (homepage URL at minimum).
- [x] Add essential metadata in `apps/darenkeck/index.html`:
  - [x] `meta name="description"`
  - [x] canonical `<link rel="canonical" ...>`
  - [x] Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`)
  - [x] Twitter tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`)
- [x] Add favicon + social image assets in `apps/darenkeck/public/` and reference them in `index.html`.
- [x] Add reduced-motion support for loader/animation styles (`prefers-reduced-motion`) in `apps/darenkeck/src/index.css` and inline shell CSS in `index.html`.
- [x] Apply CloudFront response security headers for the site distribution in `infra/cdk/lib/darenkeck-site-stack.ts`:
  - [x] `Strict-Transport-Security`
  - [x] `X-Content-Type-Options: nosniff`
  - [x] `Referrer-Policy`
  - [x] baseline `Content-Security-Policy`
  - [x] `X-Frame-Options`
  - [x] `Permissions-Policy`

## Final verify

- [ ] Run `bun run --cwd apps/darenkeck build` and verify generated `dist/` includes metadata files.
- [ ] Deploy site and validate: robots/sitemap reachable, social preview works, Lighthouse accessibility has no critical failures.
