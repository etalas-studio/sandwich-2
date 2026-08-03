import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { computeAreaSignals } from "./scan-analysis.js";
import type { AreaProposal } from "./scan-prompt.js";

function initTestRepo(): string {
  const path = mkdtempSync(join(tmpdir(), "scan-analysis-test-repo-"));
  execSync("git init -q", { cwd: path });
  execSync("git config user.email test@example.com", { cwd: path });
  execSync("git config user.name Test", { cwd: path });
  return path;
}

function writeFile(repoPath: string, relPath: string, contents = ""): void {
  const abs = join(repoPath, relPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, contents);
}

function commitAll(repoPath: string, message: string): void {
  execSync("git add -A", { cwd: repoPath });
  execSync(`git commit -q -m "${message}"`, { cwd: repoPath });
}

async function testFallsBackToTopLevelDirectoriesWhenNoAgentAreasGiven(): Promise<void> {
  const repo = initTestRepo();
  writeFile(repo, "src/index.ts");
  writeFile(repo, "src/index.test.ts");
  writeFile(repo, "web/app.tsx");
  commitAll(repo, "initial");

  const signals = await computeAreaSignals(repo);
  const names = signals.map((s) => s.pathPrefix).sort();

  assert.deepEqual(names, ["src", "web"]);
  console.log("PASS: testFallsBackToTopLevelDirectoriesWhenNoAgentAreasGiven");
}

async function testFallsBackWhenAgentAreasArrayIsEmpty(): Promise<void> {
  const repo = initTestRepo();
  writeFile(repo, "src/index.ts");
  commitAll(repo, "initial");

  const signals = await computeAreaSignals(repo, []);
  assert.deepEqual(signals.map((s) => s.pathPrefix), ["src"]);
  console.log("PASS: testFallsBackWhenAgentAreasArrayIsEmpty");
}

async function testUsesAgentProposedGroupingWhenValid(): Promise<void> {
  const repo = initTestRepo();
  // A layout that a depth-1 heuristic would get wrong: everything lives
  // under app/, but the real seams are domain modules nested two levels
  // deep — orders vs billing.
  writeFile(repo, "app/domain/orders/order.ts");
  writeFile(repo, "app/domain/orders/order.test.ts");
  writeFile(repo, "app/domain/billing/invoice.ts");
  commitAll(repo, "initial");

  const areas: AreaProposal[] = [
    { name: "orders", paths: ["app/domain/orders"] },
    { name: "billing", paths: ["app/domain/billing"] },
  ];
  const signals = await computeAreaSignals(repo, areas);
  const byName = new Map(signals.map((s) => [s.pathPrefix, s]));

  assert.deepEqual([...byName.keys()].sort(), ["billing", "orders"]);
  assert.equal(byName.get("orders")!.testToCodeRatio, 1); // 1 test file / 1 code file
  assert.equal(byName.get("billing")!.testToCodeRatio, 0); // 0 test files / 1 code file
  console.log("PASS: testUsesAgentProposedGroupingWhenValid");
}

async function testFallsBackWhenEveryProposedPathIsHallucinated(): Promise<void> {
  const repo = initTestRepo();
  writeFile(repo, "src/index.ts");
  commitAll(repo, "initial");

  const areas: AreaProposal[] = [{ name: "nonexistent", paths: ["this/does/not/exist"] }];
  const signals = await computeAreaSignals(repo, areas);

  assert.deepEqual(signals.map((s) => s.pathPrefix), ["src"]);
  console.log("PASS: testFallsBackWhenEveryProposedPathIsHallucinated");
}

