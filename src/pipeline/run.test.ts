import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type Database from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { upsertTicket } from "../db/tickets.js";
import { startReadinessScan, completeReadinessScan } from "../db/readiness-scans.js";
import { runPipeline } from "./run.js";
import type { PipelineConfig } from "./config.js";
import type { EngineInvoker, EngineRunOptions, EngineRunResult } from "../engine/types.js";

function openTestDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), "run-test-db-"));
  return openDb(join(dir, "db.sqlite"));
}

function initTestRepo(): string {
  const path = mkdtempSync(join(tmpdir(), "run-test-repo-"));
  execSync("git init -q -b main", { cwd: path });
  execSync("git config user.email test@example.com", { cwd: path });
  execSync("git config user.name Test", { cwd: path });
  writeFileSync(join(path, "README.md"), "hello\n");
  execSync("git add -A", { cwd: path });
  execSync("git commit -q -m initial", { cwd: path });
  return path;
}

function makeConfig(repoPath: string): PipelineConfig {
  return {
    repoPath,
    worktreeRoot: join(repoPath, ".worktrees"),
    branchPrefix: "agent/",
    baseBranch: "main",
    engineMode: "pty",
    implementTimeoutMs: 5000,
    verifyTimeoutMs: 5000,
    scanTimeoutMs: 5000,
  };
}

function makeEngine(behavior: (options: EngineRunOptions) => Promise<EngineRunResult>): EngineInvoker {
  return { run: behavior };
}

const engineWritesAFile = makeEngine(async (options) => {
  writeFileSync(join(options.cwd, "feature.txt"), "new feature\n");
  return { outcome: "ok", finalText: "done", transcript: ["done"], durationSec: 0.1, exitCode: 0 };
});

const engineDoesNothing = makeEngine(async () => ({
  outcome: "ok",
  finalText: "done",
  transcript: ["done"],
  durationSec: 0.1,
  exitCode: 0,
}));

async function testFullRunReachesReadyForPr(): Promise<void> {
  const db = openTestDb();
  const repoPath = initTestRepo();
  upsertTicket(db, { key: "PROJ-1", summary: "Add widget", description: "Add a widget." });

  const scan = startReadinessScan(db, new Date().toISOString());
  completeReadinessScan(db, scan.id, {
    finishedAt: new Date().toISOString(),
    techStack: "node",
    testCommand: "true",
    areaSignals: null,
    recommendations: null,
    codebaseSummary: null,
    agenticFlowSummary: null,
    status: "completed",
  });

  const run = await runPipeline("PROJ-1", makeConfig(repoPath), db, engineWritesAFile);

  assert.equal(run.outcome, "ready_for_pr");
  assert.ok(run.branch);
  assert.ok(run.worktreePath);
  assert.ok(run.finishedAt);
  console.log("PASS: testFullRunReachesReadyForPr");
}

async function testStopsAtNoChangesWithoutRunningVerify(): Promise<void> {
  const db = openTestDb();
  const repoPath = initTestRepo();
  upsertTicket(db, { key: "PROJ-2", summary: "Do nothing", description: "..." });
  // Deliberately no readiness scan seeded. If verify() ran anyway it would
  // return needs_human/weak_verification, not no_changes — so this also
  // proves verify() was never reached once implement reported no changes.

  const run = await runPipeline("PROJ-2", makeConfig(repoPath), db, engineDoesNothing);

  assert.equal(run.outcome, "no_changes");
  console.log("PASS: testStopsAtNoChangesWithoutRunningVerify");
}

async function testReachesVerifyFailedWhenTestsRed(): Promise<void> {
  const db = openTestDb();
  const repoPath = initTestRepo();
  upsertTicket(db, { key: "PROJ-3", summary: "Add widget", description: "..." });

  const scan = startReadinessScan(db, new Date().toISOString());
  completeReadinessScan(db, scan.id, {
    finishedAt: new Date().toISOString(),
    techStack: "node",
    testCommand: "false",
    areaSignals: null,
    recommendations: null,
    codebaseSummary: null,
    agenticFlowSummary: null,
    status: "completed",
  });

  const run = await runPipeline("PROJ-3", makeConfig(repoPath), db, engineWritesAFile);

  assert.equal(run.outcome, "verify_failed");
  console.log("PASS: testReachesVerifyFailedWhenTestsRed");
}

// Anything that throws *after* the runs row exists must be recorded on that
// row as outcome "error" rather than escaping to the caller — a dirty repo
// (assertCleanRepo) is the cheapest way to trigger that path for real.
async function testRecordsErrorOutcomeWhenAStageThrows(): Promise<void> {
  const db = openTestDb();
  const repoPath = initTestRepo();
  upsertTicket(db, { key: "PROJ-4", summary: "Add widget", description: "..." });
  writeFileSync(join(repoPath, "uncommitted.txt"), "dirty\n");

  const run = await runPipeline("PROJ-4", makeConfig(repoPath), db, engineDoesNothing);

  assert.equal(run.outcome, "error");
  assert.ok(
    run.needsHumanReason && run.needsHumanReason.length > 0,
    "expected a non-empty needsHumanReason explaining the failure",
  );
  assert.ok(run.finishedAt);
  console.log("PASS: testRecordsErrorOutcomeWhenAStageThrows");
}

async function testThrowsForUnknownTicket(): Promise<void> {
  const db = openTestDb();
  const repoPath = initTestRepo();

  await assert.rejects(() => runPipeline("NOPE-1", makeConfig(repoPath), db, engineDoesNothing));
  console.log("PASS: testThrowsForUnknownTicket");
}

async function main(): Promise<void> {
  await testFullRunReachesReadyForPr();
  await testStopsAtNoChangesWithoutRunningVerify();
  await testReachesVerifyFailedWhenTestsRed();
  await testRecordsErrorOutcomeWhenAStageThrows();
  await testThrowsForUnknownTicket();
}

void main();
