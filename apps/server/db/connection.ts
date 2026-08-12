import Database from "better-sqlite3";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "./migrate.js";

/**
 * Opens (creating if absent) the SQLite file at `path`, ensures its parent
 * directory exists, enables foreign-key enforcement (off by default in
 * SQLite), and applies any pending migrations before returning.
 *
 * The directory and file are created owner-only (0700/0600) — file
 * permissions on `dataDir` are the actual security boundary for the
 * plaintext-at-rest credentials and password hashes stored in this database
 * (see docs/superpowers/specs/2026-08-03-storage-sqlite-design.md).
 */
export function openDb(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path);
  chmodSync(path, 0o600);
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}
