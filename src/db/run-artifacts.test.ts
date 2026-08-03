import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { openDb } from "./connection.js";
import { upsertTicket } from "./tickets.js";
import { insertRun } from "./runs.js";
import { insertRunArtifact, listArtifactsForRun } from "./run-artifacts.js";

function openTestDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), "run-artifacts-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function makeRun(db: Database.Database) {
  upsertTicket(db, { key: "PROJ-1", summary: "s", description: "d" });
  return insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "fake",
    outcome: "running",
    startedAt: new Date().toISOString(),
  });
}

function testInsertsAndListsArtifactsForARun(): void {
  const db = openTestDb();
  const run = makeRun(db);

  insertRunArtifact(db, {
    runId: run.id,
    kind: "implement_transcript",
    content: "line one\nline two",
  });
  insertRunArtifact(db, { runId: run.id, kind: "diff_patch", content: "diff --git a/x b/x" });

  const artifacts = listArtifactsForRun(db, run.id);
  assert.equal(artifacts.length, 2);
  assert.equal(artifacts[0]!.kind, "implement_transcript");
  assert.equal(artifacts[1]!.kind, "diff_patch");
  console.log("PASS: testInsertsAndListsArtifactsForARun");
}

function testListReturnsEmptyForRunWithNoArtifacts(): void {
  const db = openTestDb();
  const run = makeRun(db);
  assert.deepEqual(listArtifactsForRun(db, run.id), []);
  console.log("PASS: testListReturnsEmptyForRunWithNoArtifacts");
}

function testInsertFailsForUnknownRun(): void {
  const db = openTestDb();
  assert.throws(() => {
    insertRunArtifact(db, { runId: "does-not-exist", kind: "verify_output", content: "x" });
  });
  console.log("PASS: testInsertFailsForUnknownRun");
}

function main(): void {
  testInsertsAndListsArtifactsForARun();
  testListReturnsEmptyForRunWithNoArtifacts();
  testInsertFailsForUnknownRun();
}

main();
