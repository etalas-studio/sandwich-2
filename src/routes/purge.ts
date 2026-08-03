import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import { sendJson } from "../http-utils.js";

const TABLES = [
  "readiness_scans",
  "blocklist",
  "credentials",
  "sessions",
  "users",
  "instance_settings",
  "schema_migrations",
];

export function registerPurgeRoute(router: Router, db: Database.Database): void {
  router.post("/api/purge", (_req, res) => {
    try {
      db.transaction(() => {
        for (const table of TABLES) {
          db.prepare(`DELETE FROM ${table}`).run();
        }
        // Re-seed instance_settings
        db.prepare("INSERT OR IGNORE INTO instance_settings (id) VALUES (1)").run();
      })();
      sendJson(res, 200, { purged: true });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "purge failed" });
    }
  });
}
