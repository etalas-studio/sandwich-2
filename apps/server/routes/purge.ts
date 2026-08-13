import type { Router } from "../router.js";
import {
  conversations,
  attachments,
  chatMessages,
  payments,
  sessions,
  users,
  subscriptions,
  usage,
  userPreferences,
} from "../db/schema.js";
import { sendJson } from "../http-utils.js";
import type { Database } from "../db/connection.js";

export function registerPurgeRoute(router: Router, db: Database): void {
  router.post("/api/purge", async (_req, res) => {
    try {
      await db.transaction(async (tx) => {
        await tx.delete(attachments);
        await tx.delete(chatMessages);
        await tx.delete(conversations);
        await tx.delete(usage);
        await tx.delete(userPreferences);
        await tx.delete(payments);
        await tx.delete(subscriptions);
        await tx.delete(sessions);
        await tx.delete(users);
      });
      sendJson(res, 200, { purged: true });
    } catch (err) {
      sendJson(res, 500, { error: "purge failed" });
    }
  });
}
