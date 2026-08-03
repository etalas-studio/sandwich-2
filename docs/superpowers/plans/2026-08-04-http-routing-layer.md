# HTTP Routing Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the monolithic route handler in `src/web-server.ts` into a small internal `Router` class and per-domain route modules under `src/routes/`.

**Architecture:** A ~50-line `Router` class with method/path registration, `:param` segment matching, a single global middleware hook, and a `dispatch()` entry point. Three route modules (`auth`, `settings`, `integrations`) register their handlers with the router. `web-server.ts` shrinks to server-creation wiring.

**Tech Stack:** TypeScript (NodeNext), raw `node:http` (no framework), `better-sqlite3`

## Global Constraints

- No third-party web framework dependency
- Zero behavioral changes — identical HTTP responses before and after
- Existing `web-server.test.ts` must pass unchanged
- `npm run build` + `npm run test` must succeed after every task

---

### Task 1: Extract shared HTTP utilities

**Files:**
- Create: `src/http-utils.ts`
- Modify: `src/web-server.ts` (re-export or replace usage)

**Interfaces:**
- Produces these exports (all extracted verbatim from `web-server.ts`):
  ```ts
  const MIME: Record<string, string>;
  function sendJson(res: ServerResponse, status: number, body: unknown, extraHeaders?: Record<string, string>): void;
  function sendCaughtError(res: ServerResponse, err: unknown, context: string): void;
  function decodePathSegment(segment: string): string | null;
  function readJsonBody(req: IncomingMessage): Promise<unknown>;
  function validateRepoPath(candidate: unknown): { ok: true; repoPath: string } | { ok: false; error: string };
  ```
  `sendCaughtError` and `readJsonBody` import `AuthError` from `src/auth/service.js`.

- [ ] **Step 1: Create `src/http-utils.ts`**

Copy the following functions and constants from `src/web-server.ts` into the new file, with the correct imports:

- `MIME` constant
- `sendJson()` function
- `sendCaughtError()` function (imports `AuthError` from `../auth/service.js`)
- `decodePathSegment()` function
- `readJsonBody()` function (imports `AuthError` from `../auth/service.js` — uses `MAX_BODY_BYTES` which should stay as a file-level constant)
- `validateRepoPath()` function (imports `existsSync`, `statSync` from `node:fs`, `join`, `isAbsolute` from `node:path`)

Also keep `MAX_BODY_BYTES = 64 * 1024` as a file-level constant.

- [ ] **Step 2: Update `src/web-server.ts` to import from `http-utils.ts`**

Replace the inline definitions of `MIME`, `sendJson`, `sendCaughtError`, `decodePathSegment`, `readJsonBody`, `validateRepoPath`, and `MAX_BODY_BYTES` with:

```ts
import {
  MIME,
  sendJson,
  sendCaughtError,
  decodePathSegment,
  readJsonBody,
  validateRepoPath,
} from "./http-utils.js";
```

