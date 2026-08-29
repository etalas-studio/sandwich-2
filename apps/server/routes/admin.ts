import type { Router } from "../router.js";
import type { Database } from "../db/connection.js";
import { requireAdmin } from "../auth/middleware.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import {
  getIntegrationStatus,
  connectWithApiKey,
  disconnectApiKey,
  testProviderConnection,
  pingStoredProvider,
} from "../integrations/integrations.js";
import {
  ENGINE_STAGES,
  STAGE_SETTING_KEYS,
  STAGE_DEFAULTS,
  getEngineConfig,
  refreshEngineConfig,
} from "../model-runtime.js";
import { setEngineSetting } from "../db/engine-settings.js";
import {
  getAdminStats,
  getAdminUsers,
} from "../db/repo/admin-stats.js";
import { updateUserRole, deleteUser } from "../db/users.js";
import {
  cancelSubscription,
  activateSubscription,
} from "../db/repo/subscriptions.js";
import { getPlan } from "../billing/plans.js";

/**
 * Internal Etalas operator panel — AI engine configuration.
 * Every route is gated by requireAdmin (session cookie + users.role = "admin").
 */
export function registerAdminRoutes(router: Router, db: Database): void {
  // ── Integrations (providers) ───────────────────────────────────────────────

  router.get("/api/admin/integrations", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    try {
      sendJson(res, 200, await getIntegrationStatus());
    } catch (err) {
      sendCaughtError(res, err, "admin integrations list");
    }
  });

  router.post("/api/admin/integrations/:providerId/connect", async (req, res, params) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const body = (await readJsonBody(req).catch(() => null)) as {
      apiKey?: string;
      baseUrl?: string;
    } | null;
    if (!body || typeof body.apiKey !== "string" || !body.apiKey.trim()) {
      sendJson(res, 400, { error: "apiKey is required" });
      return;
    }
    try {
      const result = await connectWithApiKey(
        params.providerId!,
        body.apiKey.trim(),
        typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined,
      );
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (err) {
      sendCaughtError(res, err, "admin integration connect");
    }
  });

  router.post("/api/admin/integrations/:providerId/test", async (req, res, params) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const body = (await readJsonBody(req).catch(() => null)) as {
      apiKey?: string;
      baseUrl?: string;
    } | null;
    if (!body || typeof body.apiKey !== "string" || !body.apiKey.trim()) {
      sendJson(res, 400, { error: "apiKey is required" });
      return;
    }
    try {
      const result = await testProviderConnection(
        params.providerId!,
        body.apiKey.trim(),
        typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined,
      );
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (err) {
      sendCaughtError(res, err, "admin integration test");
    }
  });

  router.post("/api/admin/integrations/:providerId/ping", async (req, res, params) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    try {
      const result = await pingStoredProvider(params.providerId!);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (err) {
      sendCaughtError(res, err, "admin integration ping");
    }
  });

  router.post("/api/admin/integrations/:providerId/disconnect", async (req, res, params) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    try {
      const result = await disconnectApiKey(params.providerId!);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (err) {
      sendCaughtError(res, err, "admin integration disconnect");
    }
  });

  // ── Engine config (provider/model per stage) ───────────────────────────────

  router.get("/api/admin/engine", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    try {
      const stages: Record<string, { provider: string; model: string; value: string }> = {};
      for (const stage of ENGINE_STAGES) {
        const cfg = await getEngineConfig(stage);
        stages[stage] = { ...cfg, value: `${cfg.provider}/${cfg.model}` };
      }
      const integrations = await getIntegrationStatus();
      sendJson(res, 200, { stages, defaults: STAGE_DEFAULTS, integrations });
    } catch (err) {
      sendCaughtError(res, err, "admin engine");
    }
  });

  router.put("/api/admin/engine", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const body = (await readJsonBody(req).catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "invalid body" });
      return;
    }
    try {
      for (const stage of ENGINE_STAGES) {
        const value = body[stage];
        if (value === undefined) continue;
        if (typeof value !== "string" || !value.trim()) {
          sendJson(res, 400, { error: `invalid value for ${stage}` });
          return;
        }
        const trimmed = value.trim();
        const slash = trimmed.indexOf("/");
        if (slash <= 0 || slash === trimmed.length - 1) {
          sendJson(res, 400, { error: `invalid value for ${stage}: expected "provider/model"` });
          return;
        }
        await setEngineSetting(db, STAGE_SETTING_KEYS[stage], trimmed);
      }
      refreshEngineConfig();
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendCaughtError(res, err, "admin engine update");
    }
  });

  // ── Stats dashboard ────────────────────────────────────────────────────────

  router.get("/api/admin/stats", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    try {
      const stats = await getAdminStats(db);
      sendJson(res, 200, stats);
    } catch (err) {
      sendCaughtError(res, err, "admin stats");
    }
  });

  // ── Users list ─────────────────────────────────────────────────────────────

  router.get("/api/admin/users", async (req, res) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const page = (() => {
        const n = parseInt(url.searchParams.get("page") ?? "1", 10);
        return Number.isFinite(n) && n > 0 ? n : 1;
      })();
      const limit = (() => {
        const n = parseInt(url.searchParams.get("limit") ?? "50", 10);
        return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 50;
      })();
      const search = url.searchParams.get("search")?.trim() || undefined;
      const role = url.searchParams.get("role") || undefined;
      const result = await getAdminUsers(db, page, limit, search, role);
      sendJson(res, 200, { ...result, page });
    } catch (err) {
      sendCaughtError(res, err, "admin users");
    }
  });

  // ── User role update ───────────────────────────────────────────────────────

  router.post("/api/admin/users/:id/role", async (req, res, params) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const body = (await readJsonBody(req).catch(() => null)) as { role?: string } | null;
    if (!body || (body.role !== "user" && body.role !== "admin")) {
      sendJson(res, 400, { error: "role must be 'user' or 'admin'" });
      return;
    }
    try {
      await updateUserRole(db, params.id!, body.role);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendCaughtError(res, err, "admin user role");
    }
  });

  // ── User subscription manage ───────────────────────────────────────────────

  router.post("/api/admin/users/:id/subscription", async (req, res, params) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const body = (await readJsonBody(req).catch(() => null)) as {
      action?: string;
      planSlug?: string;
    } | null;
    if (!body || (body.action !== "cancel" && body.action !== "grant")) {
      sendJson(res, 400, { error: "action must be 'cancel' or 'grant'" });
      return;
    }
    if (body.action === "grant") {
      if (!body.planSlug || !getPlan(body.planSlug)) {
        sendJson(res, 400, { error: "planSlug must be 'starter' or 'pro'" });
        return;
      }
      try {
        await activateSubscription(db, { userId: params.id!, planSlug: body.planSlug });
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendCaughtError(res, err, "admin user grant subscription");
      }
    } else {
      try {
        await cancelSubscription(db, params.id!);
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendCaughtError(res, err, "admin user cancel subscription");
      }
    }
  });

  // ── Delete user ───────────────────────────────────────────────────────────

  router.delete("/api/admin/users/:id", async (req, res, params) => {
    if (!(await requireAdmin(db, req))) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    try {
      await deleteUser(db, params.id!);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendCaughtError(res, err, "admin user delete");
    }
  });
}
