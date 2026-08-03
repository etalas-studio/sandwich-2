import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { upsertTicket } from "../db/tickets.js";
import { insertRun } from "../db/runs.js";
import { startReadinessScan, completeReadinessScan } from "../db/readiness-scans.js";
import { verify } from "./verify.js";
import type { PipelineContext } from "./types.js";
import type { EngineInvoker } from "../engine/types.js";

function openTestDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), "verify-test-db-"));
  return openDb(join(dir, "db.sqlite"));
}

const unusedEngine: EngineInvoker = {
  run: () => {
    throw new Error("verify must never call the agent engine");
  },
};

function makeContext(db: Database.Database): PipelineContext {
  const ticket = upsertTicket(db, { key: "PROJ-1", summary: "Add widget", description: "Add a widget." });
  const run = insertRun(db, {
    ticketKey: ticket.key,
    engine: "fake",
    outcome: "changes_committed",
    startedAt: new Date().toISOString(),
  });
  return {
    db,
    runId: run.id,
    ticket,
    engine: unusedEngine,
    engineName: "fake",
    worktreePath: process.cwd(),
    baseCommit: "0000000000000000000000000000000000000000",
    implementTimeoutMs: 5000,
    verifyTimeoutMs: 5000,
    signal: new AbortController().signal,
  };
}

function seedTestCommand(db: Database.Database, testCommand: string): void {
  const scan = startReadinessScan(db, new Date().toISOString());
  completeReadinessScan(db, scan.id, {
    finishedAt: new Date().toISOString(),
    techStack: "node",
    testCommand,
    areaSignals: null,
    recommendations: null,
    codebaseSummary: null,
    agenticFlowSummary: null,
    status: "completed",
  });
}

async function testReturnsNeedsHumanWhenNoReadinessScan(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(db);

  const result = await verify(ctx);
  assert.equal(result.outcome, "needs_human");
  assert.equal(result.needsHumanCategory, "weak_verification");
  console.log("PASS: testReturnsNeedsHumanWhenNoReadinessScan");
}

async function testReturnsReadyForPrWhenTestCommandExitsZero(): Promise<void> {
  const db = openTestDb();
  seedTestCommand(db, "true");
  const ctx = makeContext(db);

  const result = await verify(ctx);
  assert.equal(result.outcome, "ready_for_pr");
  console.log("PASS: testReturnsReadyForPrWhenTestCommandExitsZero");
}

async function testReturnsVerifyFailedWhenTestCommandExitsNonzero(): Promise<void> {
  const db = openTestDb();
  seedTestCommand(db, "false");
  const ctx = makeContext(db);

  const result = await verify(ctx);
  assert.equal(result.outcome, "verify_failed");
  console.log("PASS: testReturnsVerifyFailedWhenTestCommandExitsNonzero");
}

async function testReturnsVerifyTimeoutWhenCommandHangs(): Promise<void> {
  const db = openTestDb();
  seedTestCommand(db, "sleep 5");
  const ctx: PipelineContext = { ...makeContext(db), verifyTimeoutMs: 100 };

  const result = await verify(ctx);
  assert.equal(result.outcome, "verify_timeout");
  console.log("PASS: testReturnsVerifyTimeoutWhenCommandHangs");
}

async function testTokenizesQuotedSegmentAsOneArgument(): Promise<void> {
  const db = openTestDb();
  // Under the old naive `split(/\s+/)`, this would tokenize into
  // ["sh", "-c", "\"exit", "0\""] — four args instead of three, and `sh -c`
  // would receive the literal string `"exit` as its script, which is not
  // valid shell and exits nonzero. A quote-aware tokenizer must instead
  // produce ["sh", "-c", "exit 0"] so the quoted phrase survives as one
  // argument and the script actually runs `exit 0`, exiting zero.
  seedTestCommand(db, 'sh -c "exit 0"');
  const ctx = makeContext(db);

  const result = await verify(ctx);
  assert.equal(result.outcome, "ready_for_pr");
  console.log("PASS: testTokenizesQuotedSegmentAsOneArgument");
}

async function main(): Promise<void> {
  await testReturnsNeedsHumanWhenNoReadinessScan();
  await testReturnsReadyForPrWhenTestCommandExitsZero();
  await testReturnsVerifyFailedWhenTestCommandExitsNonzero();
  await testReturnsVerifyTimeoutWhenCommandHangs();
  await testTokenizesQuotedSegmentAsOneArgument();
}

void main();
