import type Database from "better-sqlite3";
import { MIGRATIONS } from "./migrations/index.js";

/**
 * Applies any migration in MIGRATIONS not yet recorded in schema_migrations,
 * in ascending version order, each inside its own transaction. A no-op if
 * every migration is already applied.
 */
export function migrate(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );`,
  );

  const appliedVersions = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map(
      (row) => row.version,
    ),
  );

  const pending = MIGRATIONS.filter((m) => !appliedVersions.has(m.version)).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    const applyMigration = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        migration.version,
        new Date().toISOString(),
      );
    });
    applyMigration();
  }
}
