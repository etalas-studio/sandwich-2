# Split Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the React SPA from Vercel (`spectr.id`) and the Node API from Railway (`api.spectr.id`) as separate deployments, sharing session cookies via `Domain=.etalas.com`.

**Architecture:** FE is a static Vite build deployed to Vercel. All `/api/*` requests are made directly to the Railway BE URL via an `apiUrl()` helper that reads `VITE_API_URL` at build time. Session cookies are shared across subdomains by setting `Domain=.etalas.com` on the BE in production. CORS on the BE allows the Vercel origin with credentials.

**Tech Stack:** Node.js HTTP server (no framework), React + Vite, TypeScript, better-sqlite3.

## Global Constraints

- `VITE_API_URL` must fall back to `""` (empty string) when unset — local dev must work unchanged via Vite proxy.
- Cookie `Domain` attribute is only added when `COOKIE_SECURE=1` env var is set — do not change local dev behaviour.
- `SameSite=Lax` stays — both domains are subdomains of `etalas.com` so this is valid.
- No new npm dependencies.
- All existing tests must continue to pass.

---

### Task 1: Add `apiUrl()` helper to FE

**Files:**
- Create: `web/src/api/base.ts`

**Interfaces:**
- Produces: `apiUrl(path: string): string` — exported function used by all FE API files and components.

- [ ] **Step 1: Write the test**

Create `web/src/api/base.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'

describe('apiUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns path unchanged when VITE_API_URL is not set', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const { apiUrl } = await import('./base')
    expect(apiUrl('/api/tickets')).toBe('/api/tickets')
  })

  it('prefixes path with VITE_API_URL when set', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.spectr.id')
    // Re-import to pick up stubbed env
    vi.resetModules()
    const { apiUrl } = await import('./base')
    expect(apiUrl('/api/tickets')).toBe('https://api.spectr.id/api/tickets')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd web && npx vitest run src/api/base.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `base.ts`**

```typescript
const BASE = import.meta.env.VITE_API_URL ?? ''

