import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { Router } from "../router.js";
import { registerSettingsRoutes } from "./settings.js";

function mockReq(method: string, path: string, headers: Record<string, string> = {}): any {
  return { method, url: path, headers: { host: "127.0.0.1:0", ...headers }, on: () => {} };
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
    assert.equal(body.firstRunCompletedAt, null);
  });

  it("POST /api/settings/project rejects non-absolute path", async () => {
    const router = new Router(new Set(), 0);
    registerSettingsRoutes(router, db);
    const res = mockRes();
    const req: any = {
      method: "POST", url: "/api/settings/project", headers: { host: "127.0.0.1:0" },
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
      method: "POST", url: "/api/settings/project", headers: { host: "127.0.0.1:0" },
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from(JSON.stringify({ repoPath: repoDir })));
        if (ev === "end") fn();
      },
    };
    await router.dispatch(req, res);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.repoPath, repoDir);
    assert.equal(typeof body.firstRunCompletedAt, "string");
  });
});
