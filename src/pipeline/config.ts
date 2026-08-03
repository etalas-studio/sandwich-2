import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export interface PipelineConfig {
  repoPath: string;
  worktreeRoot: string;
  branchPrefix: string;
  baseBranch: string;
  engineMode: "headless" | "pty";
  implementTimeoutMs: number;
  verifyTimeoutMs: number;
  scanTimeoutMs: number;
}

const REQUIRED_STRING_FIELDS = ["repoPath", "worktreeRoot", "branchPrefix", "baseBranch"] as const;

export const DEFAULT_ENGINE_MODE = "pty";
export const DEFAULT_IMPLEMENT_TIMEOUT_MS = 20 * 60 * 1000;
export const DEFAULT_VERIFY_TIMEOUT_MS = 30 * 60 * 1000;
export const DEFAULT_SCAN_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_WORKTREE_ROOT = ".work/worktrees";
export const DEFAULT_BRANCH_PREFIX = "agent/";

/**
 * Nearest ancestor directory containing a package.json, used as the base
 * for resolving this config's relative paths — so "../runchise" means
 * sibling-of-project-root regardless of which subdirectory the config file
 * itself lives in (e.g. config/instance.json). Falls back to startDir if
 * none is found within 10 levels. Mirrors the equivalent helper already in
 * the legacy src/config.ts (reimplemented here rather than imported — that
 * module belongs to the prior attempt's pipeline, not this one).
 */
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let depth = 0; depth < 10; depth += 1) {
    if (existsSync(resolve(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

/**
 * A minimal instance config distinct from the legacy `config/pipeline.json`
 * (see docs/superpowers/plans/2026-08-03-storage-sqlite.md, which already
 * established that src/config.ts's Config type belongs to the prior
 * attempt's pipeline and isn't extended here). Engine mode defaults to
 * "pty" — a deliberate instance-level override of the Phase 1 spec's
 * originally recommended "headless" default; see
 * docs/superpowers/specs/2026-08-03-pipeline-shape-design.md.
 */
export function loadPipelineConfig(configPath: string): PipelineConfig {
  const absConfigPath = resolve(configPath);

  if (!existsSync(absConfigPath)) {
    throw new Error(`Pipeline config not found: ${absConfigPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absConfigPath, "utf8"));
  } catch (err) {
    throw new Error(
      `Pipeline config is not valid JSON (${absConfigPath}): ${(err as Error).message}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Pipeline config must be a JSON object: ${absConfigPath}`);
  }

  const raw = parsed as Record<string, unknown>;

  for (const key of REQUIRED_STRING_FIELDS) {
    if (typeof raw[key] !== "string") {
      throw new Error(`Pipeline config missing required string field "${key}": ${absConfigPath}`);
    }
  }

  const rawEngineMode = raw["engineMode"];
  if (rawEngineMode !== undefined && rawEngineMode !== "headless" && rawEngineMode !== "pty") {
    throw new Error(
      `Pipeline config "engineMode" must be "headless" or "pty", got ${JSON.stringify(rawEngineMode)}: ${absConfigPath}`,
    );
  }

  const projectRoot = findProjectRoot(dirname(absConfigPath));
  const abs = (p: string): string => (isAbsolute(p) ? p : resolve(projectRoot, p));

  const rawImplementTimeoutMs = raw["implementTimeoutMs"];
  const rawVerifyTimeoutMs = raw["verifyTimeoutMs"];
  const rawScanTimeoutMs = raw["scanTimeoutMs"];

  return {
    repoPath: abs(raw["repoPath"] as string),
    worktreeRoot: abs(raw["worktreeRoot"] as string),
    branchPrefix: raw["branchPrefix"] as string,
    baseBranch: raw["baseBranch"] as string,
    engineMode: rawEngineMode ?? DEFAULT_ENGINE_MODE,
    implementTimeoutMs:
      typeof rawImplementTimeoutMs === "number" ? rawImplementTimeoutMs : DEFAULT_IMPLEMENT_TIMEOUT_MS,
    verifyTimeoutMs:
      typeof rawVerifyTimeoutMs === "number" ? rawVerifyTimeoutMs : DEFAULT_VERIFY_TIMEOUT_MS,
    scanTimeoutMs: typeof rawScanTimeoutMs === "number" ? rawScanTimeoutMs : DEFAULT_SCAN_TIMEOUT_MS,
  };
}
