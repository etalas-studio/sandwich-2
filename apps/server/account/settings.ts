import type { Router } from "../router.js";
import { getUserById, updatePassword } from "../db/users.js";
import { authenticateRequest } from "../auth/middleware.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { sendJson, readJsonBody } from "../http-utils.js";
import type { Database } from "../db/connection.js";

export function registerSettingsRoutes(
  router: Router,
  db: Database,
): void {
  router.get("/api/account", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const user = await getUserById(db, auth.userId);
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
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      currentPassword?: string;
      newPassword?: string;
    } | null;

    if (!body || !body.currentPassword || !body.newPassword) {
      sendJson(res, 400, {
        error: "currentPassword and newPassword are required",
      });
      return;
    }

    if (body.currentPassword === body.newPassword) {
      sendJson(res, 400, {
        error: "new password must be different from current password",
      });
      return;
    }

    const user = await getUserById(db, auth.userId);
    if (!user) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const passwordOk = await verifyPassword(
      body.currentPassword,
      user.passwordHash,
    );
    if (!passwordOk) {
      sendJson(res, 400, { error: "current password is incorrect" });
      return;
    }

    const newHash = await hashPassword(body.newPassword);
    await updatePassword(db, user.id, newHash);
    sendJson(res, 200, { ok: true });
  });
}
