import type { Router } from "../router.js";
import { authenticateRequest } from "../auth/middleware.js";
import { getMonthlyUsage } from "../db/repo/usage.js";
import { getActiveSubscription } from "../db/repo/subscriptions.js";
import { PLANS } from "../pipeline/plans.js";
import { sendJson } from "../http-utils.js";
import type { Database } from "../db/connection.js";

export function registerUsageRoutes(router: Router, db: Database): void {
  router.get("/api/usage", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const sub = await getActiveSubscription(db, auth.userId);
    const planSlug = sub?.planSlug ?? null;
    const plan = planSlug ? PLANS[planSlug as keyof typeof PLANS] : undefined;
    const isPro = planSlug === "pro";

    const used = await getMonthlyUsage(db, auth.userId, "prd");
    const chatUsed = await getMonthlyUsage(db, auth.userId, "chat");

    const now = new Date();
    sendJson(res, 200, {
      used,
      chatUsed,
      yearMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      planSlug,
      isPro,
      // No active plan ⇒ 0 quota; starter ⇒ its limits; pro ⇒ unlimited.
      limit: isPro ? null : plan ? plan.limit : 0,
      chatLimit: isPro ? null : plan ? plan.chatLimit : 0,
    });
  });
}
