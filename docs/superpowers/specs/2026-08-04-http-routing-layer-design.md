# HTTP Routing Layer

Written 4 August 2026.

## Purpose

Extract the monolithic route handler in `src/web-server.ts` into a small internal router and separate per-domain route modules. No new framework dependencies — stays on raw `node:http`.

## Non-goals

- No third-party web framework (Hono, Express, etc.)
- No changes to auth, DB, integrations, or pipeline layers
- No behavioral changes — identical HTTP responses before and after

## Architecture

### `src/router.ts` — Internal Router class

~50 lines, zero dependencies.

- `add(method, path, handler)` — registers a handler. Paths may include `:param` segments for parameterized routes.
- `use(middlewareFn)` — registers one global middleware. Runs before matched handler. If middleware calls `sendJson` directly (e.g. auth rejects), the handler is skipped.
- `dispatch(req, res)` — the entry point called by `createServer`:
  1. Runs middleware. If middleware responds, stop.
  2. Matches `{method, path}` against registered routes. Parameterized routes (`:param`) extract params into a `params` object passed to the handler.
  3. On match: calls handler wrapped in try/catch. `AuthError` → its status. Other throw → logged 500.
  4. On no match: 404 for API paths, falls through to static SPA for non-API paths.
  5. Handlers receive `(req, res, params)` — same `IncomingMessage`/`ServerResponse` as today.

### `src/routes/auth.ts`

Exports `registerAuthRoutes(router)`. Registers:

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/auth/me` | returns `{ state, user? }` |
| POST | `/api/auth/register` | creates first user |
| POST | `/api/auth/login` | creates session |
| POST | `/api/auth/logout` | clears session |

Logic extracted verbatim from current `web-server.ts` handler blocks.

### `src/routes/settings.ts`

Exports `registerSettingsRoutes(router)`. Registers:

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/settings/project` | returns instance settings |
| POST | `/api/settings/project` | validates repo path, completes first run |

### `src/routes/integrations.ts`

Exports `registerIntegrationRoutes(router)`. Registers:

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/integrations` | returns provider status list |
| POST | `/api/integrations/:providerId/connect` | connects API key |
| POST | `/api/integrations/:providerId/disconnect` | disconnects |

Parameterized routes use `:providerId` — no hardcoded `opencode-go` path segment.

### `src/web-server.ts` (modified)

Shrinks to:

1. Open DB, init integrations
2. Create `Router`, register all route modules
3. `createServer` calls `router.dispatch(req, res)`
4. Static SPA serving stays as fallback (non-API GET → serve from `webRoot`)
5. Host/Origin guard moves into the router's global middleware alongside auth

### What doesn't move

- `sendJson`, `sendCaughtError`, `readJsonBody`, `validateRepoPath`, `decodePathSegment` — stay as module-level utilities. Route handlers import them.
- `SESSION_COOKIE_NAME`, `buildClearedSessionCookie`, `buildSessionCookie` — stay in `auth/cookie.ts`.
- `handleAuthRequest` — moves into `routes/auth.ts` as a private helper.
- `parseTrustedHosts` — stays in `web-server.ts` (reads env vars, needs `boundPort`). The resulting `Set<string>` and `boundPort` are passed to the router's constructor.
- `isTrustedHost`, `originMatchesHost` — move into `router.ts` as private methods (used by the global middleware, self-contained once the router has the trusted set and port).

## Middleware

The router's single `use()` middleware runs before every matched handler. It:

1. Checks Host header (trusted host guard — reject 403 on mismatch)
2. Checks Origin for state-changing methods (CSRF guard — reject 403 on mismatch)
3. Checks session for non-public API paths (auth guard — reject 401 on missing session)
4. If any check fails, middleware responds directly and returns `false` to signal "stop"

Public API paths are defined as a constant set in `routes/auth.ts` (or `web-server.ts`) — the same `PUBLIC_API_PATHS` set that exists today. The auth middleware consults it.

## Error Handling

Handlers throw `AuthError` for known status-bearing errors. The router's dispatch try/catch converts:
- `AuthError` → its `.status` + `.message` as JSON
- Anything else → logged 500

This replaces the per-handler `void (async () => { try...catch })()` wrapper currently repeated in `web-server.ts`.

## Testing

### Unit tests (new)

Each route module gets a test file (`routes/auth.test.ts`, etc.) that:
- Creates a `Router` with only that module's routes registered
- Uses mock `IncomingMessage` / `ServerResponse` (same pattern as existing `web-server.test.ts`)
- Asserts status codes and response bodies per route

### Integration test (existing)

`web-server.test.ts` continues to work unchanged — it tests the full server via real HTTP, and the responses must be identical.

## Migration Plan

Single branch, single commit (plus test additions):

1. Create `src/router.ts`
2. Create `src/routes/auth.ts`, `settings.ts`, `integrations.ts` — each extracted from current `web-server.ts`
3. Rewrite `web-server.ts` to wire the router
4. Build + test — existing tests pass, new unit tests pass
5. Commit

No user-facing changes. No config changes. No dependency changes.
