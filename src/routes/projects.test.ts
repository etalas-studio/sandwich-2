import { strict as assert } from "node:assert";
import { describe, it, before, after, beforeEach } from "node:test";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { getCurrentProject } from "../db/project.js";
import { Router } from "../router.js";
import { registerProjectRoutes } from "./projects.js";
import type { ProjectRouteDeps } from "./projects.js";
import type { VcsClient } from "../pipeline/vcs-types.js";

function mockReq(method: string, path: string, body?: unknown): any {
  return {
    method,
    url: path,
    headers: { host: "127.0.0.1:0", "content-type": "application/json" },
    on: (ev: string, fn: Function) => {
      if (ev === "data" && body !== undefined) fn(Buffer.from(JSON.stringify(body)));
      if (ev === "end") fn();
    },
  };
}
function mockRes(): any {
  const res: any = { statusCode: 0, body: "", headers: {} };
  res.writeHead = (s: number, h?: any) => { res.statusCode = s; if (h) Object.assign(res.headers, h); };
  res.end = (p?: string) => { if (p !== undefined) res.body = p; };
  res.destroy = () => {};
  return res;
}

function fakeVcsClient(overrides: Partial<VcsClient> = {}): VcsClient {
  return {
    listOrgs: async () => [{ slug: "acme", name: "acme", isPersonal: false }],
    listRepos: async () => ({ repos: [{ owner: "acme", slug: "widgets", defaultBranch: "main" }], nextPage: null }),
    ...overrides,
  };
}