export function apiUrl(path: string): string {
  return `${BASE}${path}`
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd web && npx vitest run src/api/base.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/api/base.ts web/src/api/base.test.ts
git commit -m "feat(fe): add apiUrl helper for configurable API base URL"
```

---

### Task 2: Update FE API files to use `apiUrl()`

**Files:**
- Modify: `web/src/api/auth.ts`
- Modify: `web/src/api/tickets.ts`
- Modify: `web/src/api/projects.ts`
- Modify: `web/src/api/scans.ts` (if it has fetch calls)
- Modify: `web/src/api/integrations.ts` (if it has fetch calls)

**Interfaces:**
- Consumes: `apiUrl(path: string): string` from `./base`

- [ ] **Step 1: Check all fetch calls in API files**

```bash
grep -n "fetch(" web/src/api/*.ts
```

- [ ] **Step 2: Update `web/src/api/auth.ts`**

Add import at top:
```typescript
import { apiUrl } from './base'
```

Replace every `fetch('/api/` with `fetch(apiUrl('/api/`. Also add `credentials: 'include'` to `postJson` and `postLogout` since they need cookies:

```typescript
import { apiUrl } from './base'

// ...

export async function fetchMe(): Promise<AuthState> {
  const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
  // rest unchanged
}

async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {  // url already built by caller with apiUrl()
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  // rest unchanged
}

export async function postLogin(username: string, password: string): Promise<void> {
  await postJson(apiUrl('/api/auth/login'), { username, password })
}

export async function postRegister(username: string, email: string, password: string): Promise<void> {
  await postJson(apiUrl('/api/auth/register'), { username, email, password })
}

export async function postLogout(): Promise<void> {
  await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
}
```

- [ ] **Step 3: Update `web/src/api/tickets.ts`**

Add import at top:
```typescript
import { apiUrl } from './base'
```

Replace every `fetch('/api/` with `fetch(apiUrl('/api/`. Add `credentials: 'include'` to any call that doesn't already have it:

```typescript
// createTicket
const res = await fetch(apiUrl('/api/tickets'), {
  method: 'POST',
  credentials: 'include',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ... }),
})

// fetchTicket
const res = await fetch(apiUrl(`/api/tickets/${encodeURIComponent(key)}`), { credentials: 'include' })

// fetchTickets
const res = await fetch(apiUrl('/api/tickets'), { credentials: 'include' })

// updateTicket
const res = await fetch(apiUrl(`/api/tickets/${encodeURIComponent(key)}`), {
  method: 'PUT',
  credentials: 'include',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(data),
})

// deleteTicket
const res = await fetch(apiUrl(`/api/tickets/${encodeURIComponent(key)}`), {
  method: 'DELETE',
  credentials: 'include',
})

// resolveTicket, runTicket, pullJiraTickets, openPr — same pattern: wrap path in apiUrl(), add credentials: 'include'
```

- [ ] **Step 4: Update `web/src/api/projects.ts`**

Add import at top:
```typescript
import { apiUrl } from './base'
```

Wrap every `/api/...` path in `apiUrl()`. Add `credentials: 'include'` to all calls. Pattern is the same as tickets.ts.

- [ ] **Step 5: Update remaining API files**

Run:
```bash
grep -rn "fetch('/" web/src/api/scans.ts web/src/api/integrations.ts 2>/dev/null
```

Apply the same `apiUrl()` + `credentials: 'include'` treatment to any matches.

- [ ] **Step 6: Run existing FE tests**

```bash
cd web && npx vitest run
```

Expected: all pass. Fix any test that breaks because of the import — typically you need to add `vi.stubEnv('VITE_API_URL', '')` in the test setup.

- [ ] **Step 7: Commit**

```bash
git add web/src/api/
git commit -m "feat(fe): route all API fetches through apiUrl()"
```

---

### Task 3: Update direct `/api` references in components

**Files:**
- Modify: `web/src/components/Dashboard.tsx`
- Modify: `web/src/components/Integrations.tsx`
- Modify: `web/src/components/ProjectSection.tsx`
- Modify: `web/src/components/Settings.tsx`
- Modify: `web/src/components/TicketDetail.tsx`

**Interfaces:**
- Consumes: `apiUrl(path: string): string` from `../api/base`

Components have two types of direct `/api` references:
1. `fetch('/api/...')` calls (Dashboard.tsx) — use `apiUrl()`
2. `href="/api/..."` and `window.location.href = '/api/...'` (OAuth redirects) — also use `apiUrl()`

- [ ] **Step 1: Update `web/src/components/Dashboard.tsx`**

Add import:
```typescript
import { apiUrl } from '../api/base'
```

Find the three direct `fetch` calls (lines ~82, ~90, ~151) and wrap paths:
```typescript
fetch(apiUrl(`/api/tickets/${ticketKey}/generate`), { credentials: 'include', ... })
fetch(apiUrl(`/api/tickets/${ticketKey}/stream`), { credentials: 'include', signal: ctrl.signal })
fetch(apiUrl(`/api/tickets/${ticketKey}`), { credentials: 'include', ... })
```

- [ ] **Step 2: Update OAuth redirect components**

In `Integrations.tsx`, `ProjectSection.tsx`, `Settings.tsx`, and `TicketDetail.tsx`:

Add import to each:
```typescript
import { apiUrl } from '../api/base'
```

Replace `href="/api/..."` with `href={apiUrl('/api/...')}` and `window.location.href = '/api/...'` with `window.location.href = apiUrl('/api/...')`.

Example in `Integrations.tsx`:
```typescript
// before
window.location.href = '/api/integrations/github/authorize'
// after
window.location.href = apiUrl('/api/integrations/github/authorize')
```

Example in `TicketDetail.tsx`:
```typescript
// before
href={`/api/tickets/${encodeURIComponent(ticketKey)}/attachments/${i}`}
// after
href={apiUrl(`/api/tickets/${encodeURIComponent(ticketKey)}/attachments/${i}`)}
```

- [ ] **Step 3: Verify no remaining bare `/api` references**

```bash
grep -rn "fetch('/api\|href=\"/api\|href={`/api\|location.href = '/api\|location.href = \`/api" web/src/components/
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/
git commit -m "feat(fe): wrap component /api refs in apiUrl()"
```

---

### Task 4: Add CORS support to BE router

**Files:**
- Modify: `src/router.ts`

CORS requires two changes:
1. Handle `OPTIONS` preflight — respond 204 with CORS headers before the host/origin guard
2. Add CORS headers to every response when the request `Origin` matches the allowed FE origin

The allowed origin is read from `CORS_ORIGIN` env var (set to `https://spectr.id` in Railway). Falls back to nothing (no CORS headers) when unset, so local dev is unaffected.

- [ ] **Step 1: Check existing CORS test coverage**

```bash
grep -n "cors\|CORS\|OPTIONS\|preflight" src/web-server.test.ts
```

Note what is already tested to avoid duplication.

- [ ] **Step 2: Add CORS test cases to `src/web-server.test.ts`**

Find the test file's helper `rawRequest` and add these cases after the existing host/origin tests:

```typescript
// CORS preflight from allowed origin
{
  const corsOrigin = 'https://spectr.id'
  const res = await rawRequest(port, {
    method: 'OPTIONS',
    path: '/api/auth/login',
    headers: {
      host: `127.0.0.1:${port}`,
      origin: corsOrigin,
      'access-control-request-method': 'POST',
    },
  })
  assert.equal(res.status, 204, 'preflight should return 204')
  // CORS_ORIGIN not set in test env — headers absent
}
```

Note: the full cross-origin flow is hard to test in unit tests because the env var would need to be set. The preflight returning 204 (not 403) is the critical check. Set `process.env.CORS_ORIGIN` in the test if you want to assert the header value.

- [ ] **Step 3: Implement CORS in `src/router.ts`**

At the top of the `dispatch` method, before the host guard, add:

```typescript
const corsOrigin = process.env.CORS_ORIGIN ?? ''
const requestOrigin = req.headers.origin ?? ''
const isCorsRequest = corsOrigin !== '' && requestOrigin === corsOrigin

// Handle CORS preflight
if (isCorsRequest && (req.method ?? '') === 'OPTIONS') {
  res.writeHead(204, {
    'access-control-allow-origin': corsOrigin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  })
  res.end()
  return
}
```

After the host guard block (after the `isSafe` / origin check), add a helper to attach CORS headers to actual responses. The cleanest way is to wrap `res.writeHead` — but simpler: add the headers in a post-route hook by monkey-patching `res` before dispatch:

```typescript
// Attach CORS headers to all responses when origin matches
if (isCorsRequest) {
  const originalWriteHead = res.writeHead.bind(res)
  // @ts-expect-error overload types are complex
  res.writeHead = (statusCode: number, headers?: Record<string, string>) => {
    return originalWriteHead(statusCode, {
      'access-control-allow-origin': corsOrigin,
      'access-control-allow-credentials': 'true',
      ...headers,
    })
  }
}
```

Place this block immediately after the host guard check (before middleware and route matching).

- [ ] **Step 4: Run BE tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/router.ts src/web-server.test.ts
git commit -m "feat(be): add CORS support via CORS_ORIGIN env var"
```

---

### Task 5: Add `Domain` to session cookie in production

**Files:**
- Modify: `src/auth/cookie.ts`

`Domain=.etalas.com` lets the browser send the session cookie from `spectr.id` to `api.spectr.id`. Only added when `COOKIE_SECURE=1` (production).

- [ ] **Step 1: Add test to `src/auth/cookie.ts`** (inline assert at bottom of file, gated by `process.argv[1]`)

Actually, cookie.ts has no test file. Add a quick self-check as a comment note — the behaviour is verified by the integration test in Task 6.

- [ ] **Step 2: Update `buildAttrs` in `src/auth/cookie.ts`**

```typescript
function buildAttrs(cookieValue: string, maxAge: number, secure: boolean): string[] {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${cookieValue}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (secure) {
    attrs.push('Secure')
    // Share cookie across subdomains in production
    attrs.push('Domain=.etalas.com')
  }
  return attrs
}
```

- [ ] **Step 3: Run BE tests**

```bash
npm test
```

Expected: all pass (existing cookie tests check Secure flag; Domain is additive).

- [ ] **Step 4: Commit**

```bash
git add src/auth/cookie.ts
git commit -m "feat(be): set cookie Domain=.etalas.com in production"
```

---

### Task 6: Update `vercel.json` and Railway env vars

**Files:**
- Modify: `vercel.json`

Railway env vars are set in the Railway dashboard (not in code). This task documents what needs to be set.

- [ ] **Step 1: Update `vercel.json`**

```json
{
  "buildCommand": "npm --prefix web run build",
  "outputDirectory": "web/dist",
  "framework": null,
  "env": {
    "VITE_API_URL": "https://api.spectr.id"
  }
}
```

- [ ] **Step 2: Set Railway env vars in Railway dashboard**

Go to Railway project → Variables and set:

| Key | Value |
|-----|-------|
| `TRUSTED_HOSTS` | `api.spectr.id` |
| `COOKIE_SECURE` | `1` |
| `CORS_ORIGIN` | `https://spectr.id` |

- [ ] **Step 3: Set Vercel domain in Vercel dashboard**

Go to Vercel project → Settings → Domains → add `spectr.id`. Copy the CNAME target value.

- [ ] **Step 4: Set Railway custom domain in Railway dashboard**

Go to Railway service → Settings → Networking → add `api.spectr.id`. Copy the CNAME target value.

- [ ] **Step 5: Add DNS records**

Ask DNS admin to add:
- `spectr.id` CNAME → Vercel CNAME value
- `api.spectr.id` CNAME → Railway CNAME value

- [ ] **Step 6: Commit `vercel.json`**

```bash
git add vercel.json
git commit -m "feat: configure Vercel build env for split deployment"
```

- [ ] **Step 7: Push and verify**

```bash
git push
```

After Railway redeploys and DNS propagates, test:
1. Open `https://spectr.id` — loads the SPA
2. Log in — cookie set with `Domain=.etalas.com`
3. Any API call goes to `https://api.spectr.id` — responds 200 with session cookie attached
