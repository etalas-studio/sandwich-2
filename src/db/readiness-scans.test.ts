import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { startReadinessScan, completeReadinessScan, getReadinessScanById, getLatestReadinessScan } from "./readiness-scans.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "readiness-scans-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testStartsAScanInRunningState(): void {
  const db = openTestDb();
  const scan = startReadinessScan(db, new Date().toISOString());

  assert.equal(scan.status, "running");
  assert.equal(scan.finishedAt, null);
  assert.equal(scan.areaSignals, null);
  console.log("PASS: testStartsAScanInRunningState");
}

function testCompletingAScanRoundTripsAreaSignals(): void {
  const db = openTestDb();
  const scan = startReadinessScan(db, new Date().toISOString());

  const completed = completeReadinessScan(db, scan.id, {
    finishedAt: new Date().toISOString(),
    techStack: "Node/TypeScript",
    testCommand: "npm test",
    areaSignals: [{ pathPrefix: "src/db", testToCodeRatio: 0.8, churnScore: 0.2 }],
    recommendations: [{ id: "missing-agent-context", severity: "high", message: "No CLAUDE.md or AGENTS.md found." }],
    codebaseSummary: "A TypeScript CLI that seeds demo tickets.",
    agenticFlowSummary: "No CLAUDE.md/AGENTS.md found and no CI — little established workflow for an agent to follow.",
    status: "completed",
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.techStack, "Node/TypeScript");
  assert.deepEqual(completed.areaSignals, [
    { pathPrefix: "src/db", testToCodeRatio: 0.8, churnScore: 0.2 },
  ]);
  assert.deepEqual(completed.recommendations, [
    { id: "missing-agent-context", severity: "high", message: "No CLAUDE.md or AGENTS.md found." },
  ]);
  assert.equal(completed.codebaseSummary, "A TypeScript CLI that seeds demo tickets.");
  assert.equal(
    completed.agenticFlowSummary,
    "No CLAUDE.md/AGENTS.md found and no CI — little established workflow for an agent to follow.",
  );

  const fetched = getReadinessScanById(db, scan.id);
  assert.deepEqual(fetched, completed);
  console.log("PASS: testCompletingAScanRoundTripsAreaSignals");
}

function testGetLatestReadinessScanReturnsMostRecentlyStarted(): void {
  const db = openTestDb();
  startReadinessScan(db, "2026-08-01T00:00:00.000Z");
  const second = startReadinessScan(db, "2026-08-02T00:00:00.000Z");

  const latest = getLatestReadinessScan(db);
  assert.equal(latest!.id, second.id);
  console.log("PASS: testGetLatestReadinessScanReturnsMostRecentlyStarted");
}

function testCompleteReadinessScanThrowsForUnknownId(): void {
  const db = openTestDb();

  assert.throws(
    () =>
      completeReadinessScan(db, "does-not-exist", {
        finishedAt: new Date().toISOString(),
        techStack: "Node/TypeScript",
        testCommand: "npm test",
        areaSignals: null,
        recommendations: null,
        codebaseSummary: null,
        agenticFlowSummary: null,
        status: "completed",
      }),
    /No readiness scan found with id does-not-exist/,
  );
  console.log("PASS: testCompleteReadinessScanThrowsForUnknownId");
}

function testCompletingAFailedScanAllowsNullFields(): void {
  const db = openTestDb();
  const scan = startReadinessScan(db, new Date().toISOString());

  const completed = completeReadinessScan(db, scan.id, {
    finishedAt: new Date().toISOString(),
    techStack: null,
    testCommand: null,
    areaSignals: null,
    recommendations: null,
    codebaseSummary: null,
    agenticFlowSummary: null,
    status: "failed",
  });

  assert.equal(completed.status, "failed");
  assert.equal(completed.techStack, null);
  assert.equal(completed.testCommand, null);
  assert.equal(completed.areaSignals, null);
  assert.equal(completed.recommendations, null);
  assert.equal(completed.codebaseSummary, null);
  assert.equal(completed.agenticFlowSummary, null);
  console.log("PASS: testCompletingAFailedScanAllowsNullFields");
}

function main(): void {
  testStartsAScanInRunningState();
  testCompletingAScanRoundTripsAreaSignals();
  testGetLatestReadinessScanReturnsMostRecentlyStarted();
  testCompleteReadinessScanThrowsForUnknownId();
  testCompletingAFailedScanAllowsNullFields();
}

main();
