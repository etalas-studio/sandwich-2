# Express Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom `Router` class and Node `http` plumbing with Express, keeping all CA layers (domain/application/infrastructure/db/ai) untouched.

**Architecture:** Express becomes the HTTP framework only — all route handler logic, use cases, and repositories stay exactly as they are. Custom security logic (host guard, CSRF guard) moves into Express middleware. SSE and binary responses keep their raw Node patterns since Express does not obstruct them.

**Tech Stack:** Express 5, @types/express, cors, @types/cors. No other new dependencies.

**Spec:** No separate spec — plan is the authority.

## Global Constraints

- TypeScript ESM monorepo, NodeNext module resolution — all imports end `.js`
- Express 5 (not 4) — install `express@^5` and `@types/express@^5`
- Zero behaviour change — every route path, method, status code, and response body must match the original exactly
- `domain/`, `application/`, `infrastructure/db/`, `infrastructure/ai/` — do NOT touch these
- `eslint-plugin-boundaries` must still pass (`npm run lint:boundaries`)
- All 293 tests must still pass (`npm test`)
- No new abstractions beyond what Express provides natively
- `HttpDeps` interface in `infrastructure/http/types.ts` — do not change it

---

### Task 1: Install Express and update types

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `express`, `@types/express`, `cors`, `@types/cors` available to all later tasks

- [ ] **Step 1: Install dependencies**

```bash
npm install express@^5 cors
npm install --save-dev @types/express@^5 @types/cors
```

- [ ] **Step 2: Verify typecheck still passes**

```bash
npm run typecheck
```

Expected: no errors (Express types now available, nothing uses them yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add express, cors dependencies"
```

---

### Task 2: Create Express middleware for host guard and CSRF

**Files:**
- Create: `apps/server/middleware/security.ts`
- Delete: nothing yet

**Interfaces:**
- Consumes: nothing
- Produces:
  ```typescript
  // apps/server/middleware/security.ts
  import type { RequestHandler } from "express";
  export function hostGuard(trustedHosts: Set<string>): RequestHandler
  export function csrfGuard(): RequestHandler
  export function corsMiddleware(trustedHosts: Set<string>): RequestHandler
  ```

**Context:** The current `router.ts` embeds three security behaviours that must be preserved exactly:

1. **Host guard** — rejects any request whose `Host` header is not in `trustedHosts`, not a loopback+port combo, and not a loopback bare hostname on port 80/443. Returns `403 { error: "forbidden" }`.

2. **CSRF guard** — for non-safe methods (not GET/HEAD), if an `Origin` header is present and its host does not match the `Host` header and is not in `trustedHosts`, return `403 { error: "forbidden" }`. CORS preflight (`OPTIONS`) requests are exempt.

3. **CORS** — when the request `Origin` matches `Host` or is in `trustedHosts`, inject `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`. Handle `OPTIONS` preflight with 204.

Current logic to port (read `apps/server/router.ts` — the `handle` method — for exact conditions):

```typescript
function isTrustedHost(hostHeader, boundPort, trusted): boolean
function originMatchesHost(originHeader, hostHeader, trusted): boolean
```

Port these two helpers verbatim into `security.ts`, then wrap them in the three `RequestHandler` exports above.

- [ ] **Step 1: Read current router.ts security logic**

Read `apps/server/router.ts` lines 1-120 to understand `isTrustedHost` and `originMatchesHost` exactly.

- [ ] **Step 2: Write security.ts**

```typescript
// apps/server/middleware/security.ts
import type { Request, Response, NextFunction, RequestHandler } from "express";
import cors from "cors";

function isTrustedHost(
  hostHeader: string | undefined,
  boundPort: number,
  trusted: Set<string>,
): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.toLowerCase();
  if (trusted.has(host)) return true;
  const loopback = ["127.0.0.1", "localhost", "[::1]"];
  if (loopback.some((name) => host === `${name}:${String(boundPort)}`)) return true;
  if ((boundPort === 80 || boundPort === 443) && loopback.includes(host)) return true;
  return false;
}

