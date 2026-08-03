import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type Database from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { upsertTicket } from "../db/tickets.js";
import { insertRun } from "../db/runs.js";
import { insertBlocklistEntry } from "../db/blocklist.js";
import { implement } from "./implement.js";
import type { PipelineContext } from "./types.js";
import type { EngineInvoker, EngineRunOptions, EngineRunResult } from "../engine/types.js";

function openTestDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), "implement-test-db-"));
  return openDb(join(dir, "db.sqlite"));
}

function initTestRepo(): { path: string; baseCommit: string } {
  const path = mkdtempSync(join(tmpdir(), "implement-test-repo-"));
  execSync("git init -q", { cwd: path });
  execSync("git config user.email test@example.com", { cwd: path });
  execSync("git config user.name Test", { cwd: path });
  writeFileSync(join(path, "README.md"), "hello\n");
  execSync("git add -A", { cwd: path });
  execSync("git commit -q -m initial", { cwd: path });
  const baseCommit = execSync("git rev-parse HEAD", { cwd: path }).toString().trim();
  return { path, baseCommit };
}

function makeContext(db: Database.Database, engine: EngineInvoker): PipelineContext {
  const ticket = upsertTicket(db, { key: "PROJ-1", summary: "Add widget", description: "Add a widget." });
  const run = insertRun(db, {
    ticketKey: ticket.key,
    engine: "fake",
    outcome: "running",
    startedAt: new Date().toISOString(),
  });
  const repo = initTestRepo();
  return {
    db,
    runId: run.id,
    ticket,
    engine,
    engineName: "fake",
    worktreePath: repo.path,
    baseCommit: repo.baseCommit,
    implementTimeoutMs: 5000,
    verifyTimeoutMs: 5000,
  };
}

function makeEngine(behavior: (options: EngineRunOptions) => Promise<EngineRunResult>): EngineInvoker {
  return { run: behavior };
}

async function testCommitsChangesWhenAgentWritesCode(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(
    db,
    makeEngine(async (options) => {
      writeFileSync(join(options.cwd, "feature.txt"), "new feature\n");
      return { outcome: "ok", finalText: "done", transcript: ["done"], durationSec: 0.1, exitCode: 0 };
    }),
  );

  const result = await implement(ctx);
  assert.equal(result.outcome, "changes_committed");

  const log = execSync("git log --oneline", { cwd: ctx.worktreePath }).toString();
  assert.equal(log.trim().split("\n").length, 2, "expected the initial commit plus one new commit");
  console.log("PASS: testCommitsChangesWhenAgentWritesCode");
}

async function testReturnsNoChangesWhenAgentDoesNothing(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(
    db,
    makeEngine(async () => ({
      outcome: "ok",
      finalText: "done",
      transcript: ["done"],
      durationSec: 0.1,
      exitCode: 0,
    })),
  );

  const result = await implement(ctx);
  assert.equal(result.outcome, "no_changes");
  console.log("PASS: testReturnsNoChangesWhenAgentDoesNothing");
}

async function testReturnsNeedsHumanOnBlocklistHit(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(
    db,
    makeEngine(async (options) => {
      writeFileSync(join(options.cwd, "secrets.env"), "API_KEY=x\n");
      return { outcome: "ok", finalText: "done", transcript: ["done"], durationSec: 0.1, exitCode: 0 };
    }),
  );
  insertBlocklistEntry(db, { pattern: "secrets.env", reason: "never touch secrets", source: "human" });

  const result = await implement(ctx);
  assert.equal(result.outcome, "needs_human");
  assert.equal(result.needsHumanCategory, "forbidden_path_or_action");

  const log = execSync("git log --oneline", { cwd: ctx.worktreePath }).toString();
  assert.equal(log.trim().split("\n").length, 1, "blocklist hit must not be committed");
  console.log("PASS: testReturnsNeedsHumanOnBlocklistHit");
}

