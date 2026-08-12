import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import { sendJson } from "../http-utils.js";

// User data only — schema_migrations is infrastructure, not reset on purge.
// Children must be deleted before parents (foreign_keys = ON).
//   blocklist → readiness_scans, sessions → users
const TABLES = [
  "blocklist",
  "readiness_scans",
  "credentials",
  "sessions",
  "tickets",
  "users",
  "instance_settings",
  "project",
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
