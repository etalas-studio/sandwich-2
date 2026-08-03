import { strict as assert } from "node:assert";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { MIGRATIONS } from "./migrations/index.js";

function testMigratesFreshDatabase(): void {
  const dir = mkdtempSync(join(tmpdir(), "storage-migrate-test-"));
  const db = openDb(join(dir, "db.sqlite"));

  const tables = (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[]
  ).map((row) => row.name);

  for (const expected of [
    "tickets",
    "runs",
    "reviews",
    "readiness_scans",
    "blocklist_entries",
    "credentials",
    "users",
    "sessions",
    "instance_settings",
    "run_artifacts",
    "schema_migrations",
  ]) {
    assert.ok(tables.includes(expected), `expected table ${expected} to exist`);
  }
  console.log("PASS: testMigratesFreshDatabase");
}

function testMigratingTwiceIsANoOp(): void {
  const dir = mkdtempSync(join(tmpdir(), "storage-migrate-test-"));
  const dbPath = join(dir, "db.sqlite");
  openDb(dbPath).close();
  const db2 = openDb(dbPath);

  const count = (
    db2.prepare("SELECT COUNT(*) as c FROM schema_migrations").get() as { c: number }
  ).c;
  // Compared against MIGRATIONS.length rather than a hardcoded count: the
  // point of this test is "reopening doesn't re-apply anything", which must
  // stay true as migrations are added (it broke when 0002 landed).
  assert.equal(count, MIGRATIONS.length);
  console.log("PASS: testMigratingTwiceIsANoOp");
}

function testInstanceSettingsSeeded(): void {
  const dir = mkdtempSync(join(tmpdir(), "storage-migrate-test-"));
  const db = openDb(join(dir, "db.sqlite"));
  const row = db.prepare("SELECT * FROM instance_settings WHERE id = 1").get();
  assert.ok(row);
  console.log("PASS: testInstanceSettingsSeeded");
}

/**
 * The database file itself is chmodSync'd to 0o600 (not subject to umask,
 * unlike the mkdirSync `mode` option used for the parent directory), so
 * that's what this test asserts on — the file permissions are the actual
 * security boundary described in
 * docs/superpowers/specs/2026-08-03-storage-sqlite-design.md.
 */
function testDatabaseFileHasRestrictivePermissions(): void {
  const dir = mkdtempSync(join(tmpdir(), "storage-migrate-test-"));
  const dbPath = join(dir, "db.sqlite");
  openDb(dbPath);

  const mode = statSync(dbPath).mode & 0o777;
  assert.equal(mode, 0o600, `expected db file mode 0o600, got 0o${mode.toString(8)}`);
  console.log("PASS: testDatabaseFileHasRestrictivePermissions");
}

function main(): void {
  testMigratesFreshDatabase();
  testMigratingTwiceIsANoOp();
  testInstanceSettingsSeeded();
  testDatabaseFileHasRestrictivePermissions();
}

main();