describe("project routes", () => {
  let db: ReturnType<typeof openDb>;
  let tmpDir: string;
  let reposDir: string;
  let deps: ProjectRouteDeps;
  let tokens: Record<string, string | null>;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "project-routes-test-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    const dbDir = mkdtempSync(join(tmpDir, "db-"));
    db = openDb(join(dbDir, "db.sqlite"));
    reposDir = mkdtempSync(join(tmpDir, "repos-"));
    tokens = { github: "gh-token", bitbucket: "bb-token" };
    deps = {
      vcsClients: { github: fakeVcsClient(), bitbucket: fakeVcsClient() },
      getOAuthToken: (provider) => tokens[provider] ?? null,
      reposDir,
      cloneRepo: async (_url, targetDir) => {
        mkdirSync(targetDir, { recursive: true });
        return { ok: true };
      },
    };
  });

  it("GET /api/projects/current returns null when no project connected", async () => {
    const router = new Router(new Set(), 0);
    registerProjectRoutes(router, db, deps);
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/projects/current"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, "null");
  });

  it("GET /api/projects/orgs returns orgs for connected provider", async () => {
    const router = new Router(new Set(), 0);
    registerProjectRoutes(router, db, deps);
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/projects/orgs?provider=github"), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), [{ slug: "acme", name: "acme", isPersonal: false }]);
  });

  it("GET /api/projects/orgs returns 409 when provider not connected", async () => {
    tokens.github = null;
    const router = new Router(new Set(), 0);
    registerProjectRoutes(router, db, deps);
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/projects/orgs?provider=github"), res);
    assert.equal(res.statusCode, 409);
    assert.ok(JSON.parse(res.body).error.includes("not connected"));
  });

  it("GET /api/projects/repos returns paginated repos for an org", async () => {
    const router = new Router(new Set(), 0);
    registerProjectRoutes(router, db, deps);
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/projects/repos?provider=github&org=acme&page=1"), res);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body.repos, [{ owner: "acme", slug: "widgets", defaultBranch: "main" }]);
    assert.equal(body.nextPage, null);
  });

  it("POST /api/projects/connect creates a project row and clones asynchronously", async () => {
    const router = new Router(new Set(), 0);
    registerProjectRoutes(router, db, deps);
    const res = mockRes();
    await router.dispatch(
      mockReq("POST", "/api/projects/connect", { provider: "github", owner: "acme", repoSlug: "widgets", defaultBranch: "main" }),
      res,
    );
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.id);

    // Give the fire-and-forget clone a tick to run
    await new Promise((r) => setTimeout(r, 20));

    const project = getCurrentProject(db);
    assert.equal(project?.owner, "acme");
    assert.equal(project?.repoSlug, "widgets");
    assert.equal(project?.cloneStatus, "ready");
    assert.ok(existsSync(join(reposDir, project!.id)));
  });

  it("POST /api/projects/connect returns 409 when a project already exists", async () => {
    const router = new Router(new Set(), 0);
    registerProjectRoutes(router, db, deps);
    await router.dispatch(
      mockReq("POST", "/api/projects/connect", { provider: "github", owner: "acme", repoSlug: "widgets", defaultBranch: "main" }),
      mockRes(),
    );
    await new Promise((r) => setTimeout(r, 20));

    const res = mockRes();
    await router.dispatch(
      mockReq("POST", "/api/projects/connect", { provider: "github", owner: "acme", repoSlug: "other", defaultBranch: "main" }),
      res,
    );
    assert.equal(res.statusCode, 409);
  });

  it("POST /api/projects/connect marks project failed when clone fails", async () => {
    deps.cloneRepo = async () => ({ ok: false, error: "auth failed" });
    const router = new Router(new Set(), 0);
    registerProjectRoutes(router, db, deps);
    const res = mockRes();
    await router.dispatch(
      mockReq("POST", "/api/projects/connect", { provider: "github", owner: "acme", repoSlug: "widgets", defaultBranch: "main" }),
      res,
    );
    await new Promise((r) => setTimeout(r, 20));

    // The row stays around in 'failed' status (with its error) so a client
    // polling GET /api/projects/current can observe why it failed — it is
    // not auto-cleared, to avoid racing the poll. Clearing is a separate,
    // explicit client action (POST /api/projects/clear).
    const project = getCurrentProject(db);
    assert.equal(project?.cloneStatus, "failed");
    assert.equal(project?.cloneError, "auth failed");
  });

  it("POST /api/projects/connect returns 409 when a failed project is still present (not cleared)", async () => {
    deps.cloneRepo = async () => ({ ok: false, error: "auth failed" });
    const router = new Router(new Set(), 0);
    registerProjectRoutes(router, db, deps);
    await router.dispatch(
      mockReq("POST", "/api/projects/connect", { provider: "github", owner: "acme", repoSlug: "widgets", defaultBranch: "main" }),
      mockRes(),
    );
    await new Promise((r) => setTimeout(r, 20));

    const res = mockRes();
    await router.dispatch(
      mockReq("POST", "/api/projects/connect", { provider: "github", owner: "acme", repoSlug: "other", defaultBranch: "main" }),
      res,
    );
    assert.equal(res.statusCode, 409);
  });

  it("POST /api/projects/clear removes the project, its clone dir, and cascades deletes", async () => {
    const router = new Router(new Set(), 0);
    registerProjectRoutes(router, db, deps);
    await router.dispatch(
      mockReq("POST", "/api/projects/connect", { provider: "github", owner: "acme", repoSlug: "widgets", defaultBranch: "main" }),
      mockRes(),
    );
    await new Promise((r) => setTimeout(r, 20));
    const project = getCurrentProject(db)!;
    const cloneDir = join(reposDir, project.id);
    assert.ok(existsSync(cloneDir));

    const res = mockRes();
    await router.dispatch(mockReq("POST", "/api/projects/clear"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(getCurrentProject(db), null);
    assert.equal(existsSync(cloneDir), false);
  });

  it("POST /api/projects/sync runs git pull in the clone directory", async () => {
    const pullCalls: string[] = [];
    deps.cloneRepo = async (_url, targetDir) => {
      mkdirSync(targetDir, { recursive: true });
      mkdirSync(join(targetDir, ".git"), { recursive: true });
      return { ok: true };
    };
    deps.gitPull = async (dir) => {
      pullCalls.push(dir);
      return { ok: true, output: "Already up to date." };
    };

    const router = new Router(new Set(), 0);
    registerProjectRoutes(router, db, deps);
    await router.dispatch(
      mockReq("POST", "/api/projects/connect", { provider: "github", owner: "acme", repoSlug: "widgets", defaultBranch: "main" }),
      mockRes(),
    );
    await new Promise((r) => setTimeout(r, 20));

    const res = mockRes();
    await router.dispatch(mockReq("POST", "/api/projects/sync"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(pullCalls.length, 1);
  });

  it("POST /api/projects/sync returns 503 when no project configured", async () => {
    const router = new Router(new Set(), 0);
    registerProjectRoutes(router, db, deps);
    const res = mockRes();
    await router.dispatch(mockReq("POST", "/api/projects/sync"), res);
    assert.equal(res.statusCode, 503);
  });
});
