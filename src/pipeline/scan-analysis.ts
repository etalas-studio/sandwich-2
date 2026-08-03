import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { exec } from "../proc.js";
import type { AreaSignal } from "../db/readiness-scans.js";
import type { AreaProposal } from "./scan-prompt.js";

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

const AGENT_CONTEXT_FILES = ["CLAUDE.md", "AGENTS.md", ".cursorrules", ".cursor/rules"];

/** Returns the first agent-context file found at the repo root, or null if none exist. */
export function detectAgentContextFile(repoPath: string): string | null {
  for (const file of AGENT_CONTEXT_FILES) {
    if (existsSync(join(repoPath, file))) return file;
  }
  return null;
}

const SUBSTANTIAL_README_MIN_CHARS = 200;

/** A README that exists but is only a couple of lines carries little real context. */
export function detectReadme(repoPath: string): { exists: boolean; substantial: boolean } {
  const candidates = ["README.md", "README.rst", "README.txt", "README"];
  for (const file of candidates) {
    const path = join(repoPath, file);
    if (!existsSync(path)) continue;
    let contents = "";
    try {
      contents = readFileSync(path, "utf8");
    } catch {
      /* unreadable README counts as present but not substantial */
    }
    return { exists: true, substantial: contents.trim().length >= SUBSTANTIAL_README_MIN_CHARS };
  }
  return { exists: false, substantial: false };
}

const CI_CONFIG_FILES = [".gitlab-ci.yml", "Jenkinsfile", "azure-pipelines.yml", ".circleci/config.yml"];

/** Coarse presence check — a workflows dir with at least one file, or a known single-file CI config. */
export function detectCI(repoPath: string): boolean {
  const workflowsDir = join(repoPath, ".github", "workflows");
  if (existsSync(workflowsDir) && readdirSync(workflowsDir).length > 0) return true;
  return CI_CONFIG_FILES.some((file) => existsSync(join(repoPath, file)));
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

/**
 * Agent-proposed area paths can point at a single file (e.g. a
 * controller), not just a directory — `countFiles` assumes a directory, so
 * this branches on `statSync` first rather than making every caller do it.
 */
function countFilesAtPath(absPath: string): FileCounts {
  const stat = statSync(absPath);
  if (stat.isFile()) {
    const name = absPath.split("/").pop() ?? absPath;
    return TEST_FILE_PATTERN.test(name) ? { testFiles: 1, codeFiles: 0 } : { testFiles: 0, codeFiles: 1 };
  }
  return countFiles(absPath, false);
}

/** A file is "under" an area path if it *is* that path or sits somewhere below it — not merely string-prefixed (so "src/orders" doesn't match "src/orders-legacy"). */
function fileIsUnderPath(file: string, areaPath: string): boolean {
  return file === areaPath || file.startsWith(`${areaPath}/`);
}

async function computeChurnByArea(repoPath: string, areas: AreaDefinition[]): Promise<Map<string, number>> {
  const churn = new Map(areas.map((area) => [area.name, 0]));
  const result = await exec("git", ["log", "--since=90 days ago", "--name-only", "--pretty=format:"], {
    cwd: repoPath,
    timeoutMs: 30_000,
  });
  if (result.exitCode !== 0) return churn;

  for (const line of result.stdout.split("\n")) {
    const file = line.trim();
    if (!file) continue;
    for (const area of areas) {
      if (area.paths.some((path) => fileIsUnderPath(file, path))) {
        churn.set(area.name, (churn.get(area.name) ?? 0) + 1);
        // One area's churn count is incremented at most once per file, even if
        // the file matches more than one of that area's own paths — but a file
        // can still count toward *multiple different* areas if agent-proposed
        // groupings overlap. That's an acceptable, rare edge case: overlapping
        // groupings are the agent's choice, not something this function polices.
        break;
      }
    }
  }
  return churn;
}

interface AreaDefinition {
  name: string;
  paths: string[];
}

/**
 * Rejects paths that don't resolve to something that actually exists inside
 * `repoPath` — an agent can hallucinate a path, typo one, or (worst case)
 * try to walk out of the repo with `../`. Anything that survives this is a
 * real, in-repo relative path safe to hand to `readdirSync`/`join`.
 */
function sanitizeAreaPaths(repoPath: string, rawPaths: string[]): string[] {
  const valid: string[] = [];
  for (const raw of rawPaths) {
    if (typeof raw !== "string") continue;
    const rel = raw.trim().replace(/^\.\//, "").replace(/\/+$/, "");
    if (!rel || rel.startsWith("/") || rel.split("/").includes("..")) continue;
    const abs = join(repoPath, rel);
    if (!existsSync(abs)) continue;
    valid.push(rel);
  }
  return valid;
}

/**
 * Validates agent-proposed area groupings into usable `AreaDefinition`s.
 * Returns `null` (never an empty array) when nothing proposed survives
 * validation, so the caller can fall back to the top-level-directory
 * heuristic instead of reporting zero areas.
 */
function toAreaDefinitions(repoPath: string, proposals: AreaProposal[] | undefined): AreaDefinition[] | null {
  if (!proposals || proposals.length === 0) return null;
  const defs: AreaDefinition[] = [];
  const seenNames = new Set<string>();
  for (const proposal of proposals) {
    const name = typeof proposal?.name === "string" ? proposal.name.trim() : "";
    if (!name || seenNames.has(name)) continue;
    const paths = sanitizeAreaPaths(repoPath, proposal.paths ?? []);
    if (paths.length === 0) continue;
    seenNames.add(name);
    defs.push({ name, paths });
  }
  return defs.length > 0 ? defs : null;
}

function topLevelAreaDefinitions(repoPath: string): AreaDefinition[] {
  return listTopLevelAreas(repoPath).map((name) => ({ name, paths: [name] }));
}

/**
 * Per-area test-to-code ratio and normalized churn score, per
 * docs/superpowers/specs/2026-08-04-readiness-scan-design.md. "Areas" are
 * agent-proposed logical groupings (feature modules, bounded contexts,
 * layers — whatever fits this specific codebase's architecture), passed in
 * as `agentAreas`. Directory layout varies too much across codebases
 * (monorepos, DDD, MVC, a flat `src/`) for "top-level directory" to mean
 * the same thing everywhere, so judging what counts as an "area" is left to
 * the agent, which already has shell access to look at the repo. Falls
 * back to the repo's top-level directories — the original, purely
 * mechanical behavior — whenever `agentAreas` is absent or nothing in it
 * survives validation (hallucinated/malformed/nonexistent paths).
 */
export async function computeAreaSignals(repoPath: string, agentAreas?: AreaProposal[]): Promise<AreaSignal[]> {
  const areas = toAreaDefinitions(repoPath, agentAreas) ?? topLevelAreaDefinitions(repoPath);
  const churnByArea = await computeChurnByArea(repoPath, areas);
  const maxChurn = Math.max(0, ...churnByArea.values());

  return areas.map((area) => {
    let testFiles = 0;
    let codeFiles = 0;
    for (const path of area.paths) {
      const counts = countFilesAtPath(join(repoPath, path));
      testFiles += counts.testFiles;
      codeFiles += counts.codeFiles;
    }
    const rawChurn = churnByArea.get(area.name) ?? 0;
    return {
      pathPrefix: area.name,
      testToCodeRatio: codeFiles === 0 ? 0 : testFiles / codeFiles,
      churnScore: maxChurn === 0 ? 0 : rawChurn / maxChurn,
    };
  });
}
