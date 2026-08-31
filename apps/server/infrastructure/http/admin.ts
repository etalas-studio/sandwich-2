import type { Router } from "express";
import type { HttpDeps } from "./types.js";
import { requireAdmin } from "../../auth/middleware.js";
import { sendCaughtErrorExpress } from "../../http-utils.js";
import {
  getIntegrationStatus,
  connectWithApiKey,
  disconnectApiKey,
  testProviderConnection,
  pingStoredProvider,
} from "../../integrations/integrations.js";
import {
  ENGINE_STAGES,
  STAGE_SETTING_KEYS,
  STAGE_DEFAULTS,
  getEngineConfig,
  refreshEngineConfig,
} from "../../model-runtime.js";
import { setEngineSetting } from "../../db/engine-settings.js";
import {
  getAdminStats,
  getAdminUsers,
} from "../../db/repo/admin-stats.js";
import { updateUserRole, deleteUser } from "../../db/users.js";
import {
  cancelSubscription,
  activateSubscription,
} from "../../db/repo/subscriptions.js";
import { getPlan } from "../../billing/plans.js";

export function registerAdminRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

  // ── Integrations (providers) ──────────────────────────────────────────────

  router.get("/api/admin/integrations", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      res.status(200).json(await getIntegrationStatus());
    } catch (err) {
      sendCaughtErrorExpress(res, err, "admin integrations list");
    }
  });

  router.post("/api/admin/integrations/:providerId/connect", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as {
      apiKey?: string;
      baseUrl?: string;
    } | null;
    if (!body || typeof body.apiKey !== "string" || !body.apiKey.trim()) {
      res.status(400).json({ error: "apiKey is required" });
      return;
    }
    try {
      const result = await connectWithApiKey(
        req.params.providerId!,
        body.apiKey.trim(),
        typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined,
      );
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      sendCaughtErrorExpress(res, err, "admin integration connect");
    }
  });

  router.post("/api/admin/integrations/:providerId/test", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as {
      apiKey?: string;
      baseUrl?: string;
    } | null;
    if (!body || typeof body.apiKey !== "string" || !body.apiKey.trim()) {
      res.status(400).json({ error: "apiKey is required" });
      return;
    }
    try {
      const result = await testProviderConnection(
        req.params.providerId!,
        body.apiKey.trim(),
        typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined,
      );
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      sendCaughtErrorExpress(res, err, "admin integration test");
    }
  });

  router.post("/api/admin/integrations/:providerId/ping", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const result = await pingStoredProvider(req.params.providerId!);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      sendCaughtErrorExpress(res, err, "admin integration ping");
    }
  });

  router.post("/api/admin/integrations/:providerId/disconnect", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const result = await disconnectApiKey(req.params.providerId!);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      sendCaughtErrorExpress(res, err, "admin integration disconnect");
    }
  });

  // ── Engine config (provider/model per stage) ──────────────────────────────

  router.get("/api/admin/engine", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const stages: Record<string, { provider: string; model: string; value: string }> = {};
      for (const stage of ENGINE_STAGES) {
        const cfg = await getEngineConfig(stage);
        stages[stage] = { ...cfg, value: `${cfg.provider}/${cfg.model}` };
      }
      const integrations = await getIntegrationStatus();
      res.status(200).json({ stages, defaults: STAGE_DEFAULTS, integrations });
    } catch (err) {
      sendCaughtErrorExpress(res, err, "admin engine get");
    }
  });

  router.post("/api/admin/engine", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "invalid body" });
      return;
    }
    try {
      for (const stage of ENGINE_STAGES) {
        const value = body[stage];
        if (value === undefined) continue;
        if (typeof value !== "string" || !value.trim()) {
          res.status(400).json({ error: `invalid value for ${stage}` });
          return;
        }
        const trimmed = value.trim();
        const slash = trimmed.indexOf("/");
        if (slash <= 0 || slash === trimmed.length - 1) {
          res.status(400).json({ error: `invalid value for ${stage}: expected "provider/model"` });
          return;
        }
        await setEngineSetting(db, STAGE_SETTING_KEYS[stage], trimmed);
      }
      refreshEngineConfig();
      res.status(200).json({ ok: true });
    } catch (err) {
      sendCaughtErrorExpress(res, err, "admin engine update");
    }
  });

  // ── Stats dashboard ────────────────────────────────────────────────────────

  router.get("/api/admin/stats", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const stats = await getAdminStats(db);
      res.status(200).json(stats);
    } catch (err) {
      sendCaughtErrorExpress(res, err, "admin stats");
    }
  });

  // ── Users list ─────────────────────────────────────────────────────────────

  router.get("/api/admin/users", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const page = (() => {
        const n = parseInt(String(req.query.page ?? "1"), 10);
        return Number.isFinite(n) && n > 0 ? n : 1;
      })();
      const limit = (() => {
        const n = parseInt(String(req.query.limit ?? "20"), 10);
        return Number.isFinite(n) && n > 0 && n <= 100 ? n : 20;
      })();
      const search = typeof req.query.search === "string" ? req.query.search.trim() || undefined : undefined;
      const role = typeof req.query.role === "string" ? req.query.role || undefined : undefined;
      const result = await getAdminUsers(db, page, limit, search, role);
      res.status(200).json({ ...result, page });
    } catch (err) {
      sendCaughtErrorExpress(res, err, "admin users list");
    }
  });

  router.post("/api/admin/users/:id/role", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as { role?: string } | null;
    if (!body || (body.role !== "user" && body.role !== "admin")) {
      res.status(400).json({ error: "role must be 'user' or 'admin'" });
      return;
    }
    try {
      await updateUserRole(db, req.params.id!, body.role);
      res.status(200).json({ ok: true });
    } catch (err) {
      sendCaughtErrorExpress(res, err, "admin user role");
    }
  });

  // ── User subscription manage ──────────────────────────────────────────────

  router.post("/api/admin/users/:id/subscription", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as {
      action?: string;
      planSlug?: string;
    } | null;
    if (!body || (body.action !== "cancel" && body.action !== "grant")) {
      res.status(400).json({ error: "action must be 'cancel' or 'grant'" });
      return;
    }
    if (body.action === "grant") {
      if (!body.planSlug || !getPlan(body.planSlug)) {
        res.status(400).json({ error: "planSlug must be 'starter' or 'pro'" });
        return;
      }
      try {
        await activateSubscription(db, { userId: req.params.id!, planSlug: body.planSlug });
        res.status(200).json({ ok: true });
      } catch (err) {
        sendCaughtErrorExpress(res, err, "admin user grant subscription");
      }
    } else {
      try {
        await cancelSubscription(db, req.params.id!);
        res.status(200).json({ ok: true });
      } catch (err) {
        sendCaughtErrorExpress(res, err, "admin user cancel subscription");
      }
    }
  });

  // ── Delete user ────────────────────────────────────────────────────────────

  router.delete("/api/admin/users/:id", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      await deleteUser(db, req.params.id!);
      res.status(200).json({ ok: true });
    } catch (err) {
      sendCaughtErrorExpress(res, err, "admin user delete");
    }
  });
}
