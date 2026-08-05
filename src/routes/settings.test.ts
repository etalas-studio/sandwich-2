import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { createUser } from "../db/users.js";
import { hashPassword } from "../auth/password.js";
import { createSession } from "../db/sessions.js";
import { SESSION_COOKIE_NAME, buildSessionCookie, sessionExpiryIso } from "../auth/cookie.js";
import { authenticateRequest } from "../auth/middleware.js";
import { sendJson } from "../http-utils.js";
import { Router } from "../router.js";
import { registerSettingsRoutes } from "./settings.js";

function mockReq(
  method: string,
  path: string,
  headers: Record<string, string> = {},
): any {
  return { method, url: path, headers: { host: "127.0.0.1:0", ...headers }, on: () => {} };
}

function mockRes(): any {
  const res: any = { statusCode: 0, body: "", headers: {} };
  let _resolve: () => void;
  res.ended = new Promise<void>((r) => {
    _resolve = r;
  });
  res.writeHead = (s: number, h?: any) => {
    res.statusCode = s;
    if (h) Object.assign(res.headers, h);
  };
  res.end = (p?: string) => {
    if (p !== undefined) res.body = p;
    _resolve();
  };
  res.destroy = () => {
    _resolve();
  };
  return res;
}

describe("settings routes — account", () => {
  let db: ReturnType<typeof openDb>;
  let tmpDir: string;
  let userId: string;
  let cookieHeader: string;

  before(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "settings-routes-test-"));
    db = openDb(join(tmpDir, "db.sqlite"));

    const passwordHash = await hashPassword("hunter22");
    const user = createUser(db, {
      username: "testuser",
      email: "test@example.com",
      passwordHash,
    });
    userId = user.id;

    const session = createSession(db, userId, sessionExpiryIso());
    cookieHeader = buildSessionCookie(session.token, false);
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("GET /api/account returns username and email for authenticated user", async () => {
    const router = new Router(new Set(), 0);
    registerSettingsRoutes(router, db);
    const res = mockRes();
    await router.dispatch(
      mockReq("GET", "/api/account", { cookie: cookieHeader }),
      res,
    );
    await res.ended;
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      username: "testuser",
      email: "test@example.com",
    });
  });

  it("GET /api/account returns 401 without session cookie", async () => {
    const router = new Router(new Set(), 0);
    // Simulate the auth middleware that web-server.ts applies
    router.use((req, res) => {
      if (!authenticateRequest(db, req)) {
        sendJson(res, 401, { error: "unauthorized" });
        return false;
      }
    });
    registerSettingsRoutes(router, db);
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/account"), res);
    await res.ended;
    assert.equal(res.statusCode, 401);
  });

  it("PUT /api/account/password updates password when current is correct", async () => {
    const router = new Router(new Set(), 0);
    registerSettingsRoutes(router, db);

    const req: any = {
      method: "PUT",
      url: "/api/account/password",
      headers: { host: "127.0.0.1:0", cookie: cookieHeader },
      on: (ev: string, fn: Function) => {
        if (ev === "data")
          fn(
            Buffer.from(
              JSON.stringify({ currentPassword: "hunter22", newPassword: "newpass" }),
            ),
          );
        if (ev === "end") fn();
      },
    };

    const res = mockRes();
    await router.dispatch(req, res);
    await res.ended;
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { ok: true });
  });

  it("PUT /api/account/password rejects when current password is wrong", async () => {
    const router = new Router(new Set(), 0);
    registerSettingsRoutes(router, db);

    const req: any = {
      method: "PUT",
      url: "/api/account/password",
      headers: { host: "127.0.0.1:0", cookie: cookieHeader },
      on: (ev: string, fn: Function) => {
        if (ev === "data")
          fn(
            Buffer.from(
              JSON.stringify({ currentPassword: "wrongpass", newPassword: "newpass" }),
            ),
          );
        if (ev === "end") fn();
      },
    };

    const res = mockRes();
    await router.dispatch(req, res);
    await res.ended;
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "current password is incorrect");
  });

  it("PUT /api/account/password rejects when body is missing fields", async () => {
    const router = new Router(new Set(), 0);
    registerSettingsRoutes(router, db);

    const req: any = {
      method: "PUT",
      url: "/api/account/password",
      headers: { host: "127.0.0.1:0", cookie: cookieHeader },
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from(JSON.stringify({})));
        if (ev === "end") fn();
      },
    };

    const res = mockRes();
    await router.dispatch(req, res);
    await res.ended;
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "currentPassword and newPassword are required");
  });

  it("PUT /api/account/password rejects when new password is same as current", async () => {
    const router = new Router(new Set(), 0);
    registerSettingsRoutes(router, db);

    const req: any = {
      method: "PUT",
      url: "/api/account/password",
      headers: { host: "127.0.0.1:0", cookie: cookieHeader },
      on: (ev: string, fn: Function) => {
        if (ev === "data")
          fn(
            Buffer.from(
              JSON.stringify({ currentPassword: "hunter22", newPassword: "hunter22" }),
            ),
          );
        if (ev === "end") fn();
      },
    };

    const res = mockRes();
    await router.dispatch(req, res);
    await res.ended;
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "new password must be different from current password");
  });
});
