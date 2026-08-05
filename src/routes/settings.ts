import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import { getCurrentProject, setAutoOpenPr } from "../db/project.js";
import { sendJson, readJsonBody } from "../http-utils.js";

export function registerSettingsRoutes(router: Router, db: Database.Database): void {
  router.get("/api/settings", (_req, res) => {
    const project = getCurrentProject(db);
    sendJson(res, 200, {
      autoOpenPr: project?.autoOpenPr ?? true,
    });
  });

  router.put("/api/settings", async (req, res) => {
    const body = (await readJsonBody(req).catch(() => null)) as { autoOpenPr?: boolean } | null;
    if (!body || typeof body.autoOpenPr !== "boolean") {
      sendJson(res, 400, { error: "autoOpenPr must be a boolean" });
      return;
    }
    const updated = setAutoOpenPr(db, body.autoOpenPr);
    if (!updated) {
      sendJson(res, 404, { error: "No project configured" });
      return;
    }
    sendJson(res, 200, { autoOpenPr: updated.autoOpenPr });
  });
}
