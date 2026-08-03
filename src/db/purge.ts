import type Database from "better-sqlite3";

/**
 * TEMPORARY dev-only tool for wiping a local instance back to a blank slate
 * (to retry the first-run signup flow) — not part of the product design.
 * Delete this file and its route/sidebar button once no longer needed.
 *
 * instance_settings' singleton row is reset to nulls rather than deleted —
 * settings.ts's getInstanceSettings assumes id=1 always exists.
 */
export function purgeAllData(db: Database.Database): void {
  const purge = db.transaction(() => {
    db.prepare("DELETE FROM run_artifacts").run();
    db.prepare("DELETE FROM reviews").run();
    db.prepare("DELETE FROM runs").run();
    db.prepare("DELETE FROM tickets").run();
    db.prepare("DELETE FROM blocklist_entries").run();
    db.prepare("DELETE FROM readiness_scans").run();
    db.prepare("DELETE FROM sessions").run();
    db.prepare("DELETE FROM users").run();
    db.prepare("DELETE FROM credentials").run();
    db.prepare(
      "UPDATE instance_settings SET repo_path = NULL, first_run_completed_at = NULL WHERE id = 1",
    ).run();
  });
  purge();
}
