import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { openDb } from "../db/connection.js";
import { upsertTicket } from "../db/tickets.js";
import { insertRun } from "../db/runs.js";
import { judge } from "./judge.js";
import type { PipelineContext } from "./types.js";
import type { EngineInvoker } from "../engine/types.js";

function openTestDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), "judge-test-"));
  return openDb(join(dir, "db.sqlite"));
}

const engineThatMustNeverBeCalled: EngineInvoker = {
  run: () => {
    throw new Error("judge is stubbed in this plan and must never call the engine");
  },
};

async function testAlwaysReturnsAgentReady(): Promise<void> {
  const db = openTestDb();
  const ticket = upsertTicket(db, { key: "PROJ-1", summary: "s", description: "d" });
  const run = insertRun(db, {
    ticketKey: ticket.key,
    engine: "fake",
    outcome: "running",
    startedAt: new Date().toISOString(),
  });

  const ctx: PipelineContext = {
    db,
    runId: run.id,
    ticket,
    engine: engineThatMustNeverBeCalled,
    engineName: "fake",
    worktreePath: "/tmp/does-not-matter",
    baseCommit: "0000000000000000000000000000000000000000",
    implementTimeoutMs: 1000,
    verifyTimeoutMs: 1000,
    signal: new AbortController().signal,
  };

  const result = await judge(ctx);
  assert.equal(result.outcome, "agent_ready");
  console.log("PASS: testAlwaysReturnsAgentReady");
}

async function main(): Promise<void> {
  await testAlwaysReturnsAgentReady();
}

void main();