async function testDropsIndividualHallucinatedPathsButKeepsAreaIfSomeSurvive(): Promise<void> {
  const repo = initTestRepo();
  writeFile(repo, "src/real.ts");
  commitAll(repo, "initial");

  const areas: AreaProposal[] = [{ name: "mixed", paths: ["src", "src/fake-nonexistent"] }];
  const signals = await computeAreaSignals(repo, areas);

  assert.deepEqual(signals.map((s) => s.pathPrefix), ["mixed"]);
  console.log("PASS: testDropsIndividualHallucinatedPathsButKeepsAreaIfSomeSurvive");
}

async function testRejectsPathTraversalAttempts(): Promise<void> {
  const repo = initTestRepo();
  writeFile(repo, "src/index.ts");
  commitAll(repo, "initial");

  const areas: AreaProposal[] = [{ name: "escape", paths: ["../../etc"] }];
  const signals = await computeAreaSignals(repo, areas);

  // No valid paths survive sanitization for "escape", and it's the only
  // proposed area, so the whole thing falls back to top-level directories.
  assert.deepEqual(signals.map((s) => s.pathPrefix), ["src"]);
  console.log("PASS: testRejectsPathTraversalAttempts");
}

async function testAcceptsAFilePathNotJustDirectories(): Promise<void> {
  const repo = initTestRepo();
  writeFile(repo, "src/payments/gateway.ts");
  commitAll(repo, "initial");

  const areas: AreaProposal[] = [{ name: "gateway", paths: ["src/payments/gateway.ts"] }];
  const signals = await computeAreaSignals(repo, areas);

  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.pathPrefix, "gateway");
  assert.equal(signals[0]!.testToCodeRatio, 0);
  console.log("PASS: testAcceptsAFilePathNotJustDirectories");
}

async function testDoesNotPrefixMatchSimilarlyNamedDirectories(): Promise<void> {
  const repo = initTestRepo();
  writeFile(repo, "src/orders/order.ts");
  writeFile(repo, "src/orders-legacy/old.ts");
  commitAll(repo, "initial"); // touches both src/orders/order.ts and src/orders-legacy/old.ts once each
  // Touch only the legacy dir again — its churn must not leak into "orders"
  // via a naive string-prefix match ("src/orders-legacy/old.ts".startsWith("src/orders") is true).
  writeFile(repo, "src/orders-legacy/old.ts", "// changed\n");
  commitAll(repo, "touch legacy only");

  const areas: AreaProposal[] = [
    { name: "orders", paths: ["src/orders"] },
    { name: "legacy", paths: ["src/orders-legacy"] },
  ];
  const signals = await computeAreaSignals(repo, areas);
  const byName = new Map(signals.map((s) => [s.pathPrefix, s]));

  // orders: touched once (initial commit only) = churn 1.
  // legacy: touched twice (initial + the legacy-only commit) = churn 2, the max.
  // Under a naive prefix match, "orders" would wrongly also pick up both of
  // legacy's commits, making orders >= legacy instead of strictly less.
  assert.ok(
    byName.get("orders")!.churnScore < byName.get("legacy")!.churnScore,
    `expected orders churn (${byName.get("orders")!.churnScore}) < legacy churn (${byName.get("legacy")!.churnScore})`,
  );
  assert.equal(byName.get("legacy")!.churnScore, 1); // legacy is the busiest area, normalized to 1
  assert.equal(byName.get("orders")!.churnScore, 0.5); // half of legacy's raw count
  console.log("PASS: testDoesNotPrefixMatchSimilarlyNamedDirectories");
}

async function main(): Promise<void> {
  await testFallsBackToTopLevelDirectoriesWhenNoAgentAreasGiven();
  await testFallsBackWhenAgentAreasArrayIsEmpty();
  await testUsesAgentProposedGroupingWhenValid();
  await testFallsBackWhenEveryProposedPathIsHallucinated();
  await testDropsIndividualHallucinatedPathsButKeepsAreaIfSomeSurvive();
  await testRejectsPathTraversalAttempts();
  await testAcceptsAFilePathNotJustDirectories();
  await testDoesNotPrefixMatchSimilarlyNamedDirectories();
}

void main();
