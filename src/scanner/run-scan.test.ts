import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { openDb } from "../db/connection.js";
import { getLatestReadinessScan, startReadinessScan } from "../db/readiness-scans.js";
import { getBlocklistEntries } from "../db/blocklist.js";
import { createScanRunner } from "./run-scan.js";
import type { InvokerFactory } from "./run-scan.js";

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
      description: "A scanned test app",
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

function areasResponse(desc: string | null, blocklist: Array<{ pattern: string; reason: string }>): string {
  return JSON.stringify({
    description: desc,
    areas: [
      { name: "Core", paths: ["src/"], note: "Core logic" },
    ],
    blocklist,
  });
}

function makeInvokerFactory(responseJson: string): InvokerFactory {
  return (_modelId) => ({
    async run(_opts) {
      return { outcome: "ok" as const, finalText: responseJson };
    },
  });
}

async function testRunScanCompletesWithMechanicalResults(): Promise<void> {
  const db = openTestDb();
  const repo = makeRepo();

  const runScan = createScanRunner(
    db,
    makeInvokerFactory(areasResponse(null, [])),
  );
  const scanId = "test-scan-1";
  startReadinessScan(db, scanId);
  const controller = new AbortController();

  await runScan(scanId, repo, controller.signal, "test/fake");

  const scan = getLatestReadinessScan(db);
  assert.ok(scan);
  assert.equal(scan!.id, "test-scan-1");
  assert.equal(scan!.status, "completed");
  assert.ok(scan!.techStack!.includes("TypeScript"));
  assert.ok(scan!.techStack!.includes("Express"));
  assert.equal(scan!.testCommand, "vitest");
  assert.ok(scan!.areaSignals && scan!.areaSignals.length > 0);
  // Description is null when agent returns null (no fallback to mechanical)
  assert.equal(scan!.description, null);
  console.log("PASS: testRunScanCompletesWithMechanicalResults");
}

async function testRunScanInsertsAgentBlocklistEntries(): Promise<void> {
  const db = openTestDb();
  const repo = makeRepo();

  const runScan = createScanRunner(
    db,
    makeInvokerFactory(
      areasResponse("A test pipeline orchestrator.", [
        { pattern: "src/secrets/**", reason: "API keys" },
      ]),
    ),
  );
  const scanId = "test-scan-2";
  startReadinessScan(db, scanId);
  const controller = new AbortController();

  await runScan(scanId, repo, controller.signal, "test/fake");

  const scan = getLatestReadinessScan(db);
  assert.equal(scan!.description, "A test pipeline orchestrator.");

  const entries = getBlocklistEntries(db);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.pattern, "src/secrets/**");
  assert.equal(entries[0]!.source, "agent");
  console.log("PASS: testRunScanInsertsAgentBlocklistEntries");
}

async function testRunScanAbortsWhenSignalled(): Promise<void> {
  const db = openTestDb();
  const repo = makeRepo();

  const runScan = createScanRunner(db, makeInvokerFactory(areasResponse(null, [])));
  const scanId = "test-scan-3";
  startReadinessScan(db, scanId);
  const controller = new AbortController();
  controller.abort();

  await runScan(scanId, repo, controller.signal, "test/fake");

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
