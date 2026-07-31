import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { exec, fillArgs } from "./proc.js";
import type { CommandTemplate, DiffSummary, RspecResult } from "./types.js";

/**
 * Tentukan spec mana yang perlu dijalankan dari daftar file yang berubah.
 *
 * Sengaja TIDAK menjalankan seluruh suite: suite penuh butuh postgres, redis,
 * elasticsearch, dan clickhouse, dan durasinya panjang (repo ini memakai
 * parallel_tests, tanda suite-nya sudah besar). Untuk loop umpan balik agent,
 * yang dibutuhkan adalah spec yang relevan dan cepat.
 *
 * Trade-off yang harus disadari: ini bisa melewatkan regresi di tempat lain.
 * Karena itu CI penuh di Bitbucket Pipelines tetap jadi gerbang terakhir
 * sebelum merge — yang di sini cuma umpan balik cepat untuk agent.
 */
export function deriveSpecTargets(
  diff: DiffSummary,
  worktreePath: string,
): string[] {
  const targets = new Set<string>();

  for (const stat of diff.stats) {
    const file = stat.file;

    if (file.startsWith("spec/") && file.endsWith("_spec.rb")) {
      targets.add(file);
      continue;
    }

    if (!file.startsWith("app/") || !file.endsWith(".rb")) continue;

    for (const candidate of candidateSpecPaths(file)) {
      if (existsSync(join(worktreePath, candidate))) {
        targets.add(candidate);
      }
    }
  }

  return [...targets].sort();
}

/**
 * Repo ini tidak konsisten menaruh spec: spec untuk kode di app/domains/report
 * sebagian ada di spec/domains/report, sebagian di spec/domains/restaurant.
 * Jadi kita coba beberapa kemungkinan dan pakai yang benar-benar ada.
 */
function candidateSpecPaths(appFile: string): string[] {
  const withoutApp = appFile.replace(/^app\//, "");
  const base = withoutApp.replace(/\.rb$/, "");

  return [
    `spec/${base}_spec.rb`,
    `spec/${base.replace(/^domains\//, "domains/")}_spec.rb`,
    `spec/requests/${base.split("/").pop() ?? ""}_request_spec.rb`,
  ].filter((p) => p.length > 0 && !p.endsWith("/_spec.rb"));
}

export interface RunRspecOptions {
  template: CommandTemplate;
  worktreePath: string;
  targets: string[];
  timeoutMs: number;
  outFileName?: string;
}

export async function runRspec(options: RunRspecOptions): Promise<RspecResult> {
  const { template, worktreePath, targets, timeoutMs } = options;
  const outFileName = options.outFileName ?? "tmp/agent-rspec.json";

  if (targets.length === 0) {
    return {
      ran: false,
      exitCode: null,
      timedOut: false,
      targets: [],
      exampleCount: null,
      failureCount: null,
      pendingCount: null,
      durationSec: null,
    };
  }

  const args = fillArgs(template.args, {
    outFile: outFileName,
    targets,
  });

  const result = await exec(template.bin, args, {
    cwd: worktreePath,
    timeoutMs,
  });

  const parsed = readRspecJson(join(worktreePath, outFileName));

  return {
    ran: true,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    targets,
    exampleCount: parsed.exampleCount,
    failureCount: parsed.failureCount,
    pendingCount: parsed.pendingCount,
    durationSec: parsed.durationSec ?? result.durationSec,
  };
}

interface ParsedRspec {
  exampleCount: number | null;
  failureCount: number | null;
  pendingCount: number | null;
  durationSec: number | null;
}

function readRspecJson(path: string): ParsedRspec {
  const empty: ParsedRspec = {
    exampleCount: null,
    failureCount: null,
    pendingCount: null,
    durationSec: null,
  };

  if (!existsSync(path)) return empty;

  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const summary = raw["summary"];
    if (typeof summary !== "object" || summary === null) return empty;

    const s = summary as Record<string, unknown>;
    return {
      exampleCount: numberOrNull(s["example_count"]),
      failureCount: numberOrNull(s["failure_count"]),
      pendingCount: numberOrNull(s["pending_count"]),
      durationSec: numberOrNull(s["duration"]),
    };
  } catch {
    return empty;
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function rspecGreen(rspec: RspecResult | null): boolean {
  if (rspec === null || !rspec.ran || rspec.timedOut) return false;
  if (rspec.exitCode !== 0) return false;
  return rspec.failureCount === null || rspec.failureCount === 0;
}