function originMatchesHost(
  originHeader: string,
  hostHeader: string | undefined,
  trusted: Set<string>,
): boolean {
  if (!hostHeader) return false;
  let originHost: string;
  try {
    originHost = new URL(originHeader).host.toLowerCase();
  } catch {
    return false;
  }
  return originHost === hostHeader.toLowerCase() || trusted.has(originHost);
}

export function hostGuard(trustedHosts: Set<string>, boundPort: number): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const port = (req.socket?.localPort ?? boundPort);
    if (!isTrustedHost(req.headers.host, port, trustedHosts)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}

export function csrfGuard(trustedHosts: Set<string>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();
    const isSafe = method === "GET" || method === "HEAD";
    const isPreflight = method === "OPTIONS";
    if (!isSafe && !isPreflight) {
      const origin = req.headers.origin;
      if (
        origin !== undefined &&
        !originMatchesHost(origin, req.headers.host, trustedHosts)
      ) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
    }
    next();
  };
}

export function corsMiddleware(trustedHosts: Set<string>): RequestHandler {
  return cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, false);
      let originHost: string;
      try {
        originHost = new URL(origin).host.toLowerCase();
      } catch {
        return callback(null, false);
      }
      const allowed =
        originHost === "localhost" ||
        originHost.startsWith("localhost:") ||
        originHost === "127.0.0.1" ||
        originHost.startsWith("127.0.0.1:") ||
        trustedHosts.has(originHost);
      callback(null, allowed);
    },
    credentials: true,
  });
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/middleware/security.ts
git commit -m "feat(middleware): port host guard, CSRF guard, CORS to Express middleware"
```

---

### Task 3: Migrate web-server.ts to Express

**Files:**
- Modify: `apps/server/web-server.ts`

**Interfaces:**
- Consumes:
  - `hostGuard`, `csrfGuard`, `corsMiddleware` from `../middleware/security.js`
  - All `register*Routes` from `./infrastructure/http/index.js` (signatures change in Task 4 — this task must anticipate that)
  - `registerPrototypePublicRoutes` from `./prototype/routes.js`
- Produces: Express app listening on `process.env.PORT ?? 4319`

**Context:** Current `web-server.ts` does:
1. Reads `trustedHosts` from `TRUSTED_HOSTS` env var (comma-separated)
2. Constructs `new Router(trustedHosts, port)`
3. Calls all `register*Routes(router, deps)` and `registerPrototypePublicRoutes(router, db)`
4. Uses `createServer((req, res) => router.handle(req, res))`
5. Static file serving for `dist/web/` (SPA fallback)
6. Various startup tasks (ensureAdminUser, resetStaleExtractions, etc.)

Replace steps 2-4 with Express. Keep everything else identical.

Read `apps/server/web-server.ts` in full before writing.

- [ ] **Step 1: Read web-server.ts**

Read the full file to understand startup order and static serving logic.

- [ ] **Step 2: Rewrite the Express wiring section**

Replace:
```typescript
import { createServer } from "node:http";
import { Router } from "./router.js";
```

With:
```typescript
import express from "express";
import { hostGuard, csrfGuard, corsMiddleware } from "./middleware/security.js";
```

Replace the server construction block:
```typescript
// Before:
const router = new Router(trustedHosts, port);
// ... all register calls ...
const server = createServer((req, res) => { router.handle(req, res); });
server.listen(port, "0.0.0.0", () => { ... });

// After:
const app = express();
app.use(corsMiddleware(trustedHosts));
app.use(hostGuard(trustedHosts, port));
app.use(csrfGuard(trustedHosts));
app.use(express.json());

// All register calls now pass app instead of router:
registerAuthRoutes(app, deps);
// ... etc

// Static SPA serving (keep exact same logic, just use app.use and app.get):
app.use(express.static(webDistPath));
app.get("*", (_req, res) => { res.sendFile(indexPath); });