Remove the `MAX_BODY_BYTES` constant from `web-server.ts` (it's now only in `http-utils.ts`).

- [ ] **Step 3: Build and run tests**

Run: `npm run build && npm run test`
Expected: All existing tests pass. No behavioral change.

- [ ] **Step 4: Commit**

```bash
git add src/http-utils.ts src/web-server.ts
git commit -m "refactor: extract shared HTTP utilities to http-utils.ts"
```

---

### Task 2: Router class

**Files:**
- Create: `src/router.ts`
- Test: `src/router.test.ts`

**Interfaces:**
- Consumes: `sendJson` from `src/http-utils.js`
- Produces:
  ```ts
  export type RouteHandler = (
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>,
  ) => void | Promise<void>;

  export type MiddlewareFn = (
    req: IncomingMessage,
    res: ServerResponse,
  ) => boolean | void; // return false to halt dispatch

  export class Router {
    constructor(trustedHosts: Set<string>, boundPort: number);
    use(fn: MiddlewareFn): void;
    add(method: string, path: string, handler: RouteHandler): void;
    get(path: string, handler: RouteHandler): void;
    post(path: string, handler: RouteHandler): void;
    dispatch(req: IncomingMessage, res: ServerResponse): Promise<void>;
  }
  ```

- [x] **Step 1: Write the failing tests**

Create `src/router.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Router } from "./router.js";

function mockReq(method: string, path: string, headers: Record<string, string> = {}): any {
  return { method, url: path, headers, on: () => {} };
}
function mockRes(): any {
  const res: any = { statusCode: 0, body: "", headers: {} };
  res.writeHead = (status: number, headers?: any) => {
    res.statusCode = status;
    if (headers) Object.assign(res.headers, headers);
  };
  res.end = (payload?: string) => { if (payload !== undefined) res.body = payload; };
  res.destroy = () => {};
  return res;
}

describe("Router", () => {
  it("matches exact GET paths", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.get("/api/test", (_req, res, _params) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await router.dispatch(mockReq("GET", "/api/test"), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { ok: true });
  });

  it("matches exact POST paths", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.post("/api/test", (_req, res, _params) => {
      res.writeHead(201);
      res.end(JSON.stringify({ created: true }));
    });
    await router.dispatch(mockReq("POST", "/api/test"), res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(JSON.parse(res.body), { created: true });
  });

  it("returns 404 for unmatched paths", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/nope"), res);
    assert.equal(res.statusCode, 404);
    assert.ok((res.headers["content-type"] ?? "").includes("application/json"));
    assert.deepEqual(JSON.parse(res.body), { error: "not found" });
  });

  it("returns 405 for wrong method on existing path", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.get("/api/test", (_req, res, _params) => { res.writeHead(200); res.end("ok"); });
    await router.dispatch(mockReq("POST", "/api/test"), res);
    assert.equal(res.statusCode, 405);
  });

  it("extracts :param segments", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.get("/api/integrations/:id/status", (_req, res, params) => {
      res.writeHead(200);
      res.end(JSON.stringify({ id: params.id }));
    });
    await router.dispatch(mockReq("GET", "/api/integrations/opencode-go/status"), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { id: "opencode-go" });
  });

  it("returns 404 when :param prefix mismatches", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.get("/api/integrations/:id/connect", (_req, res, _params) => { res.writeHead(200); res.end("ok"); });
    await router.dispatch(mockReq("GET", "/api/other/x/connect"), res);
    assert.equal(res.statusCode, 404);
  });

  it("runs middleware, stops when it returns false", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    let middlewareRan = false;
    router.use((_req, res) => {
      middlewareRan = true;
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "blocked" }));
      return false;
    });
    let handlerRan = false;
    router.get("/api/test", () => { handlerRan = true; });
    await router.dispatch(mockReq("GET", "/api/test"), res);
    assert.equal(middlewareRan, true);
    assert.equal(handlerRan, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(JSON.parse(res.body), { error: "blocked" });
  });

  it("runs middleware, continues when it returns void", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    let middlewareRan = false;
    router.use(() => { middlewareRan = true; });
    let handlerRan = false;
    router.get("/api/test", (_req, res, _params) => { handlerRan = true; res.writeHead(200); res.end("ok"); });
    await router.dispatch(mockReq("GET", "/api/test"), res);
    assert.equal(middlewareRan, true);
    assert.equal(handlerRan, true);
  });

  it("catches thrown errors and responds 500", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.get("/api/test", () => { throw new Error("boom"); });
    await router.dispatch(mockReq("GET", "/api/test"), res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(JSON.parse(res.body), { error: "internal error" });
  });

  it("rejects untrusted Host header with 403", async () => {
    const router = new Router(new Set(), 4319);
    const res = mockRes();
    router.get("/api/test", (_req, res, _params) => { res.writeHead(200); res.end("ok"); });
    await router.dispatch(mockReq("GET", "/api/test", { host: "evil.example" }), res);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(JSON.parse(res.body), { error: "forbidden" });
  });
});
```

- [x] **Step 2: Run tests, verify they fail**

Run: `npx tsc -p tsconfig.json && node --test dist/router.test.js`
Expected: Module not found.

- [x] **Step 3: Implement `src/router.ts`**

```ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "./http-utils.js";

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
) => void | Promise<void>;

export type MiddlewareFn = (
  req: IncomingMessage,
  res: ServerResponse,
) => boolean | void;

interface RouteEntry {
  method: string;
  segments: string[];
  handler: RouteHandler;
}

function decodeSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

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
): boolean {
  if (!hostHeader) return false;
  let originHost: string;
  try {
    originHost = new URL(originHeader).host;
  } catch {
    return false;
  }
  return originHost.toLowerCase() === hostHeader.toLowerCase();
}

export class Router {
  private routes: RouteEntry[] = [];
  private middlwareFn: MiddlewareFn | null = null;
  private trustedHosts: Set<string>;
  private boundPort: number;

  constructor(trustedHosts: Set<string>, boundPort: number) {
    this.trustedHosts = trustedHosts;
    this.boundPort = boundPort;
  }

  use(fn: MiddlewareFn): void {
    this.middlwareFn = fn;
  }

  add(method: string, path: string, handler: RouteHandler): void {
    const segments = path.split("/").filter(Boolean);
    this.routes.push({ method: method.toUpperCase(), segments, handler });
  }

  get(path: string, handler: RouteHandler): void {
    this.add("GET", path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.add("POST", path, handler);
  }

  async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      // Host guard — use the socket's actual port (in case boundPort was 0 = pick-free)
      const port = req.socket?.localPort ?? this.boundPort;
      if (!isTrustedHost(req.headers.host, port, this.trustedHosts)) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }

      // Origin / CSRF guard for state-changing methods
      const method = (req.method ?? "GET").toUpperCase();
      const isSafe = method === "GET" || method === "HEAD";
      if (!isSafe) {
        const origin = req.headers.origin;
        if (origin !== undefined && !originMatchesHost(origin, req.headers.host)) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
      }

      // Middleware
      if (this.middlwareFn) {
        const result = this.middlwareFn(req, res);
        if (result === false) return;
      }

      // Route matching
      const url = req.url ?? "/";
      const path = url.split("?")[0] ?? "/";
      const reqSegs = path.split("/").filter(Boolean);

      for (const route of this.routes) {
        if (route.method !== method) continue;
        if (route.segments.length !== reqSegs.length) continue;
        const params: Record<string, string> = {};
        let match = true;
        for (let i = 0; i < route.segments.length; i++) {
          const rSeg = route.segments[i]!;
          const qSeg = reqSegs[i]!;
          if (rSeg.startsWith(":")) {
            params[rSeg.slice(1)] = decodeSafe(qSeg);
          } else if (rSeg.toLowerCase() !== qSeg.toLowerCase()) {
            match = false;
            break;
          }
        }
        if (!match) continue;

        try {
          await route.handler(req, res, params);
        } catch (err) {
          console.error("unhandled request error:", err);
          if (!res.headersSent) {
            sendJson(res, 500, { error: "internal error" });
          } else {
            res.destroy();
          }
        }
        return;
      }

      // 405 check — any route matching the path with a different method?
      for (const route of this.routes) {
        if (route.method === method) continue;
        if (route.segments.length !== reqSegs.length) continue;
        let pathMatch = true;
        for (let i = 0; i < route.segments.length; i++) {
          const rSeg = route.segments[i]!;
          const qSeg = reqSegs[i]!;
          if (rSeg.startsWith(":")) continue;
          if (rSeg.toLowerCase() !== qSeg.toLowerCase()) { pathMatch = false; break; }
        }
        if (pathMatch) {
          sendJson(res, 405, { error: "method not allowed" });
          return;
        }
      }

      sendJson(res, 404, { error: "not found" });
    } catch (err) {
      console.error("router dispatch error:", err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "internal error" });
      } else {
        res.destroy();
      }
    }
  }
}
```

- [x] **Step 4: Run tests, verify they pass**

Run: `npm run build && node --test dist/router.test.js`
Expected: All 10 tests pass.

- [x] **Step 5: Commit**

```bash
git add src/router.ts src/router.test.ts
git commit -m "feat: add internal Router class for node:http route dispatch"
```

---

### Task 3: Auth route module

**Files:**
- Create: `src/routes/auth.ts`
- Test: `src/routes/auth.test.ts`

**Interfaces:**
- Consumes: `Router` from `../router.js`, `sendJson`/`sendCaughtError`/`readJsonBody` from `../http-utils.js`, `AuthError`/`login`/`logout`/`register`/`setupRequired` from `../auth/service.js`, `authenticateRequest` from `../auth/middleware.js`, `getUserById` from `../db/users.js`, `SESSION_COOKIE_NAME`/`buildSessionCookie`/`buildClearedSessionCookie`/`parseCookies` from `../auth/cookie.js`
- Produces: `export function registerAuthRoutes(router: Router, db: Database.Database, publicPaths: Set<string>): void`
- Note: `COOKIE_SECURE` env var is read at module level (same as current `web-server.ts`)

- [ ] **Step 1: Write failing tests**

Create `src/routes/auth.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { Router } from "../router.js";
import { registerAuthRoutes } from "./auth.js";

function mockReq(method: string, path: string, headers: Record<string, string> = {}): any {
  return { method, url: path, headers, on: () => {} };
}
function mockRes(): any {
  const res: any = { statusCode: 0, body: "", headers: {} };
  res.writeHead = (s: number, h?: any) => { res.statusCode = s; if (h) Object.assign(res.headers, h); };
  res.end = (p?: string) => { if (p !== undefined) res.body = p; };
  res.destroy = () => {};
  return res;
}

const PUBLIC = new Set(["/api/auth/me", "/api/auth/register", "/api/auth/login", "/api/auth/logout"]);

describe("auth routes", () => {
  let db: ReturnType<typeof openDb>;
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "auth-routes-test-"));
    db = openDb(join(tmpDir, "db.sqlite"));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("GET /api/auth/me returns setup_required when empty", async () => {
    const router = new Router(new Set(), 0);
    registerAuthRoutes(router, db, PUBLIC);
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/auth/me"), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { state: "setup_required" });
  });

  it("POST /api/auth/register rejects empty body", async () => {
    const router = new Router(new Set(), 0);
    registerAuthRoutes(router, db, PUBLIC);
    const res = mockRes();
    const req: any = {
      method: "POST", url: "/api/auth/register", headers: {},
      on: (ev: string, fn: Function) => { if (ev === "data") fn(Buffer.from("{}")); if (ev === "end") fn(); },
    };
    await router.dispatch(req, res);
    assert.equal(res.statusCode, 400);
  });

  it("full register → login → me flow", async () => {
    const router = new Router(new Set(), 0);
    registerAuthRoutes(router, db, PUBLIC);

    // Register
    const regRes = mockRes();
    const regReq: any = {
      method: "POST", url: "/api/auth/register", headers: {},
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from(JSON.stringify({ username: "a", email: "a@b.com", password: "hunter22" })));
        if (ev === "end") fn();
      },
    };
    await router.dispatch(regReq, regRes);
    assert.equal(regRes.statusCode, 200);

    // Login with wrong password
    const badRes = mockRes();
    const badReq: any = {
      method: "POST", url: "/api/auth/login", headers: {},
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from(JSON.stringify({ username: "a", password: "wrong" })));
        if (ev === "end") fn();
      },
    };
    await router.dispatch(badReq, badRes);
    assert.equal(badRes.statusCode, 401);

    // Login correct
    const okRes = mockRes();
    const okReq: any = {
      method: "POST", url: "/api/auth/login", headers: {},
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from(JSON.stringify({ username: "a", password: "hunter22" })));
        if (ev === "end") fn();
      },
    };
    await router.dispatch(okReq, okRes);
    assert.equal(okRes.statusCode, 200);
    const cookie = okRes.headers["set-cookie"];
    assert.ok(cookie && cookie.includes("session="));

    // Me with cookie
    const meRes = mockRes();
    await router.dispatch(mockReq("GET", "/api/auth/me", { cookie }), meRes);
    assert.equal(meRes.statusCode, 200);
    assert.deepEqual(JSON.parse(meRes.body), { state: "authenticated", user: { username: "a" } });

    // Logout
    const outRes = mockRes();
    await router.dispatch(mockReq("POST", "/api/auth/logout", { cookie }), outRes);
    assert.equal(outRes.statusCode, 204);

    // Me after logout (no cookie)
    const afterRes = mockRes();
    await router.dispatch(mockReq("GET", "/api/auth/me"), afterRes);
    assert.equal(afterRes.statusCode, 200);
    assert.deepEqual(JSON.parse(afterRes.body), { state: "unauthenticated" });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx tsc -p tsconfig.json && node --test dist/routes/auth.test.js`
Expected: Module not found.

- [ ] **Step 3: Implement `src/routes/auth.ts`**

Extract the four auth handlers (`/api/auth/me`, `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`) verbatim from `web-server.ts` into this file. Register them on the router passed in.

```ts
import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import {
  AuthError,
  type AuthResult,
  login,
  logout,
  register,
  setupRequired,
} from "../auth/service.js";
import { authenticateRequest } from "../auth/middleware.js";
import { getUserById } from "../db/users.js";
import {
  SESSION_COOKIE_NAME,
  buildClearedSessionCookie,
  buildSessionCookie,
  parseCookies,
} from "../auth/cookie.js";
import {
  sendJson,
  sendCaughtError,
  readJsonBody,
} from "../http-utils.js";

const COOKIE_SECURE = process.env.COOKIE_SECURE === "1";

function handleAuthRequest(
  res: import("node:http").ServerResponse,
  run: () => Promise<AuthResult>,
): void {
  run()
    .then((result) => {
      sendJson(
        res,
        200,
        { user: result.user },
        { "set-cookie": buildSessionCookie(result.session.token, COOKIE_SECURE) },
      );
    })
    .catch((err: unknown) => sendCaughtError(res, err, "auth request"));
}

export function registerAuthRoutes(
  router: Router,
  db: Database.Database,
  publicPaths: Set<string>,
): void {
  router.get("/api/auth/me", (_req, res) => {
    if (setupRequired(db)) {
      sendJson(res, 200, { state: "setup_required" });
      return;
    }
    // The middleware already authenticated the request if needed;
    // we check the cookie directly for /me since it's a public path.
    const auth = authenticateRequest(db, _req);
    if (!auth) {
      sendJson(res, 200, { state: "unauthenticated" });
      return;
    }
    const user = getUserById(db, auth.userId);
    sendJson(res, 200, { state: "authenticated", user: { username: user?.username ?? "" } });
  });

  router.post("/api/auth/register", async (req, res) => {
    try {
      const body = (await readJsonBody(req)) as { username?: string; email?: string; password?: string };
      if (!body.username || !body.email || !body.password) {
        throw new AuthError(400, "username, email, and password are required");
      }
      handleAuthRequest(res, () =>
        register(db, { username: body.username!, email: body.email!, password: body.password! }),
      );
    } catch (err) {
      sendCaughtError(res, err, "register");
    }
  });

  router.post("/api/auth/login", async (req, res) => {
    try {
      const body = (await readJsonBody(req)) as { username?: string; password?: string };
      if (!body.username || !body.password) {
        throw new AuthError(400, "username and password are required");
      }
      handleAuthRequest(res, () =>
        login(db, { username: body.username!, password: body.password! }),
      );
    } catch (err) {
      sendCaughtError(res, err, "login");
    }
  });

  router.post("/api/auth/logout", (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    if (token) logout(db, token);
    res.writeHead(204, { "set-cookie": buildClearedSessionCookie(COOKIE_SECURE) });
    res.end();
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run build && node --test dist/routes/auth.test.js`
Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/auth.ts src/routes/auth.test.ts
git commit -m "feat: add auth route module"
```

---

### Task 4: Settings and integrations route modules

**Files:**
- Create: `src/routes/settings.ts`
- Create: `src/routes/integrations.ts`
- Test: `src/routes/settings.test.ts`
- Test: `src/routes/integrations.test.ts`

**Interfaces:**
- `registerSettingsRoutes(router: Router, db: Database.Database): void`
  - GET `/api/settings/project` → `getInstanceSettings(db)`
  - POST `/api/settings/project` → `validateRepoPath` + `completeFirstRun(db, ..., ...)`
- `registerIntegrationRoutes(router: Router): void`
  - GET `/api/integrations` → `getIntegrationStatus()`
  - POST `/api/integrations/:providerId/connect` → `connectWithApiKey(providerId, apiKey)`
  - POST `/api/integrations/:providerId/disconnect` → `disconnectApiKey(providerId)`

- [ ] **Step 1: Write `src/routes/settings.ts`**

Extract the two settings handlers verbatim from `web-server.ts`:

```ts
import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import { getInstanceSettings, completeFirstRun } from "../db/settings.js";
import {
  sendJson,
  sendCaughtError,
  readJsonBody,
  validateRepoPath,
} from "../http-utils.js";

export function registerSettingsRoutes(
  router: Router,
  db: Database.Database,
): void {
  router.get("/api/settings/project", (_req, res) => {
    sendJson(res, 200, getInstanceSettings(db));
  });

  router.post("/api/settings/project", async (req, res) => {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendCaughtError(res, err, "settings update");
      return;
    }
    const candidate = (body as Record<string, unknown> | null)?.["repoPath"];
    const validated = validateRepoPath(candidate);
    if (!validated.ok) {
      sendJson(res, 400, { error: validated.error });
      return;
    }
    const settings = completeFirstRun(db, validated.repoPath, new Date().toISOString());
    sendJson(res, 200, settings);
  });
}
```

- [ ] **Step 2: Write `src/routes/integrations.ts`**

Extract the three integration handlers verbatim from `web-server.ts`:

```ts
import type { Router } from "../router.js";
import {
  getIntegrationStatus,
  connectWithApiKey,
  disconnectApiKey,
} from "../pipeline/integrations.js";
import {
  sendJson,
  sendCaughtError,
  readJsonBody,
} from "../http-utils.js";

