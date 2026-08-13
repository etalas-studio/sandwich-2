import type { Router } from "../router.js";
import { authenticateRequest } from "../auth/middleware.js";
import { getActiveSubscription } from "../db/repo/subscriptions.js";
import { sendJson } from "../http-utils.js";
import type { Database } from "../db/connection.js";

export function registerSubscriptionRoutes(router: Router, db: Database): void {
  // Get current active subscription (for dashboard/auth gate). Subscriptions
  // are only ever created/extended server-side by the Midtrans webhook.
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
    sendJson(res, 200, {
      planSlug: sub.planSlug,
      status: sub.status,
      startedAt: sub.startedAt,
      expiresAt: sub.expiresAt,
    });
  });
}