const server = app.listen(port, "0.0.0.0", () => { ... });
```

Keep all graceful shutdown, background job, and startup logic unchanged.

- [ ] **Step 3: Update register function parameter type in types.ts**

In `apps/server/infrastructure/http/types.ts`, add the Express Router type for use in Task 4:

```typescript
import type { Router } from "express";
export type ExpressRouter = Router;
```

Actually — simpler: Task 4 will import `Router` from `express` directly. No change to `types.ts` needed.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: errors on `register*Routes` calls because their signatures still expect custom `Router`. These will be fixed in Task 4. Note which errors appear — confirm they are only about Router type mismatch, not about missing functions or wrong deps.

- [ ] **Step 5: Commit**

```bash
git add apps/server/web-server.ts
git commit -m "feat(server): migrate web-server.ts to Express"
```

---

### Task 4: Migrate all infrastructure/http route files to Express

**Files:**
- Modify: `apps/server/infrastructure/http/account.ts`
- Modify: `apps/server/infrastructure/http/admin.ts`
- Modify: `apps/server/infrastructure/http/attachments.ts`
- Modify: `apps/server/infrastructure/http/auth.ts`
- Modify: `apps/server/infrastructure/http/billing.ts`
- Modify: `apps/server/infrastructure/http/conversations.ts`
- Modify: `apps/server/infrastructure/http/documents.ts`
- Modify: `apps/server/infrastructure/http/generation.ts`
- Modify: `apps/server/infrastructure/http/projects.ts`
- Modify: `apps/server/infrastructure/http/sharing.ts`
- Modify: `apps/server/infrastructure/http/index.ts` (re-export)

**Interfaces:**
- Consumes: `HttpDeps` from `./types.js` (unchanged)
- Produces: all `register*Routes` functions now accept `Router` from express:
  ```typescript
  import type { Router } from "express";
  export function registerAuthRoutes(router: Router, deps: HttpDeps): void
  // same pattern for all 10 files
  ```

**Migration pattern — apply to every route file:**

1. Replace:
   ```typescript
   import type { Router } from "../../router.js";
   ```
   With:
   ```typescript
   import type { Router } from "express";
   ```

2. Replace all handler signatures:
   ```typescript
   // Before:
   router.get("/path", async (req, res) => { ... })
   router.post("/path", async (req, res, params) => { ... })
   // After:
   router.get("/path", async (req, res) => { ... })   // same — params not used
   router.post("/path", async (req, res) => { ... })  // drop params arg
   ```

3. Replace all `params.X` with `req.params.X`:
   ```typescript
   // Before: params.id, params.providerId, params.orderId, etc.
   // After:  req.params.id, req.params.providerId, req.params.orderId
   ```

4. Replace `sendJson(res, status, body)` with `res.status(status).json(body)`:
   ```typescript
   // Before: sendJson(res, 200, { ok: true })
   // After:  res.status(200).json({ ok: true })
   ```

5. Replace `sendCaughtError(res, err, context)` with:
   ```typescript
   import { AuthError } from "../../auth/service.js";
   // inline the logic:
   if (err instanceof AuthError) {
     res.status(err.status).json({ error: err.message });
   } else {
     console.error(`[context] error:`, err);
     res.status(500).json({ error: "internal error" });
   }
   ```
   Or extract a shared helper — see note below.

6. Remove `readJsonBody` usage — body is already parsed by `express.json()` middleware:
   ```typescript
   // Before:
   const body = (await readJsonBody(req).catch(() => null)) as { role?: string } | null;
   // After:
   const body = req.body as { role?: string } | null;
   ```

7. Remove imports of `sendJson`, `sendCaughtError`, `readJsonBody` from `../../http-utils.js`

**Special cases:**

**auth.ts — logout 204:**
```typescript
// Before:
res.writeHead(204, { "set-cookie": buildClearedSessionCookie(COOKIE_SECURE) });
res.end();
// After:
res.status(204).setHeader("set-cookie", buildClearedSessionCookie(COOKIE_SECURE)).end();
```

**auth.ts — login set-cookie:**
```typescript
// Before: sendJson(res, 200, body, { "set-cookie": cookie })
// After:  res.setHeader("set-cookie", cookie).status(200).json(body)
```

**documents.ts — binary DOCX/PDF download:**
```typescript
// Before:
res.writeHead(200, { "content-type": "...", "content-disposition": "..." });
res.end(result.buffer);
// After:
res.status(200)
  .setHeader("content-type", "...")
  .setHeader("content-disposition", "...")
  .end(result.buffer);
