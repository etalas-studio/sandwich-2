import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import {
  insertBlocklistEntry,
  getBlocklistEntries,
  deleteBlocklistEntry,
} from "./blocklist.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "blocklist-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testInsertAndReadBlocklistEntry(): void {
  const db = openTestDb();
  const entry = insertBlocklistEntry(db, {
    pattern: "src/secrets/**",
    reason: "Contains API keys",
    source: "human",
    proposedByScanId: null,
  });

  assert.ok(entry.id);
  assert.equal(entry.pattern, "src/secrets/**");
  assert.equal(entry.reason, "Contains API keys");
  assert.equal(entry.source, "human");
  assert.equal(entry.proposedByScanId, null);
  assert.ok(entry.createdAt);
  console.log("PASS: testInsertAndReadBlocklistEntry");
}

function testGetBlocklistEntriesReturnsAll(): void {
  const db = openTestDb();
  insertBlocklistEntry(db, {
    pattern: "src/secrets/**",
    reason: "Contains API keys",
    source: "human",
    proposedByScanId: null,
  });
  insertBlocklistEntry(db, {
    pattern: "*.pem",
    reason: "Private keys",
    source: "human",
    proposedByScanId: null,
  });

  const entries = getBlocklistEntries(db);
  assert.equal(entries.length, 2);

  const patterns = entries.map((e) => e.pattern).sort();
  assert.deepEqual(patterns, ["*.pem", "src/secrets/**"]);
  console.log("PASS: testGetBlocklistEntriesReturnsAll");
}

function testDeleteBlocklistEntryRemovesIt(): void {
  const db = openTestDb();
  const entry = insertBlocklistEntry(db, {
    pattern: "src/secrets/**",
    reason: "Contains API keys",
    source: "human",
    proposedByScanId: null,
  });

  deleteBlocklistEntry(db, entry.id);
  const entries = getBlocklistEntries(db);
  assert.equal(entries.length, 0);
  console.log("PASS: testDeleteBlocklistEntryRemovesIt");
}

function main(): void {
  testInsertAndReadBlocklistEntry();
  testGetBlocklistEntriesReturnsAll();
  testDeleteBlocklistEntryRemovesIt();
}

main();