// A pattern like "*.env" is written to mean "secrets anywhere in the repo".
// It must therefore also catch nested files, not just files at the repo root.
async function testWildcardPatternMatchesNestedFileByBasename(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(
    db,
    makeEngine(async (options) => {
      mkdirSync(join(options.cwd, "config"), { recursive: true });
      writeFileSync(join(options.cwd, "config", "secrets.env"), "API_KEY=x\n");
      return { outcome: "ok", finalText: "done", transcript: ["done"], durationSec: 0.1, exitCode: 0 };
    }),
  );
  insertBlocklistEntry(db, { pattern: "*.env", reason: "never touch secrets", source: "human" });

  const result = await implement(ctx);
  assert.equal(result.outcome, "needs_human");
  assert.equal(result.needsHumanCategory, "forbidden_path_or_action");

  const log = execSync("git log --oneline", { cwd: ctx.worktreePath }).toString();
  assert.equal(log.trim().split("\n").length, 1, "blocklist hit must not be committed");
  console.log("PASS: testWildcardPatternMatchesNestedFileByBasename");
}

// The wildcard regex is anchored at both ends, so trailing content past the
// intended match is not silently swallowed: "config/*.key" is about .key
// files, not about "config/prod.key.bak".
async function testWildcardPatternDoesNotMatchTrailingContent(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(
    db,
    makeEngine(async (options) => {
      mkdirSync(join(options.cwd, "config"), { recursive: true });
      writeFileSync(join(options.cwd, "config", "prod.key.bak"), "stale backup\n");
      return { outcome: "ok", finalText: "done", transcript: ["done"], durationSec: 0.1, exitCode: 0 };
    }),
  );
  insertBlocklistEntry(db, { pattern: "config/*.key", reason: "no private keys", source: "human" });

  const result = await implement(ctx);
  assert.equal(result.outcome, "changes_committed");
  console.log("PASS: testWildcardPatternDoesNotMatchTrailingContent");
}

// A *trailing* wildcard reads as "everything under here", so it still has to
// cross directory separators — "src/*" covers src/deep/nested/thing.ts.
async function testTrailingWildcardMatchesEverythingBelowIt(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(
    db,
    makeEngine(async (options) => {
      mkdirSync(join(options.cwd, "src", "deep", "nested"), { recursive: true });
      writeFileSync(join(options.cwd, "src", "deep", "nested", "thing.ts"), "export {};\n");
      return { outcome: "ok", finalText: "done", transcript: ["done"], durationSec: 0.1, exitCode: 0 };
    }),
  );
  insertBlocklistEntry(db, { pattern: "src/*", reason: "hands off src", source: "human" });

  const result = await implement(ctx);
  assert.equal(result.outcome, "needs_human");
  assert.equal(result.needsHumanCategory, "forbidden_path_or_action");
  console.log("PASS: testTrailingWildcardMatchesEverythingBelowIt");
}

async function testReturnsTimeoutOutcome(): Promise<void> {
  const db = openTestDb();
  const ctx = makeContext(
    db,
    makeEngine(async () => ({
      outcome: "timeout",
      finalText: "",
      transcript: [],
      durationSec: 5,
      exitCode: null,
    })),
  );

  const result = await implement(ctx);
  assert.equal(result.outcome, "implement_timeout");
  assert.equal(result.needsHumanCategory, null);
  console.log("PASS: testReturnsTimeoutOutcome");
}

async function main(): Promise<void> {
  await testCommitsChangesWhenAgentWritesCode();
  await testReturnsNoChangesWhenAgentDoesNothing();
  await testReturnsNeedsHumanOnBlocklistHit();
  await testWildcardPatternMatchesNestedFileByBasename();
  await testWildcardPatternDoesNotMatchTrailingContent();
  await testTrailingWildcardMatchesEverythingBelowIt();
  await testReturnsTimeoutOutcome();
}

void main();
