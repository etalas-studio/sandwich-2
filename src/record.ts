import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { DiffSummary, RunRecord } from "./types.js";

export interface RunArtifacts {
  planPrompt?: string;
  plan?: string;
  planTranscript?: string[];
  implementTranscript?: string[];
  implementOutput?: string;
  diff?: DiffSummary;
  toolCalls?: Record<string, number>;
  stderr?: string;
}

/** Timestamp yang aman dipakai sebagai nama folder. */
export function runStamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-").replace("Z", "");
}

export function runDir(runsRoot: string, ticket: string, stamp: string): string {
  return join(runsRoot, ticket, stamp);
}

/**
 * Satu percobaan, satu folder, semuanya file biasa.
 *
 * Kenapa file dan bukan database: selama pilot jumlahnya puluhan. File bisa
 * di-grep, di-diff, dan foldernya bisa langsung diserahkan ke klien sebagai
 * bukti. Database baru masuk akal kalau sudah ratusan percobaan per minggu.
 */
export function writeRun(
  runsRoot: string,
  record: RunRecord,
  artifacts: RunArtifacts,
): string {
  const dir = runDir(runsRoot, record.ticket, record.runId);
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, "meta.json"), JSON.stringify(record, null, 2) + "\n", "utf8");

  if (artifacts.planPrompt) {
    writeFileSync(join(dir, "plan-prompt.md"), artifacts.planPrompt, "utf8");
  }
  if (artifacts.plan) {
    writeFileSync(join(dir, "plan.md"), artifacts.plan, "utf8");
  }
  if (artifacts.implementOutput) {
    writeFileSync(join(dir, "agent-output.md"), artifacts.implementOutput, "utf8");
  }
  if (artifacts.planTranscript) {
    writeFileSync(
      join(dir, "transcript-plan.jsonl"),
      artifacts.planTranscript.join("\n") + "\n",
      "utf8",
    );
  }
  if (artifacts.implementTranscript) {
    writeFileSync(
      join(dir, "transcript-implement.jsonl"),
      artifacts.implementTranscript.join("\n") + "\n",
      "utf8",
    );
  }
  if (artifacts.diff) {
    writeFileSync(join(dir, "diff.patch"), artifacts.diff.patch, "utf8");
    writeFileSync(
      join(dir, "files.json"),
      JSON.stringify(
        {
          filesChanged: artifacts.diff.filesChanged,
          diffLines: artifacts.diff.diffLines,
          addedTestFiles: artifacts.diff.addedTestFiles,
          stats: artifacts.diff.stats,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  if (artifacts.toolCalls) {
    writeFileSync(
      join(dir, "tool-calls.json"),
      JSON.stringify(artifacts.toolCalls, null, 2) + "\n",
      "utf8",
    );
  }
  if (artifacts.stderr && artifacts.stderr.trim().length > 0) {
    writeFileSync(join(dir, "stderr.log"), artifacts.stderr, "utf8");
  }
  if (record.rspec) {
    writeFileSync(
      join(dir, "rspec.json"),
      JSON.stringify(record.rspec, null, 2) + "\n",
      "utf8",
    );
  }

  appendIndex(runsRoot, record);

  return dir;
}

function appendIndex(runsRoot: string, record: RunRecord): void {
  mkdirSync(runsRoot, { recursive: true });
  appendFileSync(join(runsRoot, "runs.jsonl"), JSON.stringify(record) + "\n", "utf8");
}

/**
 * Baca indeks. `runs.jsonl` bersifat append-only — satu percobaan bisa ditulis
 * beberapa kali (tahap rencana, lalu implementasi, lalu hasil review). Yang
 * dipakai adalah baris TERAKHIR untuk tiap kombinasi tiket + runId.
 *
 * Append-only dipilih supaya riwayat perubahan status tidak hilang dan file
 * tidak pernah ditulis ulang — kalau proses mati di tengah, yang sudah tercatat
 * tetap utuh.
 */
export function readIndex(runsRoot: string): RunRecord[] {
  const path = join(runsRoot, "runs.jsonl");
  if (!existsSync(path)) return [];

  const latest = new Map<string, RunRecord>();
  const order: string[] = [];

  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.trim().length === 0) continue;
    try {
      const record = JSON.parse(line) as RunRecord;
      const key = `${record.ticket}/${record.runId}`;
      if (!latest.has(key)) order.push(key);
      latest.set(key, record);
    } catch {
      // Baris rusak dilewati, jangan sampai satu baris jelek menghapus seluruh riwayat.
    }
  }

  return order.map((key) => latest.get(key)).filter((r): r is RunRecord => r !== undefined);
}

export function readRun(
  runsRoot: string,
  ticket: string,
  runId: string,
): RunRecord | null {
  const path = join(runDir(runsRoot, ticket, runId), "meta.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as RunRecord;
  } catch {
    return null;
  }
}

/** Baca satu file artefak dari folder percobaan. */
export function readArtifact(
  runsRoot: string,
  ticket: string,
  runId: string,
  name: string,
): string | null {
  // Cegah path traversal: hanya nama file datar yang diizinkan.
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null;
  const path = join(runDir(runsRoot, ticket, runId), name);
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** Tulis ulang meta.json setelah manusia mengisi hasil review. */
export function saveReview(
  runsRoot: string,
  record: RunRecord,
): void {
  const dir = runDir(runsRoot, record.ticket, record.runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "meta.json"), JSON.stringify(record, null, 2) + "\n", "utf8");
  appendIndex(runsRoot, record);
}
