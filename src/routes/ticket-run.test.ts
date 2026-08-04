import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { createProject, markProjectReady } from "../db/project.js";
import { createTicket } from "../db/tickets.js";
import { Router } from "../router.js";
import { registerTicketRunRoutes } from "./ticket-run.js";

const REPOS_DIR = "/data/repos";

function mockReq(method: string, path: string): any {
  return {
    method,
    url: path,
    headers: { host: "127.0.0.1:0" },
    on: (ev: string, fn: Function) => {
      if (ev === "end") fn();
    },
  };
}
function mockRes(): any {
  const res: any = { statusCode: 0, body: "", headers: {} };
  res.writeHead = (s: number, h?: any) => {
    res.statusCode = s;
    if (h) Object.assign(res.headers, h);
  };
  res.end = (p?: string) => {
    if (p !== undefined) res.body = p;
  };
  res.destroy = () => {};
  return res;
}

describe("ticket run routes", () => {
  let db: ReturnType<typeof openDb>;
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "ticket-run-routes-test-"));
    db = openDb(join(tmpDir, "db.sqlite"));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("POST /api/tickets/:key/run returns 503 when no project configured", async () => {
    createTicket(db, { id: "T-1", description: "do a thing", url: null });
    const router = new Router(new Set(), 0);
    registerTicketRunRoutes(
      router,
      db,
      () => ({ run: async () => ({ outcome: "ok", finalText: "" }) }),
      REPOS_DIR,
    );
    const res = mockRes();
    await router.dispatch(mockReq("POST", "/api/tickets/T-1/run"), res);
    assert.equal(res.statusCode, 503);
    assert.ok(JSON.parse(res.body).error.includes("project"));
  });

  it("POST /api/tickets/:key/run starts a run when a project is ready", async () => {
    const project = createProject(db, {
      provider: "github",
      owner: "acme",
      repoSlug: "widgets",
      defaultBranch: "main",
    });
    markProjectReady(db, project.id);
    createTicket(db, { id: "T-2", description: "do a thing", url: null });

    const router = new Router(new Set(), 0);
    registerTicketRunRoutes(
      router,
      db,
      () => ({ run: async () => ({ outcome: "ok", finalText: "" }) }),
      REPOS_DIR,
    );
    const res = mockRes();
    await router.dispatch(mockReq("POST", "/api/tickets/T-2/run"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).started, true);
  });
});