export function registerIntegrationRoutes(router: Router): void {
  router.get("/api/integrations", async (_req, res) => {
    try {
      const status = await getIntegrationStatus();
      sendJson(res, 200, status);
    } catch (err) {
      sendCaughtError(res, err, "integrations list");
    }
  });

  router.post("/api/integrations/:providerId/connect", async (req, res, params) => {
    const providerId = params.providerId!;
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendCaughtError(res, err, "integration connect");
      return;
    }
    const apiKey = (body as Record<string, unknown> | null)?.["apiKey"];
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      sendJson(res, 400, { error: "apiKey is required" });
      return;
    }
    try {
      const result = await connectWithApiKey(providerId, apiKey.trim());
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (err) {
      sendCaughtError(res, err, "integration connect");
    }
  });

  router.post("/api/integrations/:providerId/disconnect", async (_req, res, params) => {
    const providerId = params.providerId!;
    try {
      const result = await disconnectApiKey(providerId);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (err) {
      sendCaughtError(res, err, "integration disconnect");
    }
  });
}
```

- [ ] **Step 3: Write `src/routes/settings.test.ts`**

```ts
import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { Router } from "../router.js";
import { registerSettingsRoutes } from "./settings.js";

function mockReq(method: string, path: string, headers: Record<string, string> = {}): any {
  return { method, url: path, headers, on: () => {} };
}
function mockRes(): any {
  const res: any = { statusCode: 0, body: "", headers: {} };
  res.writeHead = (s: number, h?: any) => { res.statusCode = s; if (h) Object.assign(res.headers, h); };
  res.end = (p?: string) => { if (p !== undefined) res.body = p; };
  res.destroy = () => {};
  return res;
}

