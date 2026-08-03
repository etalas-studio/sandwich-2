import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import {
  startReadinessScan,
  completeReadinessScan,
  abortReadinessScan,
  getLatestReadinessScan,
} from "./readiness-scans.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "readiness-scans-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testStartReadinessScanCreatesRunningScan(): void {
  const db = openTestDb();
  const scan = startReadinessScan(db, "scan-1");

  assert.equal(scan.id, "scan-1");
  assert.equal(scan.status, "running");
  assert.ok(scan.startedAt);
  assert.equal(scan.completedAt, null);
  assert.equal(scan.techStack, null);
  assert.equal(scan.testCommand, null);
  assert.equal(scan.areaSignals, null);
  console.log("PASS: testStartReadinessScanCreatesRunningScan");
}

function testCompleteReadinessScanSavesResults(): void {
  const db = openTestDb();
  startReadinessScan(db, "scan-1");

  const areaSignals = [{ area: "src", files: 5, testToCodeRatio: 0.6, churnScore: 0.3, note: "ok" }];
  const scan = completeReadinessScan(db, "scan-1", {
    techStack: "TypeScript, Node.js",
    testCommand: "npm test",
    areaSignals,
  });

  assert.equal(scan.status, "completed");
  assert.equal(scan.techStack, "TypeScript, Node.js");
  assert.equal(scan.testCommand, "npm test");
  assert.deepEqual(scan.areaSignals, areaSignals);
  assert.ok(scan.completedAt);
  console.log("PASS: testCompleteReadinessScanSavesResults");
}

function testAbortReadinessScanMarksAborted(): void {
  const db = openTestDb();
  startReadinessScan(db, "scan-1");

  const scan = abortReadinessScan(db, "scan-1");

  assert.equal(scan.status, "aborted");
  assert.ok(scan.completedAt);
  console.log("PASS: testAbortReadinessScanMarksAborted");
}

function testGetLatestReadinessScanReturnsMostRecent(): void {
  const db = openTestDb();

  // No scans yet
  assert.equal(getLatestReadinessScan(db), null);

  // First scan, completed
  startReadinessScan(db, "scan-1");
  completeReadinessScan(db, "scan-1", {
    techStack: "TypeScript",
    testCommand: null,
    areaSignals: [],
  });

  const latest = getLatestReadinessScan(db);
  assert.ok(latest);
  assert.equal(latest!.id, "scan-1");
  assert.equal(latest!.techStack, "TypeScript");

  // Second scan, later in time, should be the latest
  startReadinessScan(db, "scan-2");
  completeReadinessScan(db, "scan-2", {
    techStack: "TypeScript, React",
    testCommand: "npm test",
    areaSignals: [],
  });

  const latest2 = getLatestReadinessScan(db);
  assert.equal(latest2!.id, "scan-2");
  assert.equal(latest2!.techStack, "TypeScript, React");
  console.log("PASS: testGetLatestReadinessScanReturnsMostRecent");
}

function testGetLatestReadinessScanSkipsRunningScan(): void {
  const db = openTestDb();

  startReadinessScan(db, "scan-1");
  completeReadinessScan(db, "scan-1", {
    techStack: "TypeScript",
    testCommand: null,
    areaSignals: [],
  });

  // A running scan should NOT be returned as latest
  startReadinessScan(db, "scan-2");
  const latest = getLatestReadinessScan(db);
  assert.equal(latest!.id, "scan-1");
  console.log("PASS: testGetLatestReadinessScanSkipsRunningScan");
}

function main(): void {
  testStartReadinessScanCreatesRunningScan();
  testCompleteReadinessScanSavesResults();
  testAbortReadinessScanMarksAborted();
  testGetLatestReadinessScanReturnsMostRecent();
  testGetLatestReadinessScanSkipsRunningScan();
}

main();
