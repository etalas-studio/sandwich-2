import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import type { AreaSignal } from "../db/readiness-scans.js";

export interface MechanicalResult {
  projectName: string;
  techStack: string;
  testCommand: string | null;
  areaSignals: AreaSignal[];
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".work",
  ".worktrees",
  "build",
  "coverage",
  ".next",
]);

const TEST_FILE_PATTERNS = [/\.test\./, /\.spec\./, /^__tests__$/];

export function scanMechanical(repoPath: string): MechanicalResult {
  const pkgJson = readPkgJson(repoPath);
  const projectName = pkgJson?.name ?? "unknown";
  const techStack = detectTechStack(repoPath, pkgJson);
  const testCommand = pkgJson?.scripts?.["test"] ?? null;
  const areaSignals = computeAreaSignals(repoPath);
  return { projectName, techStack, testCommand, areaSignals };
}

interface PkgJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readPkgJson(repoPath: string): PkgJson | null {
  const p = join(repoPath, "package.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as PkgJson;
  } catch {
    return null;
  }
}

function detectTechStack(
  repoPath: string,
  pkgJson: PkgJson | null,
): string {
  const deps = new Set<string>();
  if (pkgJson) {
    const depSources = [
      pkgJson.dependencies,
      pkgJson.devDependencies,
      pkgJson.peerDependencies,
    ];
    for (const obj of depSources) {
      if (obj && typeof obj === "object") {
        for (const dep of Object.keys(obj)) deps.add(dep);
      }
    }
  }

  const techs: string[] = ["Node.js"];

  if (deps.has("typescript") || existsSync(join(repoPath, "tsconfig.json"))) {
    techs.push("TypeScript");
  }
  if (deps.has("react")) techs.push("React");
  if (deps.has("express")) techs.push("Express");
  if (deps.has("next")) techs.push("Next.js");
  if (deps.has("vue")) techs.push("Vue");
  if (deps.has("vite")) techs.push("Vite");
  if (deps.has("better-sqlite3") || deps.has("sqlite3")) techs.push("SQLite");

  return techs.join(", ");
}

function computeAreaSignals(repoPath: string): AreaSignal[] {
  const topLevel: string[] = [];
  try {
    const entries = readdirSync(repoPath);
    for (const entry of entries) {
      const full = join(repoPath, entry);
      if (IGNORED_DIRS.has(entry)) continue;
      if (!entry.startsWith(".")) {
        try {
          if (statSync(full).isDirectory()) {
            topLevel.push(entry);
          }
        } catch {
          // skip unreadable
        }
      }
    }
  } catch {
    return [];
  }

  // Compute churn per area
  const churnCounts = computeChurn(repoPath, topLevel);

  const maxChurn = Math.max(1, ...Object.values(churnCounts));

  const areaSignals: AreaSignal[] = [];
  for (const area of topLevel.sort()) {
    const { testCount, codeCount } = countTestFiles(join(repoPath, area));
    const files = testCount + codeCount;
    if (files === 0) continue;
    const churnRaw = churnCounts[area] ?? 0;
    areaSignals.push({
      area,
      files,
      testToCodeRatio: codeCount > 0 ? testCount / codeCount : 0,
      churnScore: maxChurn > 0 ? churnRaw / maxChurn : 0,
      note: "",
    });
  }
  return areaSignals;
}

function countTestFiles(dir: string): { testCount: number; codeCount: number } {
  let testCount = 0;
  let codeCount = 0;
  try {
    walk(dir, (filePath) => {
      const name = basename(filePath);
      if (isTestFile(filePath, name)) {
        testCount++;
      } else if (isCodeFile(name)) {
        codeCount++;
      }
    });
  } catch {
    // skip unreadable dirs
  }
  return { testCount, codeCount };
}

function walk(dir: string, fn: (path: string) => void): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") {
        // All files in __tests__ are test files
        walkAll(full, fn);
      } else if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        walk(full, fn);
      }
    } else if (entry.isFile()) {
      fn(full);
    }
  }
}

function walkAll(dir: string, fn: (path: string) => void): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAll(full, fn);
    } else if (entry.isFile()) {
      fn(full);
    }
  }
}

function isTestFile(filePath: string, name: string): boolean {
  // Files under __tests__ are always tests
  if (filePath.includes("__tests__")) return true;
  return TEST_FILE_PATTERNS.some((re) => re.test(name));
}

function isCodeFile(name: string): boolean {
  const codeExts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
  // Don't count test files or declaration files as code
  if (name.endsWith(".d.ts") || name.endsWith(".d.mts") || name.endsWith(".d.cts"))
    return false;
  return codeExts.some((ext) => name.endsWith(ext));
}

function computeChurn(
  repoPath: string,
  areas: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const area of areas) counts[area] = 0;

  try {
    const output = execSync(
      "git log --since='90 days ago' --name-only --format=''",
      {
        cwd: repoPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10_000,
      },
    );
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      for (const area of areas) {
        if (trimmed.startsWith(area + "/") || trimmed === area) {
          counts[area] = (counts[area] ?? 0) + 1;
          break;
        }
      }
    }
  } catch {
    // git may fail (no commits, not a repo) — return zeros
  }
  return counts;
}
