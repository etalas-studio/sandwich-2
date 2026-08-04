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
  assert.equal(scan.description, null);
  assert.equal(scan.techStack, null);
  assert.equal(scan.testCommand, null);
  assert.equal(scan.areaSignals, null);
  console.log("PASS: testStartReadinessScanCreatesRunningScan");
}

function testCompleteReadinessScanSavesResults(): void {
  const db = openTestDb();
  startReadinessScan(db, "scan-1");

  const areaSignals = [
    { area: "src", files: 5, testFileCount: 3, testToCodeRatio: 0.6, churnScore: 0.3, note: "ok" },
  ];
  const scan = completeReadinessScan(db, "scan-1", {
    projectName: "my-app",
    description: "A test app",
    techStack: "TypeScript, Node.js",
    testCommand: "npm test",
    areaSignals,
    recommendations: [],
  });

  assert.equal(scan.status, "completed");
  assert.equal(scan.projectName, "my-app");
  assert.equal(scan.description, "A test app");
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

  assert.equal(getLatestReadinessScan(db), null);

  startReadinessScan(db, "scan-1");
  completeReadinessScan(db, "scan-1", {
    projectName: "app1",
    description: null,
    techStack: "TypeScript",
    testCommand: null,
    areaSignals: [],
    recommendations: [],
  });
  assert.equal(getLatestReadinessScan(db)!.id, "scan-1");

  startReadinessScan(db, "scan-2");
  completeReadinessScan(db, "scan-2", {
    projectName: "app2",
    description: null,
    techStack: "TypeScript, React",
    testCommand: "npm test",
    areaSignals: [],
    recommendations: [],
  });
  assert.equal(getLatestReadinessScan(db)!.id, "scan-2");
  console.log("PASS: testGetLatestReadinessScanReturnsMostRecent");
}

function testGetLatestReadinessScanIncludesRunningScan(): void {
  const db = openTestDb();
  startReadinessScan(db, "scan-1");
  completeReadinessScan(db, "scan-1", {
    projectName: "app",
    description: null,
    techStack: "TS",
    testCommand: null,
    areaSignals: [],
    recommendations: [],
  });
  // A newer running scan should be returned (not filtered out)
  startReadinessScan(db, "scan-2");
  assert.equal(getLatestReadinessScan(db)!.id, "scan-2");
  assert.equal(getLatestReadinessScan(db)!.status, "running");
  console.log("PASS: testGetLatestReadinessScanIncludesRunningScan");
}

function main(): void {
  testStartReadinessScanCreatesRunningScan();
  testCompleteReadinessScanSavesResults();
  testAbortReadinessScanMarksAborted();
  testGetLatestReadinessScanReturnsMostRecent();
  testGetLatestReadinessScanIncludesRunningScan();
}

main();
