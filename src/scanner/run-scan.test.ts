import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { openDb } from "../db/connection.js";
import { getLatestReadinessScan, startReadinessScan } from "../db/readiness-scans.js";
import { getBlocklistEntries } from "../db/blocklist.js";
import { createScanRunner } from "./run-scan.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "run-scan-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "run-scan-repo-"));
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync("git config user.email test@test", { cwd: dir, stdio: "pipe" });
  execSync("git config user.name test", { cwd: dir, stdio: "pipe" });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "scanned-app",
      dependencies: { express: "^4" },
      devDependencies: { typescript: "^5" },
      scripts: { test: "vitest" },
    }),
  );
  writeFileSync(join(dir, "tsconfig.json"), "{}");
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "index.ts"), "// code");
  execSync("git add -A", { cwd: dir, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: dir, stdio: "pipe" });
  return dir;
}

async function testRunScanCompletesWithMechanicalResults(): Promise<void> {
  const db = openTestDb();
  const repo = makeRepo();

  // Fake invoker that returns empty blocklist
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return { outcome: "ok" as const, finalText: "[]" };
    },
  };

  const runScan = createScanRunner(db, invoker);
  const scanId = "test-scan-1";
  startReadinessScan(db, scanId);
  const controller = new AbortController();

  await runScan(scanId, repo, controller.signal);

  const scan = getLatestReadinessScan(db);
  assert.ok(scan);
  assert.equal(scan!.id, "test-scan-1");
  assert.equal(scan!.status, "completed");
  assert.ok(scan!.techStack!.includes("TypeScript"));
  assert.ok(scan!.techStack!.includes("Express"));
  assert.equal(scan!.testCommand, "vitest");
  assert.ok(scan!.areaSignals && scan!.areaSignals.length > 0);
  console.log("PASS: testRunScanCompletesWithMechanicalResults");
}

async function testRunScanInsertsAgentBlocklistEntries(): Promise<void> {
  const db = openTestDb();
  const repo = makeRepo();

  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      return {
        outcome: "ok" as const,
        finalText: JSON.stringify([
          { pattern: "src/secrets/**", reason: "API keys" },
        ]),
      };
    },
  };

  const runScan = createScanRunner(db, invoker);
  const scanId = "test-scan-2";
  startReadinessScan(db, scanId);
  const controller = new AbortController();

  await runScan(scanId, repo, controller.signal);

  const entries = getBlocklistEntries(db);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.pattern, "src/secrets/**");
  assert.equal(entries[0]!.source, "agent");
  assert.equal(entries[0]!.proposedByScanId, "test-scan-2");
  console.log("PASS: testRunScanInsertsAgentBlocklistEntries");
}

async function testRunScanAbortsWhenSignalled(): Promise<void> {
  const db = openTestDb();
  const repo = makeRepo();

  let runCalled = false;
  const invoker = {
    async run(_opts: { prompt: string; cwd: string; timeoutMs: number }) {
      runCalled = true;
      return { outcome: "ok" as const, finalText: "[]" };
    },
  };

  const runScan = createScanRunner(db, invoker);
  const scanId = "test-scan-3";
  startReadinessScan(db, scanId);
  const controller = new AbortController();
  controller.abort(); // Abort before running

  await runScan(scanId, repo, controller.signal);

  // The invoker should not have been called
  assert.equal(runCalled, false);

  // The scan should be aborted
  const scan = getLatestReadinessScan(db);
  assert.ok(scan);
  assert.equal(scan!.status, "aborted");
  console.log("PASS: testRunScanAbortsWhenSignalled");
}

async function main(): Promise<void> {
  await testRunScanCompletesWithMechanicalResults();
  await testRunScanInsertsAgentBlocklistEntries();
  await testRunScanAbortsWhenSignalled();
}

main();
