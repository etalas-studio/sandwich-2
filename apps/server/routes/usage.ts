import type { Router } from "../router.js";
import { authenticateRequest } from "../auth/middleware.js";
import { getMonthlyUsage } from "../db/repo/usage.js";
import { getActiveSubscription } from "../db/repo/subscriptions.js";
import { sendJson } from "../http-utils.js";
import type { Database } from "../db/connection.js";

const STARTER_LIMIT = 5;

export function registerUsageRoutes(router: Router, db: Database): void {
  router.get("/api/usage", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const used = await getMonthlyUsage(db, auth.userId);
    const sub = await getActiveSubscription(db, auth.userId);
    const planSlug = sub?.planSlug ?? null;
    const isPro = planSlug === "pro";

    const now = new Date();
    sendJson(res, 200, {
      used,
      yearMonth: `${now.getFullYear()}-${now.getMonth()}`,
      planSlug,
      isPro,
      limit: isPro ? null : STARTER_LIMIT,
    });
  });
}
