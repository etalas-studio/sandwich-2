import type { Router } from "../../router.js";
import type { HttpDeps } from "./types.js";
import { getUserById, updatePassword } from "../../db/users.js";
import { authenticateRequest } from "../../auth/middleware.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { sendJson, readJsonBody } from "../../http-utils.js";
import { setPreference, getPreference } from "../../db/repo/user-preferences.js";

export function registerAccountRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

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

  router.get("/api/preferences/:key", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const value = await getPreference(db, auth.userId, params.key!);
    sendJson(res, 200, { key: params.key, value });
  });

  router.put("/api/preferences/:key", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const key = params.key!;
    if (key.length > 128) {
      sendJson(res, 400, { error: "key too long (max 128 chars)" });
      return;
    }
    const body = (await readJsonBody(req).catch(() => null)) as {
      value?: string;
    } | null;
    if (!body || body.value === undefined) {
      sendJson(res, 400, { error: "value is required" });
      return;
    }
    if (body.value.length > 4096) {
      sendJson(res, 400, { error: "value too long (max 4096 chars)" });
      return;
    }
    await setPreference(db, auth.userId, key, body.value);
    sendJson(res, 200, { key, value: body.value });
  });
}
