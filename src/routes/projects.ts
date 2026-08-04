import { execFile } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import type { VcsClient } from "../pipeline/vcs-types.js";
import type { ProjectProvider } from "../db/project.js";
import { createProject, getCurrentProject, markProjectReady, markProjectFailed, clearProject as clearProjectRow } from "../db/project.js";
import { buildCloneUrl, cloneRepo as defaultCloneRepo } from "../pipeline/project-clone.js";
import { sendJson, readJsonBody } from "../http-utils.js";

export type GitPullFn = (dir: string) => Promise<{ ok: true; output: string } | { ok: false; error: string }>;

export interface ProjectRouteDeps {
  vcsClients: Record<ProjectProvider, VcsClient>;
  getOAuthToken: (provider: string) => string | null;
  reposDir: string;
  cloneRepo?: typeof defaultCloneRepo;
  gitPull?: GitPullFn;
}

function isProjectProvider(value: unknown): value is ProjectProvider {
  return value === "github" || value === "bitbucket";
}

function defaultGitPull(dir: string): Promise<{ ok: true; output: string } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    execFile("git", ["-C", dir, "pull"], { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, error: stderr.toString().trim() || err.message });
        return;
      }
      resolve({ ok: true, output: stdout.toString().trim() });
    });
  });
}

export function registerProjectRoutes(
  router: Router,
  db: Database.Database,
  deps: ProjectRouteDeps,
): void {
  const cloneRepo = deps.cloneRepo ?? defaultCloneRepo;
  const gitPull = deps.gitPull ?? defaultGitPull;

  router.get("/api/projects/current", (_req, res) => {
    sendJson(res, 200, getCurrentProject(db));
  });

  router.get("/api/projects/orgs", async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const provider = url.searchParams.get("provider");
    if (!isProjectProvider(provider)) {
      sendJson(res, 400, { error: "provider must be 'github' or 'bitbucket'" });
      return;
    }
    const token = deps.getOAuthToken(provider);
    if (!token) {
      sendJson(res, 409, { error: `${provider} is not connected` });
      return;
    }
    try {
      const orgs = await deps.vcsClients[provider].listOrgs(token);
      sendJson(res, 200, orgs);
    } catch (err) {
      sendJson(res, 502, { error: err instanceof Error ? err.message : "failed to list orgs" });
    }
  });

  router.get("/api/projects/repos", async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const provider = url.searchParams.get("provider");
    const org = url.searchParams.get("org");
    const page = Number(url.searchParams.get("page") ?? "1");
    const q = url.searchParams.get("q") ?? undefined;

    if (!isProjectProvider(provider)) {
      sendJson(res, 400, { error: "provider must be 'github' or 'bitbucket'" });
      return;
    }
    if (!org) {
      sendJson(res, 400, { error: "org is required" });
      return;
    }
    const token = deps.getOAuthToken(provider);
    if (!token) {
      sendJson(res, 409, { error: `${provider} is not connected` });
      return;
    }
    try {
      const page_ = await deps.vcsClients[provider].listRepos(token, org, { page, q });
      sendJson(res, 200, page_);
    } catch (err) {
      sendJson(res, 502, { error: err instanceof Error ? err.message : "failed to list repos" });
    }
  });

  router.post("/api/projects/connect", async (req, res) => {
    if (getCurrentProject(db)) {
      sendJson(res, 409, { error: "A project is already connected. Clear it first." });
      return;
    }

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "invalid body" });
      return;
    }
    const { provider, owner, repoSlug, defaultBranch } = (body as Record<string, unknown>) ?? {};
    if (!isProjectProvider(provider) || typeof owner !== "string" || typeof repoSlug !== "string" || typeof defaultBranch !== "string") {
      sendJson(res, 400, { error: "provider, owner, repoSlug, and defaultBranch are required" });
      return;
    }

    const token = deps.getOAuthToken(provider);
    if (!token) {
      sendJson(res, 409, { error: `${provider} is not connected` });
      return;
    }

    const project = createProject(db, { provider, owner, repoSlug, defaultBranch });
    sendJson(res, 200, project);

    // Fire-and-forget clone — client polls GET /api/projects/current
    void (async () => {
      const cloneUrl = buildCloneUrl(provider, owner, repoSlug, token);
      const targetDir = join(deps.reposDir, project.id);
      const result = await cloneRepo(cloneUrl, targetDir);
      if (result.ok) {
        markProjectReady(db, project.id);
      } else {
        // Remove any partial clone artifacts, but leave the row itself in
        // 'failed' status (with its error) so a client polling
        // GET /api/projects/current can actually observe and display why it
        // failed — clearing immediately here would race the poll. The
        // frontend's "Back to repos" action calls POST /api/projects/clear
        // to reset (safe: a failed clone never created tickets/blocklist/
        // scans, so clear is just removing this one row).
        if (existsSync(targetDir)) rmSync(targetDir, { recursive: true, force: true });
        markProjectFailed(db, project.id, result.error ?? "clone failed");
      }
    })();
  });

  router.post("/api/projects/clear", (_req, res) => {
    const project = getCurrentProject(db);
    if (project) {
      const cloneDir = join(deps.reposDir, project.id);
      if (existsSync(cloneDir)) rmSync(cloneDir, { recursive: true, force: true });
      db.transaction(() => {
        db.prepare("DELETE FROM tickets").run();
        db.prepare("DELETE FROM blocklist").run();
        db.prepare("DELETE FROM readiness_scans").run();
        clearProjectRow(db);
      })();
    }
    sendJson(res, 200, { cleared: true });
  });

  router.post("/api/projects/sync", async (_req, res) => {
    const project = getCurrentProject(db);
    if (!project || project.cloneStatus !== "ready") {
      sendJson(res, 503, { error: "No project configured." });
      return;
    }
    const dir = join(deps.reposDir, project.id);
    const result = await gitPull(dir);
    if (result.ok) {
      sendJson(res, 200, { ok: true, output: result.output });
    } else {
      sendJson(res, 500, { ok: false, error: result.error });
    }
  });
}
