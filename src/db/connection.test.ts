import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";

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
  assert.equal(count, 1);
  console.log("PASS: testMigratingTwiceIsANoOp");
}

function testInstanceSettingsSeeded(): void {
  const dir = mkdtempSync(join(tmpdir(), "storage-migrate-test-"));
  const db = openDb(join(dir, "db.sqlite"));
  const row = db.prepare("SELECT * FROM instance_settings WHERE id = 1").get();
  assert.ok(row);
  console.log("PASS: testInstanceSettingsSeeded");
}

function main(): void {
  testMigratesFreshDatabase();
  testMigratingTwiceIsANoOp();
  testInstanceSettingsSeeded();
}

main();