describe("settings routes", () => {
  let db: ReturnType<typeof openDb>;
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "settings-routes-test-"));
    db = openDb(join(tmpDir, "db.sqlite"));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("GET /api/settings/project returns defaults", async () => {
    const router = new Router(new Set(), 0);
    registerSettingsRoutes(router, db);
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/settings/project"), res);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.repoPath, null);
    assert.equal(body.firstRunComplete, false);
  });

  it("POST /api/settings/project rejects non-absolute path", async () => {
    const router = new Router(new Set(), 0);
    registerSettingsRoutes(router, db);
    const res = mockRes();
    const req: any = {
      method: "POST", url: "/api/settings/project", headers: {},
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from(JSON.stringify({ repoPath: "relative/path" })));
        if (ev === "end") fn();
      },
    };
    await router.dispatch(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(JSON.parse(res.body).error.includes("absolute"));
  });

  it("POST /api/settings/project succeeds for a real git repo", async () => {
    // Create a temp git repo to satisfy validateRepoPath
    const repoDir = join(tmpDir, "test-repo");
    mkdirSync(repoDir);
    mkdirSync(join(repoDir, ".git"));

    const router = new Router(new Set(), 0);
    registerSettingsRoutes(router, db);
    const res = mockRes();
    const req: any = {
      method: "POST", url: "/api/settings/project", headers: {},
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from(JSON.stringify({ repoPath: repoDir })));
        if (ev === "end") fn();
      },
    };
    await router.dispatch(req, res);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.repoPath, repoDir);
    assert.equal(body.firstRunComplete, true);
  });
});
```

- [ ] **Step 4: Build and run all tests**

Run: `npm run build && npm run test`
Expected: All tests pass — existing `web-server.test.ts` continues to pass, new route tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/settings.ts src/routes/integrations.ts src/routes/settings.test.ts
git commit -m "feat: add settings and integrations route modules"
```

