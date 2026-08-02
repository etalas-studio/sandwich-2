import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "./migrate.js";

/**
 * Opens (creating if absent) the SQLite file at `path`, ensures its parent
 * directory exists, enables foreign-key enforcement (off by default in
 * SQLite), and applies any pending migrations before returning.
 */
export function openDb(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}
