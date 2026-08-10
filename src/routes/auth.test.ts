import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { Router } from "../router.js";
import { registerAuthRoutes } from "./auth.js";

function mockReq(method: string, path: string, headers: Record<string, string> = {}): any {
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

const PUBLIC = new Set([
  "/api/auth/me",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
]);

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

  it("GET /api/auth/me returns unauthenticated when no session", async () => {
    const router = new Router(new Set(), 0);
    registerAuthRoutes(router, db, PUBLIC);
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/auth/me"), res);
    await res.ended;
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { state: "unauthenticated" });
  });

  it("POST /api/auth/register rejects empty body", async () => {
    const router = new Router(new Set(), 0);
    registerAuthRoutes(router, db, PUBLIC);
    const res = mockRes();
    const req: any = {
      method: "POST",
      url: "/api/auth/register",
      headers: { host: "127.0.0.1:0" },
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from("{}"));
        if (ev === "end") fn();
      },
    };
    await router.dispatch(req, res);
    await res.ended;
    assert.equal(res.statusCode, 400);
  });

  it("full register → login → me flow", async () => {
    const router = new Router(new Set(), 0);
    registerAuthRoutes(router, db, PUBLIC);

    // Register
    const regRes = mockRes();
    const regReq: any = {
      method: "POST",
      url: "/api/auth/register",
      headers: { host: "127.0.0.1:0" },
      on: (ev: string, fn: Function) => {
        if (ev === "data")
          fn(
            Buffer.from(JSON.stringify({ username: "a", email: "a@b.com", password: "hunter22" })),
          );
        if (ev === "end") fn();
      },
    };
    await router.dispatch(regReq, regRes);
    await regRes.ended;
    assert.equal(regRes.statusCode, 200);

    // Login with wrong password
    const badRes = mockRes();
    const badReq: any = {
      method: "POST",
      url: "/api/auth/login",
      headers: { host: "127.0.0.1:0" },
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from(JSON.stringify({ username: "a", password: "wrong" })));
        if (ev === "end") fn();
      },
    };
    await router.dispatch(badReq, badRes);
    await badRes.ended;
    assert.equal(badRes.statusCode, 401);

    // Login correct
    const okRes = mockRes();
    const okReq: any = {
      method: "POST",
      url: "/api/auth/login",
      headers: { host: "127.0.0.1:0" },
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from(JSON.stringify({ username: "a", password: "hunter22" })));
        if (ev === "end") fn();
      },
    };
    await router.dispatch(okReq, okRes);
    await okRes.ended;
    assert.equal(okRes.statusCode, 200);
    const cookie = okRes.headers["set-cookie"];
    assert.ok(cookie && cookie.includes("session="));

    // Me with cookie
    const meRes = mockRes();
    await router.dispatch(mockReq("GET", "/api/auth/me", { cookie }), meRes);
    await meRes.ended;
    assert.equal(meRes.statusCode, 200);
    assert.deepEqual(JSON.parse(meRes.body), { state: "authenticated", user: { username: "a" } });

    // Logout
    const outRes = mockRes();
    await router.dispatch(mockReq("POST", "/api/auth/logout", { cookie }), outRes);
    await outRes.ended;
    assert.equal(outRes.statusCode, 204);

    // Me after logout (no cookie)
    const afterRes = mockRes();
    await router.dispatch(mockReq("GET", "/api/auth/me"), afterRes);
    await afterRes.ended;
    assert.equal(afterRes.statusCode, 200);
    assert.deepEqual(JSON.parse(afterRes.body), { state: "unauthenticated" });
  });
});
