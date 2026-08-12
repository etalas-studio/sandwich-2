import type { Router } from "../router.js";
import { authenticateRequest } from "../auth/middleware.js";
import { createSubscription, getActiveSubscription } from "../db/repo/subscriptions.js";
import { sendJson, readJsonBody } from "../http-utils.js";
import type { Database } from "../db/connection.js";

export function registerSubscriptionRoutes(router: Router, db: Database): void {
  // Create subscription (called after Midtrans payment success)
  router.post("/api/subscriptions", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      planSlug?: string;
    } | null;
    if (!body || !body.planSlug || !["starter", "pro"].includes(body.planSlug)) {
      sendJson(res, 400, { error: "planSlug must be 'starter' or 'pro'" });
      return;
    }

    const sub = await createSubscription(db, {
      userId: auth.userId,
      planSlug: body.planSlug,
    });
    sendJson(res, 201, sub);
  });

  // Get current subscription (for dashboard/auth gate)
  router.get("/api/subscriptions/active", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const sub = await getActiveSubscription(db, auth.userId);
    if (!sub) {
      sendJson(res, 200, { planSlug: null });
      return;
    }
    sendJson(res, 200, { planSlug: sub.planSlug, status: sub.status, startedAt: sub.startedAt });
  });
}
