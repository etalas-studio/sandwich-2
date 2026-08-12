import type { Router } from "../router.js";
import { tickets, payments, chatMessages, sessions, users, subscriptions, usage, userPreferences, instanceSettings } from "../db/schema.js";
import { sendJson } from "../http-utils.js";
import type { Database } from "../db/connection.js";

export function registerPurgeRoute(router: Router, db: Database): void {
  router.post("/api/purge", async (_req, res) => {
    try {
      await db.transaction(async (tx) => {
        await tx.delete(chatMessages);
        await tx.delete(usage);
        await tx.delete(userPreferences);
        await tx.delete(payments);
        await tx.delete(subscriptions);
        await tx.delete(tickets);
        await tx.delete(sessions);
        await tx.delete(users);
        await tx.delete(instanceSettings);
        await tx.insert(instanceSettings).values({});
      });
      sendJson(res, 200, { purged: true });
    } catch (err) {
      sendJson(res, 500, { error: "purge failed" });
    }
  });
}
