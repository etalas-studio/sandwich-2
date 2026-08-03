import { execSync } from "node:child_process";
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

  router.post("/api/settings/sync", (_req, res) => {
    const settings = getInstanceSettings(db);
    if (!settings.repoPath) {
      sendJson(res, 400, { error: "No project path configured" });
      return;
    }
    try {
      const output = execSync("git pull", {
        cwd: settings.repoPath,
        encoding: "utf-8",
        timeout: 30_000,
      });
      sendJson(res, 200, { ok: true, output: output.trim() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { ok: false, error: message });
    }
  });
}
