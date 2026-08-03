import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadPipelineConfig } from "./config.js";

function writeConfig(contents: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "pipeline-config-test-"));
  const path = join(dir, "instance.json");
  writeFileSync(path, JSON.stringify(contents), "utf8");
  return path;
}

function testResolvesRelativePathsAgainstProjectRootNotConfigDir(): void {
  // The config file lives in a `config/` subdirectory of the project root
  // (matching config/instance.example.json's real location) — relative
  // paths must resolve against the project root (found via package.json),
  // not against `config/` itself, or "../runchise"-style paths land one
  // directory level off from what's intended.
  const projectRoot = mkdtempSync(join(tmpdir(), "pipeline-config-project-"));
  writeFileSync(join(projectRoot, "package.json"), "{}", "utf8");
  mkdirSync(join(projectRoot, "config"), { recursive: true });
  const configPath = join(projectRoot, "config", "instance.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      repoPath: "sibling-repo",
      worktreeRoot: ".work/worktrees",
      branchPrefix: "agent/",
      baseBranch: "main",
    }),
    "utf8",
  );

  const config = loadPipelineConfig(configPath);
  assert.equal(config.repoPath, resolve(projectRoot, "sibling-repo"));
  assert.equal(config.worktreeRoot, resolve(projectRoot, ".work/worktrees"));
  console.log("PASS: testResolvesRelativePathsAgainstProjectRootNotConfigDir");
}

function testLoadsMinimalConfigWithDefaults(): void {
  const path = writeConfig({
    repoPath: "../repo",
    worktreeRoot: ".work",
    branchPrefix: "agent/",
    baseBranch: "main",
  });

  const config = loadPipelineConfig(path);
  assert.equal(config.engineMode, "pty");
  assert.equal(config.implementTimeoutMs, 1200000);
  assert.equal(config.verifyTimeoutMs, 1800000);
  assert.ok(config.repoPath.endsWith("/repo"));
  assert.ok(!config.repoPath.startsWith(".."), "repoPath should be resolved to an absolute path");
  console.log("PASS: testLoadsMinimalConfigWithDefaults");
}

function testRespectsExplicitOverrides(): void {
  const path = writeConfig({
    repoPath: "../repo",
    worktreeRoot: ".work",
    branchPrefix: "agent/",
    baseBranch: "main",
    engineMode: "headless",
    implementTimeoutMs: 5000,
    verifyTimeoutMs: 6000,
  });

  const config = loadPipelineConfig(path);
  assert.equal(config.engineMode, "headless");
  assert.equal(config.implementTimeoutMs, 5000);
  assert.equal(config.verifyTimeoutMs, 6000);
  console.log("PASS: testRespectsExplicitOverrides");
}

function testThrowsWhenRequiredFieldMissing(): void {
  const path = writeConfig({ repoPath: "../repo" });
  assert.throws(() => loadPipelineConfig(path), /worktreeRoot/);
  console.log("PASS: testThrowsWhenRequiredFieldMissing");
}

function testThrowsWhenEngineModeInvalid(): void {
  const path = writeConfig({
    repoPath: "../repo",
    worktreeRoot: ".work",
    branchPrefix: "agent/",
    baseBranch: "main",
    engineMode: "carrier-pigeon",
  });
  assert.throws(() => loadPipelineConfig(path), /engineMode/);
  console.log("PASS: testThrowsWhenEngineModeInvalid");
}

function main(): void {
  testResolvesRelativePathsAgainstProjectRootNotConfigDir();
  testLoadsMinimalConfigWithDefaults();
  testRespectsExplicitOverrides();
  testThrowsWhenRequiredFieldMissing();
  testThrowsWhenEngineModeInvalid();
}

main();