---

### Task 5: Rewire web-server.ts

**Files:**
- Modify: `src/web-server.ts`

**Changes:** Replace the monolithic route handler with router wiring.

- [ ] **Step 1: Rewrite the request handler in `web-server.ts`**

Replace the current `createServer` callback body with router-based wiring:

```ts
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { openDb } from "./db/connection.js";
import { initIntegrations } from "./pipeline/integrations.js";
import { authenticateRequest } from "./auth/middleware.js";
import { MIME, sendJson } from "./http-utils.js";
import { Router } from "./router.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";

export interface WebServerOptions {
  dbPath: string;
  port: number;
  webRoot: string;
}

function parseTrustedHosts(): Set<string> {
  return new Set(
    (process.env.TRUSTED_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter((h) => h.length > 0),
  );
}

const PUBLIC_API_PATHS = new Set([
  "/api/auth/me",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
]);

export function startWebServer(options: WebServerOptions): Server {
  const { dbPath, port, webRoot } = options;
  const db = openDb(dbPath);
  const trustedHosts = parseTrustedHosts();
  let boundPort = port;

  // Pi SDK integrations
  initIntegrations(db).catch((err) => {
    console.error("Integrations init failed:", err);
  });

  // Build router
  const router = new Router(trustedHosts, boundPort);

  // Auth middleware — session gate for non-public API paths
  router.use((req, res) => {
    const url = req.url ?? "/";
    const path = url.split("?")[0] ?? "/";
    const isApiPath = path === "/api" || path.startsWith("/api/");
    if (isApiPath && !PUBLIC_API_PATHS.has(path)) {
      if (!authenticateRequest(db, req)) {
        sendJson(res, 401, { error: "unauthorized" });
        return false;
      }
    }
  });

  // Register route modules
  registerAuthRoutes(router, db, PUBLIC_API_PATHS);
  registerSettingsRoutes(router, db);
  registerIntegrationRoutes(router);

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const url = req.url ?? "/";
        const path = url.split("?")[0] ?? "/";
        const method = req.method ?? "GET";

        // API paths go through the router
        const isApiPath = path === "/api" || path.startsWith("/api/");
        if (isApiPath) {
          await router.dispatch(req, res);
          return;
        }

        // Non-API: serve static SPA
        if (method === "GET" && serveStatic(path, webRoot, res)) return;

        sendJson(res, 404, { error: "not found" });
      } catch (err) {
        console.error("unhandled request error:", err);
        if (res.headersSent) {
          res.destroy();
        } else {
          sendJson(res, 500, { error: "internal error" });
        }
      }
    })();
  });

  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    boundPort = typeof address === "object" && address ? address.port : port;
    console.log(`Server : http://127.0.0.1:${String(boundPort)}`);
    console.log(`DB     : ${dbPath}`);
  });

  return server;
}

