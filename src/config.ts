import { readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import type { Config } from "./types.js";

const REQUIRED_TOP_LEVEL = [
  "repoPath",
  "worktreeRoot",
  "runsRoot",
  "baseBranch",
  "branchPrefix",
  "limits",
  "engine",
  "rspecCommand",
  "laneRules",
  "blocklist",
] as const;

/**
 * Cari root project: direktori terdekat ke atas yang punya package.json.
 * Dipakai sebagai titik acuan path relatif di config, supaya "../runchise"
 * berarti sibling dari project ini — bukan sibling dari folder config/.
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
 * Muat config dan ubah semua path relatif menjadi absolut, relatif terhadap
 * root project — bukan terhadap cwd. Supaya orchestrator bisa dijalankan dari
 * direktori mana pun tanpa hasil yang berbeda.
 */
export function loadConfig(configPath: string): Config {
  const absConfigPath = resolve(configPath);

  if (!existsSync(absConfigPath)) {
    throw new Error(`Config tidak ditemukan: ${absConfigPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absConfigPath, "utf8"));
  } catch (err) {
    throw new Error(
      `Config bukan JSON yang valid (${absConfigPath}): ${(err as Error).message}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Config harus berupa object: ${absConfigPath}`);
  }

  const raw = parsed as Record<string, unknown>;

  for (const key of REQUIRED_TOP_LEVEL) {
    if (raw[key] === undefined) {
      throw new Error(`Config kurang field "${key}": ${absConfigPath}`);
    }
  }

  const projectRoot = findProjectRoot(dirname(absConfigPath));
  const abs = (p: string): string => (isAbsolute(p) ? p : resolve(projectRoot, p));

  const config = raw as unknown as Config;

  config.repoPath = abs(config.repoPath);
  config.worktreeRoot = abs(config.worktreeRoot);
  config.runsRoot = abs(config.runsRoot);

  if (!existsSync(config.repoPath)) {
    throw new Error(
      `repoPath tidak ada: ${config.repoPath}\n` +
        `Perbaiki "repoPath" di ${absConfigPath}.`,
    );
  }

  validateLimits(config);

  return config;
}

function validateLimits(config: Config): void {
  const { limits } = config;
  const positive: Array<[string, number]> = [
    ["maxFilesChanged", limits.maxFilesChanged],
    ["maxDiffLines", limits.maxDiffLines],
    ["planTimeoutMs", limits.planTimeoutMs],
    ["implementTimeoutMs", limits.implementTimeoutMs],
    ["rspecTimeoutMs", limits.rspecTimeoutMs],
  ];

  for (const [name, value] of positive) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new Error(`limits.${name} harus angka positif, dapat: ${String(value)}`);
    }
  }

  if (limits.maxCiRetries < 0) {
    throw new Error("limits.maxCiRetries tidak boleh negatif");
  }
}
