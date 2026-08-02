import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { startReadinessScan } from "./readiness-scans.js";
import { insertBlocklistEntry, listBlocklistEntries, deleteBlocklistEntry } from "./blocklist.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "blocklist-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testInsertsAHumanAddedEntryWithNoScan(): void {
  const db = openTestDb();
  const entry = insertBlocklistEntry(db, {
    pattern: "never run migrations",
    reason: "human judgment call, not agent-proposed",
    source: "human",
  });

  assert.equal(entry.source, "human");
  assert.equal(entry.proposedByScanId, null);
  console.log("PASS: testInsertsAHumanAddedEntryWithNoScan");
}

function testInsertsAnAgentProposedEntryLinkedToAScan(): void {
  const db = openTestDb();
  const scan = startReadinessScan(db, new Date().toISOString());

  const entry = insertBlocklistEntry(db, {
    pattern: "app/models/payment.rb",
    reason: "touches billing logic",
    source: "agent",
    proposedByScanId: scan.id,
  });

  assert.equal(entry.source, "agent");
  assert.equal(entry.proposedByScanId, scan.id);
  console.log("PASS: testInsertsAnAgentProposedEntryLinkedToAScan");
}

function testListAndDeleteBlocklistEntries(): void {
  const db = openTestDb();
  const first = insertBlocklistEntry(db, { pattern: "a", reason: "a", source: "human" });
  insertBlocklistEntry(db, { pattern: "b", reason: "b", source: "human" });

  assert.equal(listBlocklistEntries(db).length, 2);

  deleteBlocklistEntry(db, first.id);
  const remaining = listBlocklistEntries(db);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]!.pattern, "b");
  console.log("PASS: testListAndDeleteBlocklistEntries");
}

function main(): void {
  testInsertsAHumanAddedEntryWithNoScan();
  testInsertsAnAgentProposedEntryLinkedToAScan();
  testListAndDeleteBlocklistEntries();
}

main();
