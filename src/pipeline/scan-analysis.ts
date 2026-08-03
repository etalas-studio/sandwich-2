import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { exec } from "../proc.js";
import type { AreaSignal } from "../db/readiness-scans.js";

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function readPackageJson(repoPath: string): PackageJsonShape | null {
  const path = join(repoPath, "package.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageJsonShape;
  } catch {
    return null;
  }
}

const FRAMEWORK_MARKERS: { dep: string; label: string }[] = [
  { dep: "react", label: "React" },
  { dep: "vue", label: "Vue" },
  { dep: "express", label: "Express" },
  { dep: "next", label: "Next.js" },
];

/**
 * Coarse and mechanical, per the product spec's "lightweight, mostly
 * mechanical" framing for the readiness scan — not an exhaustive framework
 * detector.
 */
export function detectTechStack(repoPath: string): string {
  const pkg = readPackageJson(repoPath);
  if (!pkg) return "unknown tech stack";

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const labels: string[] = ["Node.js"];

  if (existsSync(join(repoPath, "tsconfig.json")) || "typescript" in deps) {
    labels.push("TypeScript");
  }
  for (const marker of FRAMEWORK_MARKERS) {
    if (marker.dep in deps) labels.push(marker.label);
  }

  return labels.join(", ");
}

export function detectTestCommand(repoPath: string): string | null {
  const pkg = readPackageJson(repoPath);
  const command = pkg?.scripts?.test;
  return command && command.trim().length > 0 ? command : null;
}

const EXCLUDED_DIR_NAMES = new Set(["node_modules", "dist", "build", "out", ".work", "coverage"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[^/]+$/;

function isExcludedDir(name: string): boolean {
  return name.startsWith(".") || EXCLUDED_DIR_NAMES.has(name);
}

function listTopLevelAreas(repoPath: string): string[] {
  return readdirSync(repoPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !isExcludedDir(entry.name))
    .map((entry) => entry.name);
}

interface FileCounts {
  testFiles: number;
  codeFiles: number;
}

/** `inTestDir` propagates once true — everything under a `__tests__/` dir counts as a test file, not just names matching TEST_FILE_PATTERN. */
function countFiles(dirPath: string, inTestDir: boolean): FileCounts {
  let testFiles = 0;
  let codeFiles = 0;

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (isExcludedDir(entry.name)) continue;
      const nested = countFiles(join(dirPath, entry.name), inTestDir || entry.name === "__tests__");
      testFiles += nested.testFiles;
      codeFiles += nested.codeFiles;
      continue;
    }
    if (!entry.isFile()) continue;
    if (inTestDir || TEST_FILE_PATTERN.test(entry.name)) {
      testFiles += 1;
    } else {
      codeFiles += 1;
    }
  }

  return { testFiles, codeFiles };
}

async function computeChurnByArea(repoPath: string, areas: string[]): Promise<Map<string, number>> {
  const churn = new Map(areas.map((area) => [area, 0]));
  const result = await exec("git", ["log", "--since=90 days ago", "--name-only", "--pretty=format:"], {
    cwd: repoPath,
    timeoutMs: 30_000,
  });
  if (result.exitCode !== 0) return churn;

  for (const line of result.stdout.split("\n")) {
    const file = line.trim();
    if (!file) continue;
    const topLevel = file.split("/")[0];
    if (topLevel && churn.has(topLevel)) {
      churn.set(topLevel, (churn.get(topLevel) ?? 0) + 1);
    }
  }
  return churn;
}

/**
 * Per-area test-to-code ratio and normalized churn score, per
 * docs/superpowers/specs/2026-08-04-readiness-scan-design.md. "Areas" are
 * the repo's top-level directories.
 */
export async function computeAreaSignals(repoPath: string): Promise<AreaSignal[]> {
  const areas = listTopLevelAreas(repoPath);
  const churnByArea = await computeChurnByArea(repoPath, areas);
  const maxChurn = Math.max(0, ...churnByArea.values());

  return areas.map((area) => {
    const { testFiles, codeFiles } = countFiles(join(repoPath, area), false);
    const rawChurn = churnByArea.get(area) ?? 0;
    return {
      pathPrefix: area,
      testToCodeRatio: codeFiles === 0 ? 0 : testFiles / codeFiles,
      churnScore: maxChurn === 0 ? 0 : rawChurn / maxChurn,
    };
  });
}