```

**generation.ts — SSE stream:**
Keep `res.writeHead` and `res.write` exactly as-is. Express passes through to the underlying Node response. Do NOT change SSE logic. Only change the function signature and `params.id` → `req.params.id`.

**conversations.ts — 204 on delete:**
```typescript
// Before: res.writeHead(204).end();
// After:  res.status(204).end();
```

**Shared error helper** — to avoid repeating the `AuthError` check in 10 files, add to `apps/server/http-utils.ts`:
```typescript
import type { Response } from "express";
export function sendCaughtErrorExpress(res: Response, err: unknown, context: string): void {
  if (err instanceof AuthError) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error(`[${context}] error:`, err);
    if (!res.headersSent) res.status(500).json({ error: "internal error" });
  }
}
```
Import this in each route file instead of inlining.

- [ ] **Step 1: Add sendCaughtErrorExpress to http-utils.ts**

Read `apps/server/http-utils.ts` first, then add the export above. Keep existing exports intact.

- [ ] **Step 2: Migrate account.ts**

Read the full file. Apply the migration pattern. Commit.

```bash
git add apps/server/infrastructure/http/account.ts
git commit -m "feat(http): migrate account routes to Express"
```

- [ ] **Step 3: Migrate admin.ts**

Read the full file. Apply migration pattern. Note: uses `params.id`, `params.providerId`. Commit.

```bash
git add apps/server/infrastructure/http/admin.ts
git commit -m "feat(http): migrate admin routes to Express"
```

- [ ] **Step 4: Migrate auth.ts**

Read the full file. Apply migration pattern. Special cases: logout 204, login set-cookie. `parseQueryParam` in `GET /api/auth/verification-status` can be replaced with `req.query.email`. Commit.

```bash
git add apps/server/infrastructure/http/auth.ts
git commit -m "feat(http): migrate auth routes to Express"
```

- [ ] **Step 5: Migrate billing.ts**

Read the full file. Apply migration pattern. Commit.

```bash
git add apps/server/infrastructure/http/billing.ts
git commit -m "feat(http): migrate billing routes to Express"
```

- [ ] **Step 6: Migrate conversations.ts**

Read the full file. Apply migration pattern. Note: 204 on delete, `params.id`. Commit.

```bash
git add apps/server/infrastructure/http/conversations.ts
git commit -m "feat(http): migrate conversation routes to Express"
```

- [ ] **Step 7: Migrate documents.ts**

Read the full file. Apply migration pattern. Note: binary response for export. `parseQueryParam` → `req.query.format`. Commit.

```bash
git add apps/server/infrastructure/http/documents.ts
git commit -m "feat(http): migrate document routes to Express"
```

- [ ] **Step 8: Migrate generation.ts**

Read the full file. Apply migration pattern. **SSE section: do not change `res.writeHead`/`res.write` calls.** Only change function signature and `params.id` → `req.params.id`. Commit.

```bash
git add apps/server/infrastructure/http/generation.ts
git commit -m "feat(http): migrate generation routes to Express (SSE preserved)"
```

- [ ] **Step 9: Migrate projects.ts**

Read the full file. Apply migration pattern. Commit.

```bash
git add apps/server/infrastructure/http/projects.ts
git commit -m "feat(http): migrate project routes to Express"
```

- [ ] **Step 10: Migrate sharing.ts**

Read the full file. Apply migration pattern. Commit.

```bash
git add apps/server/infrastructure/http/sharing.ts
git commit -m "feat(http): migrate sharing routes to Express"
```

- [ ] **Step 11: Migrate attachments.ts**

Read the full file. Apply migration pattern. Commit.

```bash
git add apps/server/infrastructure/http/attachments.ts
git commit -m "feat(http): migrate attachment routes to Express"
```

- [ ] **Step 12: Typecheck all**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 13: Run tests**

```bash
npm test
```

Expected: 293 pass, 0 fail.

- [ ] **Step 14: Commit index.ts if needed**

`index.ts` only re-exports — no type changes needed since `register*Routes` signatures are updated in-file. Verify it still compiles. If any re-export needs updating, fix and commit.

---

### Task 5: Migrate prototype/routes.ts to Express

**Files:**
- Modify: `apps/server/prototype/routes.ts`

**Interfaces:**
- Consumes: `Router` from express (passed from web-server.ts)
- Produces: `registerPrototypePublicRoutes(router: Router, db: Database): void`

**Context:** This file does:
- Redirect (`301`) to add trailing slash
- Serve static files from the project's output directory with `readFileSync`
- Uses `res.writeHead` and `res.end`

Migration:
```typescript
// Before:
import type { Router } from "../router.js";
// After:
import type { Router } from "express";
```

Replace raw `res.writeHead`/`res.end` with Express equivalents:
```typescript
// 301 redirect:
res.redirect(301, newUrl);

