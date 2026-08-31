import type { Router } from "express";
import type { HttpDeps } from "./types.js";
import { getUserById, updatePassword } from "../../db/users.js";
import { authenticateRequest } from "../../auth/middleware.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import { setPreference, getPreference } from "../../db/repo/user-preferences.js";

export function registerAccountRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

  router.get("/api/account", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const user = await getUserById(db, auth.userId);
    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.status(200).json({
      username: user.username,
      email: user.email,
    });
  });

  router.put("/api/account/password", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const body = req.body as {
      currentPassword?: string;
      newPassword?: string;
    } | null;

    if (!body || !body.currentPassword || !body.newPassword) {
      res.status(400).json({
        error: "currentPassword and newPassword are required",
      });
      return;
    }

    if (body.currentPassword === body.newPassword) {
      res.status(400).json({
        error: "new password must be different from current password",
      });
      return;
    }

    const user = await getUserById(db, auth.userId);
    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const passwordOk = await verifyPassword(
      body.currentPassword,
      user.passwordHash,
    );
    if (!passwordOk) {
      res.status(400).json({ error: "current password is incorrect" });
      return;
    }

    const newHash = await hashPassword(body.newPassword);
    await updatePassword(db, user.id, newHash);
    res.status(200).json({ ok: true });
  });

  router.get("/api/preferences/:key", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const value = await getPreference(db, auth.userId, req.params.key!);
    res.status(200).json({ key: req.params.key, value });
  });

  router.put("/api/preferences/:key", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const key = req.params.key!;
    if (key.length > 128) {
      res.status(400).json({ error: "key too long (max 128 chars)" });
      return;
    }
    const body = req.body as {
      value?: string;
    } | null;
    if (!body || body.value === undefined) {
      res.status(400).json({ error: "value is required" });
      return;
    }
    if (body.value.length > 4096) {
      res.status(400).json({ error: "value too long (max 4096 chars)" });
      return;
    }
    await setPreference(db, auth.userId, key, body.value);
    res.status(200).json({ key, value: body.value });
  });
}
