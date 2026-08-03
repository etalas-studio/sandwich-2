import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { Router } from "../router.js";
import { registerScanRoutes } from "./scans.js";

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

describe("scan routes", () => {
  let db: ReturnType<typeof openDb>;
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "scan-routes-test-"));
    db = openDb(join(tmpDir, "db.sqlite"));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("POST /api/scans/run returns 503 when no repoPath configured", async () => {
    const router = new Router(new Set(), 0);
    registerScanRoutes(router, db, async () => {});
    const res = mockRes();
    await router.dispatch(mockReq("POST", "/api/scans/run"), res);
    assert.equal(res.statusCode, 503);
    assert.ok(JSON.parse(res.body).error.includes("project"));
  });

  it("POST /api/scans/run returns scanId when repoPath is set", async () => {
    // Set repo path
    db.prepare("UPDATE instance_settings SET repo_path = ? WHERE id = 1").run("/test/repo");

    const router = new Router(new Set(), 0);
    // Inject a no-op run function
    let runCalled = false;
    registerScanRoutes(router, db, async (_scanId, _repoPath, _signal) => {
      runCalled = true;
    });
    const res = mockRes();
    await router.dispatch(mockReq("POST", "/api/scans/run"), res);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.scanId);
    assert.equal(typeof body.scanId, "string");
    // The runner is async, so runCalled may not be true immediately
    // We just check the response shape
  });

  it("GET /api/scans/latest returns null when no scan has run", async () => {
    const router = new Router(new Set(), 0);
    registerScanRoutes(router, db, async () => {});
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/scans/latest"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, "null");
  });

  it("POST /api/scans/run returns 409 when a scan is already in flight", async () => {
    // Set repo path
    db.prepare("UPDATE instance_settings SET repo_path = ? WHERE id = 1").run("/test/repo");

    const router = new Router(new Set(), 0);
    // The runner never resolves, keeping inFlight non-empty
    registerScanRoutes(router, db, () => new Promise(() => {}));

    // First scan — should succeed
    const res1 = mockRes();
    await router.dispatch(mockReq("POST", "/api/scans/run"), res1);
    assert.equal(res1.statusCode, 200);

    // Second scan — should get 409
    const res2 = mockRes();
    await router.dispatch(mockReq("POST", "/api/scans/run"), res2);
    assert.equal(res2.statusCode, 409);
    assert.ok(JSON.parse(res2.body).error.includes("already in progress"));
  });

  it("POST /api/scans/abort returns 404 for unknown scan", async () => {
    const router = new Router(new Set(), 0);
    registerScanRoutes(router, db, async () => {});
    const res = mockRes();
    const req: any = {
      method: "POST", url: "/api/scans/abort", headers: { host: "127.0.0.1:0", "content-type": "application/json" },
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from(JSON.stringify({ scanId: "nonexistent" })));
        if (ev === "end") fn();
      },
    };
    await router.dispatch(req, res);
    assert.equal(res.statusCode, 404);
  });
});
