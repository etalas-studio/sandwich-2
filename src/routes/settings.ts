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