function serveStatic(urlPath: string, webRoot: string, res: ServerResponse): boolean {
  if (!existsSync(webRoot)) return false;
  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const target = resolve(webRoot, normalize(relative));
  if (!target.startsWith(resolve(webRoot))) return false;
  const file = existsSync(target) && !target.endsWith("/") ? target : join(webRoot, "index.html");
  if (!existsSync(file)) return false;
  const body = readFileSync(file);
  res.writeHead(200, {
    "content-type": MIME[extname(file)] ?? "application/octet-stream",
    "content-length": body.length,
  });
  res.end(body);
  return true;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  startWebServer({
    dbPath: process.env.DB_PATH ?? "data/instance.sqlite",
    port: process.env.PORT ? Number(process.env.PORT) : 4319,
    webRoot: process.env.WEB_ROOT ?? "web/dist",
  });
}
```

- [ ] **Step 2: Remove unused imports and dead code from `web-server.ts`**

Remove these imports that are no longer used in `web-server.ts`:
- `getInstanceSettings`, `completeFirstRun` from `./db/settings.js`
- `getUserById` from `./db/users.js`
- `AuthError`, `login`, `logout`, `register`, `setupRequired` from `./auth/service.js`
- `SESSION_COOKIE_NAME`, `buildClearedSessionCookie`, `buildSessionCookie`, `parseCookies` from `./auth/cookie.js`
- `getIntegrationStatus`, `connectWithApiKey`, `disconnectApiKey` from `./pipeline/integrations.js`
- `validateRepoPath` from `./http-utils.js`
- `readJsonBody`, `sendCaughtError`, `decodePathSegment` from `./http-utils.js`
- `existsSync`, `statSync`, `isAbsolute` from `node:fs` / `node:path` (keep only what `serveStatic` and `parseTrustedHosts` need)

Also remove:
- `MAX_BODY_BYTES` constant (already in `http-utils.ts`)
- The `handleAuthRequest` function
- The `COOKIE_SECURE` constant (now only in `routes/auth.ts`)
- The `isTrustedHost` and `originMatchesHost` functions (now in `router.ts`)

- [ ] **Step 3: Remove duplicate `sendJson` import**

If `web-server.ts` still imports `sendJson` from both the old location and `./http-utils.js`, clean up to a single import from `./http-utils.js`.

- [ ] **Step 4: Build and run all tests**

Run: `npm run build && npm run test`
Expected: All tests pass — both unit tests and the existing `web-server.test.ts` integration test.

Specifically verify that `web-server.test.ts` passes — it tests auth flows, CSRF guards, Host guards, and the 404/401 behavior through the full server. All of these must produce identical responses.

- [ ] **Step 5: Commit**

```bash
git add src/web-server.ts
git commit -m "refactor: wire web-server through Router + route modules"
```

---

### Task 6: Final verification and cleanup

**Files:** None new — verify everything passes.

- [ ] **Step 1: Full build and test**

```bash
npm run build
npm run test
```

Expected: Zero failures across all test files (`router.test.js`, `routes/auth.test.js`, `routes/settings.test.js`, `web-server.test.js`, and all pre-existing tests in `db/`, `auth/`, `engine/`, `pipeline/`).

- [ ] **Step 2: Inspect `web-server.ts` line count**

The file should be significantly shorter than the current ~330 lines. Target: under 120 lines (wiring + static serving).

- [ ] **Step 3: Verify no behavioral regressions manually**

```bash
npm run build && npm start
```

Then in another terminal:
```bash
# Should return setup_required
curl -s http://127.0.0.1:4319/api/auth/me | jq

# Should reject unauthenticated access  
curl -s http://127.0.0.1:4319/api/settings/project | jq

# Should serve the SPA
curl -s http://127.0.0.1:4319/ | head -5
```

- [ ] **Step 4: Update CHANGELOG.md**

Append: `- 2026-08-04: [http-routing-layer] | @riaenriala - extracted monolith web-server into Router class + per-domain route modules (auth, settings, integrations)`

- [ ] **Step 5: Final commit**

```bash
git add CHANGELOG.md
git commit -m "chore: changelog for http routing layer refactor"
```
