import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import { getCurrentProject, setAutoOpenPr } from "../db/project.js";
import { getUserById, updatePassword } from "../db/users.js";
import { authenticateRequest } from "../auth/middleware.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
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

  router.get("/api/account", (req, res) => {
    const auth = authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const user = getUserById(db, auth.userId);
    if (!user) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    sendJson(res, 200, {
      username: user.username,
      email: user.email,
    });
  });

  router.put("/api/account/password", async (req, res) => {
    const auth = authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      currentPassword?: string;
      newPassword?: string;
    } | null;

    if (!body || !body.currentPassword || !body.newPassword) {
      sendJson(res, 400, { error: "currentPassword and newPassword are required" });
      return;
    }

    if (body.currentPassword === body.newPassword) {
      sendJson(res, 400, { error: "new password must be different from current password" });
      return;
    }

    const user = getUserById(db, auth.userId);
    if (!user) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const passwordOk = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!passwordOk) {
      sendJson(res, 400, { error: "current password is incorrect" });
      return;
    }

    const newHash = await hashPassword(body.newPassword);
    updatePassword(db, user.id, newHash);
    sendJson(res, 200, { ok: true });
  });
}
