# Auth — Design Doc

Written 2026-08-03. Covers the Auth architecture piece from `docs/roadmap.md` / `docs/superpowers/specs/2026-08-02-phase-1-product-design.md` ("Auth: custom, single account in phase 1"). Built in parallel with pipeline-shape work happening on a different worktree — this design deliberately touches no file under `src/engine/`, `src/db/tickets.ts`, `src/db/runs.ts`, or any future `src/pipeline/`.

## Scope

Custom username/email/password auth, single fixed credential pair per instance (multi-account is phase 2, out of scope here). The DB layer for this already exists from the storage-sqlite plan (`src/db/users.ts`, `src/db/sessions.ts`) and is not modified — this plan builds the logic and routes on top of it.

## Account bootstrap

On first launch, no row exists in `users`. Rather than a CLI command or config-seeded credentials, the web app shows a one-time **setup screen** (create your account: username, email, password) in place of the login screen whenever zero users exist. This is independent of the (not-yet-built) Visibility piece's first-run project-folder picker — Auth only gates on "does a user exist," nothing else; whatever gate the app has next (folder picker, once built) runs after login, with no shared first-run state between the two pieces.

Registration only succeeds once: `POST /api/auth/register` checks for an existing user server-side (not just relying on the frontend not showing the screen again) and returns `409` if one already exists. A successful registration immediately creates a session and logs the new account in — no separate "now log in" step.

## Password hashing

Node's built-in `crypto.scrypt`, not a new dependency (bcrypt/argon2) — scrypt is memory-hard, stdlib, and fits the project's existing pattern of only adding a native dependency when there's a documented reason (`node-pty`, `better-sqlite3` both were). `src/db/users.ts` already treats `passwordHash` as an opaque string, so this is fully internal to the new Auth module.

## Session mechanics

- Transport: an `HttpOnly`, `SameSite=Lax` cookie named `session`, `Path=/`, set on login/registration. `HttpOnly` keeps the token unreachable from JS (no XSS exposure); `SameSite=Lax` also means no separate CSRF-token machinery is needed for phase 1 — cross-site fetch/POST requests won't carry the cookie.
- `Secure` is off by default so the cookie still works on a plain-HTTP/no-proxy deployment (per the spec's "instance speaks plain HTTP only, TLS is the deploying party's responsibility" framing) — flippable via a `COOKIE_SECURE=1` env var for anyone who fronts the instance with HTTPS.
- Duration: fixed 7-day expiry set at login time (`sessions.expires_at`), not sliding. Re-login after a week regardless of activity — acceptable friction for a single-operator instance.
- Expired session rows are cleaned up lazily (deleted the next time they're read and found expired) — no background job; appropriate at single-user scale.

## Components

New, self-contained `src/auth/` module:

- **`src/auth/password.ts`** — `hashPassword(plain): string` / `verifyPassword(plain, hash): boolean`, using `crypto.scrypt` with a random salt embedded in the stored string and a timing-safe compare.
- **`src/auth/service.ts`** — `register`, `login`, `logout`, `validateSession` — the actual business logic, calling `src/db/users.ts` / `src/db/sessions.ts` directly. On a login attempt against a username that doesn't exist, still runs a dummy hash+compare before responding, so response timing doesn't leak whether an account exists.
- **`src/auth/middleware.ts`** — a guard function `web-server.ts` calls per protected request: parses the `session` cookie (a small inline cookie-header parser, no new dependency), calls `validateSession`, and either attaches the resolved `userId` or short-circuits with `401`.
- **`src/web-server.ts`** (modified, not rewritten) — gains four routes:
  - `GET /api/auth/me` → `{ state: "setup_required" | "unauthenticated" | "authenticated", user?: { username } }`
  - `POST /api/auth/register` → `{ username, email, password }`, `409` if a user already exists
  - `POST /api/auth/login` → `{ username, password }`, sets the session cookie
  - `POST /api/auth/logout` → clears the session cookie
  
  `GET /api/tickets` (and any future API route) goes through the middleware. Static SPA assets and `/api/auth/*` remain reachable unauthenticated, since the login/setup screen itself has to load before any session exists.
- **Frontend** (`web/src`) — a thin wrapper that calls `GET /api/auth/me` on boot and renders one of: a setup screen, a login screen, or the existing `<App>` unchanged. No changes to `TicketBoard`, `TicketDetail`, or any existing component.

## Error handling

- Wrong username *or* wrong password → generic `401 { error: "invalid username or password" }`, never revealing which was wrong.
- Missing/invalid/expired session on a protected route → `401`; frontend treats this identically to "unauthenticated" and shows the login screen.
- Registration after a user already exists → `409`, enforced server-side regardless of what the frontend shows.
- Malformed request bodies → `400`.
- Unexpected hashing/DB errors → `500`, logged server-side, generic message to the client.

## Testing

Matches the existing `src/db/*.test.ts` pattern — plain `node:assert`, temp SQLite DB via `mkdtempSync`, no test framework:

- `src/auth/password.test.ts` — hash/verify roundtrip; wrong password fails; two hashes of the same password differ (salted).
- `src/auth/service.test.ts` — register succeeds once then rejects on a second attempt; login succeeds/fails correctly on right/wrong credentials; logout invalidates the session; an expired session (row inserted directly with a past `expires_at`) is rejected by `validateSession`.
- An integration test spinning up `web-server.ts` on an ephemeral port: confirms `/api/tickets` returns `401` without a cookie and `200` after a real register-or-login round trip.
- No test tooling exists in `web/` today, so the setup/login screens get manual browser verification (per `CLAUDE.md`'s UI-testing rule) rather than automated frontend tests.

## Explicitly out of scope

- Multi-account / user management (phase 2).
- Password reset / "forgot password" flow — single fixed account, no email delivery infrastructure exists; if the password is lost, phase 1's answer is direct DB access or a future admin CLI, not designed here.
- CSRF tokens — `SameSite=Lax` is judged sufficient for phase 1's risk level; revisit if phase 2's multi-account work raises the stakes.
- Rate limiting / login lockout — single-operator instance; not designed against here, revisit if this instance is ever exposed more broadly than "one trusted operator."
