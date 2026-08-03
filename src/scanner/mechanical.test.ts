import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { scanMechanical } from "./mechanical.js";

function makeFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "mech-scan-"));
  // git init so git log works for churn
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync("git config user.email test@test", { cwd: dir, stdio: "pipe" });
  execSync("git config user.name test", { cwd: dir, stdio: "pipe" });
  return dir;
}

function commitAll(cwd: string, msg: string): void {
  execSync("git add -A", { cwd, stdio: "pipe" });
  execSync(`git commit -m "${msg}"`, { cwd, stdio: "pipe" });
}

// ── Tech stack detection ──

function testDetectsNodeAndTypeScript(): void {
  const dir = makeFixture();
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "my-app", dependencies: {}, devDependencies: { typescript: "^5" } }),
  );
  writeFileSync(join(dir, "tsconfig.json"), "{}");
  commitAll(dir, "init");

  const result = scanMechanical(dir);
  assert.equal(result.projectName, "my-app");
  assert.ok(result.techStack.includes("TypeScript"));
  assert.ok(result.techStack.includes("Node.js"));
  console.log("PASS: testDetectsNodeAndTypeScript");
}

function testDetectsReactAndExpress(): void {
  const dir = makeFixture();
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "fullstack",
      dependencies: { react: "^18", express: "^4" },
      devDependencies: { typescript: "^5" },
      scripts: { test: "vitest" },
    }),
  );
  writeFileSync(join(dir, "tsconfig.json"), "{}");
  commitAll(dir, "init");

  const result = scanMechanical(dir);
  assert.ok(result.techStack.includes("TypeScript"));
  assert.ok(result.techStack.includes("React"));
  assert.ok(result.techStack.includes("Express"));
  console.log("PASS: testDetectsReactAndExpress");
}

function testFallbackToNodeOnly(): void {
  const dir = makeFixture();
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "bare", scripts: {} }),
  );
  commitAll(dir, "init");

  const result = scanMechanical(dir);
  assert.equal(result.techStack, "Node.js");
  console.log("PASS: testFallbackToNodeOnly");
}

// ── Test command ──

function testExtractsTestCommand(): void {
  const dir = makeFixture();
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "app", scripts: { test: "vitest run" } }),
  );
  commitAll(dir, "init");

  const result = scanMechanical(dir);
  assert.equal(result.testCommand, "vitest run");
  console.log("PASS: testExtractsTestCommand");
}

function testTestCommandNullWhenMissing(): void {
  const dir = makeFixture();
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "app", scripts: {} }),
  );
  commitAll(dir, "init");

  const result = scanMechanical(dir);
  assert.equal(result.testCommand, null);
  console.log("PASS: testTestCommandNullWhenMissing");
}

// ── Area signals ──

function testComputesAreaSignals(): void {
  const dir = makeFixture();
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "app", scripts: {} }),
  );

  // Create src with test and non-test files
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "index.ts"), "// code");
  writeFileSync(join(dir, "src", "utils.ts"), "// code");
  writeFileSync(join(dir, "src", "index.test.ts"), "// test");
  writeFileSync(join(dir, "src", "utils.test.ts"), "// test");

  // Create lib with only non-test files
  mkdirSync(join(dir, "lib"), { recursive: true });
  writeFileSync(join(dir, "lib", "helper.ts"), "// code");
  writeFileSync(join(dir, "lib", "parser.ts"), "// code");

  // Create __tests__ directory
  mkdirSync(join(dir, "__tests__"), { recursive: true });
  writeFileSync(join(dir, "__tests__", "integration.ts"), "// test");

  commitAll(dir, "initial commit");

  const result = scanMechanical(dir);

  // Should have src, lib, __tests__ areas (but not node_modules-style dirs)
  const areas = result.areaSignals.map((a) => a.area).sort();
  assert.ok(areas.includes("src"));
  assert.ok(areas.includes("lib"));

  // src: 2 test files, 2 code files → ratio 1.0
  const src = result.areaSignals.find((a) => a.area === "src");
  assert.ok(src);
  assert.equal(src!.files, 4);
  assert.equal(src!.testToCodeRatio, 1.0);

  // lib: 0 test files, 2 code files → ratio 0
  const lib = result.areaSignals.find((a) => a.area === "lib");
  assert.ok(lib);
  assert.equal(lib!.files, 2);
  assert.equal(lib!.testToCodeRatio, 0.0);

  console.log("PASS: testComputesAreaSignals");
}

function testExcludesIgnoredDirectories(): void {
  const dir = makeFixture();
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "app", scripts: {} }),
  );

  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "index.ts"), "// code");

  // These should be excluded
  mkdirSync(join(dir, "node_modules"), { recursive: true });
  writeFileSync(join(dir, "node_modules", "dep.js"), "// dep");
  mkdirSync(join(dir, ".git"), { recursive: true });
  writeFileSync(join(dir, ".git", "config"), "");
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "dist", "bundle.js"), "// built");

  commitAll(dir, "init");

  const result = scanMechanical(dir);
  const areas = result.areaSignals.map((a) => a.area);

  assert.ok(areas.includes("src"));
  assert.ok(!areas.includes("node_modules"));
  assert.ok(!areas.includes(".git"));
  assert.ok(!areas.includes("dist"));
  console.log("PASS: testExcludesIgnoredDirectories");
}

function testHandlesMissingPackageJson(): void {
  const dir = makeFixture();
  // Create a dummy file so git commit succeeds
  writeFileSync(join(dir, "README.md"), "# test");
  commitAll(dir, "empty repo");

  const result = scanMechanical(dir);
  assert.equal(result.projectName, "unknown");
  assert.equal(result.techStack, "Node.js");
  assert.equal(result.testCommand, null);
  console.log("PASS: testHandlesMissingPackageJson");
}

function main(): void {
  testDetectsNodeAndTypeScript();
  testDetectsReactAndExpress();
  testFallbackToNodeOnly();
  testExtractsTestCommand();
  testTestCommandNullWhenMissing();
  testComputesAreaSignals();
  testExcludesIgnoredDirectories();
  testHandlesMissingPackageJson();
}

main();
