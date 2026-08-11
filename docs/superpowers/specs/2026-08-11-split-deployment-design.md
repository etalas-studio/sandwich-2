# Split Deployment: Vercel (FE) + Railway (BE)

## Problem

App currently deploys as a single unit. Goal: serve the React SPA from Vercel and the Node API from Railway as separate deployments.

## Domains

- FE: `sandwich.etalas.com` → Vercel
- BE: `api.sandwich.etalas.com` → Railway

DNS records (to be added by DNS admin):
- `sandwich.etalas.com` CNAME → Vercel-provided value
- `api.sandwich.etalas.com` CNAME → Railway-provided value

## Auth Strategy

Session cookie with `Domain=.etalas.com`. Both subdomains share the same parent domain so the browser treats requests as same-site — `SameSite=Lax` remains valid. No auth architecture changes needed.

`Domain` attribute is only added in production (when `COOKIE_SECURE=1`), so local dev is unaffected.

## Changes

### BE (Railway)

| File | Change |
|------|--------|
| `src/auth/cookie.ts` | Add `Domain=.etalas.com` to cookie attrs when `COOKIE_SECURE=1` |
| `src/router.ts` | Add CORS headers: `Access-Control-Allow-Origin: https://sandwich.etalas.com`, `Access-Control-Allow-Credentials: true`, handle `OPTIONS` preflight |
| Railway env vars | `TRUSTED_HOSTS=api.sandwich.etalas.com`, `COOKIE_SECURE=1` |

### FE (Vercel)

| File | Change |
|------|--------|
| `web/src/api/base.ts` (new) | `apiUrl(path)` helper — prefixes with `VITE_API_URL` env var, falls back to `""` |
| `web/src/api/*.ts` | Replace `fetch("/api/...")` with `fetch(apiUrl("/api/..."), { credentials: "include" })` |
| `vercel.json` | Add `env: { VITE_API_URL: "https://api.sandwich.etalas.com" }` |

## Dev Experience

When `VITE_API_URL` is unset (local), `apiUrl()` returns the path unchanged. Vite proxy (`/api → localhost:4319`) continues to work as before.

## Out of Scope

- CI/CD pipeline split (Railway still runs `npm run start` which builds then serves)
- Token-based auth migration
- Separate Railway service for BE-only (no FE build step on Railway)
