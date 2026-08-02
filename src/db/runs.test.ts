import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { upsertTicket } from "./tickets.js";
import { insertRun, updateRun, getRunById, listRunsForTicket } from "./runs.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "runs-test-"));
  const db = openDb(join(dir, "db.sqlite"));
  upsertTicket(db, { key: "PROJ-1", summary: "Fix typo", description: "Fix the typo" });
  return db;
}

function testInsertsAndReadsBackARun(): void {
  const db = openTestDb();
  const run = insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "claude-code-headless",
    outcome: "judging",
    startedAt: new Date().toISOString(),
  });

  const fetched = getRunById(db, run.id);
  assert.ok(fetched);
  assert.equal(fetched!.ticketKey, "PROJ-1");
  assert.equal(fetched!.outcome, "judging");
  assert.equal(fetched!.finishedAt, null);
  console.log("PASS: testInsertsAndReadsBackARun");
}

function testInsertRunFailsForUnknownTicket(): void {
  const db = openTestDb();
  assert.throws(() => {
    insertRun(db, {
      ticketKey: "NOPE",
      engine: "claude-code-headless",
      outcome: "judging",
      startedAt: new Date().toISOString(),
    });
  });
  console.log("PASS: testInsertRunFailsForUnknownTicket");
}

function testUpdateRunMergesFieldsWithoutClearingOthers(): void {
  const db = openTestDb();
  const run = insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "claude-code-headless",
    outcome: "judging",
    startedAt: new Date().toISOString(),
  });

  const updated = updateRun(db, run.id, { outcome: "implementing", branch: "agent/proj-1" });
  assert.equal(updated.outcome, "implementing");
  assert.equal(updated.branch, "agent/proj-1");

  const finalized = updateRun(db, run.id, {
    outcome: "ready_for_review",
    prUrl: "https://example.com/pr/1",
    finishedAt: new Date().toISOString(),
  });
  assert.equal(finalized.outcome, "ready_for_review");
  assert.equal(finalized.branch, "agent/proj-1", "earlier field must survive a later partial update");
  assert.equal(finalized.prUrl, "https://example.com/pr/1");
  assert.ok(finalized.finishedAt);
  console.log("PASS: testUpdateRunMergesFieldsWithoutClearingOthers");
}

function testListRunsForTicketReturnsAllAttemptsInOrder(): void {
  const db = openTestDb();
  const first = insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "claude-code-headless",
    outcome: "needs_human",
    startedAt: "2026-08-01T00:00:00.000Z",
  });
  const second = insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "claude-code-headless",
    outcome: "judging",
    startedAt: "2026-08-02T00:00:00.000Z",
  });

  const runs = listRunsForTicket(db, "PROJ-1");
  assert.equal(runs.length, 2);
  assert.equal(runs[0]!.id, first.id);
  assert.equal(runs[1]!.id, second.id);
  console.log("PASS: testListRunsForTicketReturnsAllAttemptsInOrder");
}

function main(): void {
  testInsertsAndReadsBackARun();
  testInsertRunFailsForUnknownTicket();
  testUpdateRunMergesFieldsWithoutClearingOthers();
  testListRunsForTicketReturnsAllAttemptsInOrder();
}

main();