// Static file:
res.status(200)
  .setHeader("content-type", MIME[extFor(abs)] ?? "application/octet-stream")
  .end(readFileSync(abs));
```

- [ ] **Step 1: Read prototype/routes.ts in full**

- [ ] **Step 2: Apply migration**

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 293 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/prototype/routes.ts
git commit -m "feat(prototype): migrate prototype routes to Express"
```

---

### Task 6: Delete custom router.ts and clean up http-utils.ts

**Files:**
- Delete: `apps/server/router.ts`
- Modify: `apps/server/http-utils.ts` (remove Node-specific exports no longer used)

**Context:** After Tasks 3-5, `router.ts` should have zero imports. Verify before deleting:

```bash
grep -rn "from.*router\.js\|from.*router\"" apps/server/ --include="*.ts"
```

Expected: no results. If any remain, do not delete — fix the import first.

`http-utils.ts` still exports `MIME`, `sendJson`, `sendCaughtError`, `readJsonBody`. After migration:
- `MIME` — still used in `prototype/routes.ts` (keep)
- `sendJson` — may still be used somewhere; grep to confirm
- `readJsonBody` — should have zero usages after Task 4; remove if so
- `sendCaughtError` — replaced by `sendCaughtErrorExpress`; remove if zero usages
- `parseQueryParam` — may still be used; grep

Run:
```bash
grep -rn "sendJson\b\|readJsonBody\|sendCaughtError\b\|parseQueryParam" apps/server/ --include="*.ts" | grep -v "http-utils\.ts"
```

Remove only exports with zero external usages.

- [ ] **Step 1: Verify router.ts has no importers**

```bash
grep -rn "from.*router\.js" apps/server/ --include="*.ts"
```

Expected: empty.

- [ ] **Step 2: Delete router.ts**

```bash
git rm apps/server/router.ts
```

- [ ] **Step 3: Audit http-utils.ts**

```bash
grep -rn "sendJson\b\|readJsonBody\|sendCaughtError\b\|parseQueryParam" apps/server/ --include="*.ts" | grep -v "http-utils\.ts"
```

Remove any export with zero hits.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Run tests and boundaries lint**

```bash
npm test
npm run lint:boundaries
```

Expected: 293 pass, lint clean.

- [ ] **Step 6: Commit**

```bash
git add -u apps/server/http-utils.ts
git commit -m "chore: delete custom router.ts, trim http-utils.ts"
```
