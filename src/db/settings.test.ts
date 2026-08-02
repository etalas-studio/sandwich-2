import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { getInstanceSettings, completeFirstRun } from "./settings.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "settings-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testFreshInstanceHasNoRepoPathYet(): void {
  const db = openTestDb();
  const settings = getInstanceSettings(db);

  assert.equal(settings.repoPath, null);
  assert.equal(settings.firstRunCompletedAt, null);
  console.log("PASS: testFreshInstanceHasNoRepoPathYet");
}

function testCompleteFirstRunSetsRepoPathAndTimestamp(): void {
  const db = openTestDb();
  const completedAt = new Date().toISOString();
  const settings = completeFirstRun(db, "/Users/example/projects/widgets", completedAt);

  assert.equal(settings.repoPath, "/Users/example/projects/widgets");
  assert.equal(settings.firstRunCompletedAt, completedAt);
  assert.deepEqual(getInstanceSettings(db), settings);
  console.log("PASS: testCompleteFirstRunSetsRepoPathAndTimestamp");
}

function main(): void {
  testFreshInstanceHasNoRepoPathYet();
  testCompleteFirstRunSetsRepoPathAndTimestamp();
}

main();
