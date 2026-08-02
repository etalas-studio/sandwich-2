import type Database from "better-sqlite3";

export interface InstanceSettings {
  repoPath: string | null;
  firstRunCompletedAt: string | null;
}

/**
 * Holds the repo path chosen via the first-run UI folder picker (product
 * spec Core Loop step 0) — set once via the UI, not hand-edited in a config
 * file. The singleton row (id = 1) is seeded by the 0001_init migration, so
 * this always finds exactly one row.
 */
export function getInstanceSettings(db: Database.Database): InstanceSettings {
  const row = db
    .prepare("SELECT repo_path, first_run_completed_at FROM instance_settings WHERE id = 1")
    .get() as RawRow;
  return { repoPath: row.repo_path, firstRunCompletedAt: row.first_run_completed_at };
}

export function completeFirstRun(
  db: Database.Database,
  repoPath: string,
  completedAt: string,
): InstanceSettings {
  db.prepare(
    "UPDATE instance_settings SET repo_path = ?, first_run_completed_at = ? WHERE id = 1",
  ).run(repoPath, completedAt);
  return getInstanceSettings(db);
}

interface RawRow {
  repo_path: string | null;
  first_run_completed_at: string | null;
}
