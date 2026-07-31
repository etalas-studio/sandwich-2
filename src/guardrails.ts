import type {
  BlocklistEntry,
  BlocklistHit,
  Config,
  DiffSummary,
  GuardrailVerdict,
  Lane,
  RspecResult,
} from "./types.js";

/**
 * Pencocokan blocklist. Pola diperlakukan sebagai prefix path, dengan dukungan
 * wildcard `*` untuk satu segmen. Sengaja sederhana — daftar cegat harus bisa
 * dibaca dan diaudit manusia, bukan jadi bahasa pola tersendiri.
 */
export function matchBlocklist(
  files: string[],
  blocklist: BlocklistEntry[],
): BlocklistHit[] {
  const hits: BlocklistHit[] = [];

  for (const file of files) {
    const normalized = file.replace(/^\.\//, "");
    for (const entry of blocklist) {
      if (matchesPattern(normalized, entry.pattern)) {
        hits.push({ file: normalized, pattern: entry.pattern, reason: entry.reason });
        break;
      }
    }
  }

  return hits;
}

function matchesPattern(file: string, pattern: string): boolean {
  if (pattern.includes("*")) {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]*");
    return new RegExp(`^${escaped}`).test(file);
  }
  // Pola diakhiri "/" berarti direktori; selain itu prefix path biasa.
  return file === pattern || file.startsWith(pattern);
}

/**
 * Circuit breaker. Dijalankan setelah diff jadi, sebelum PR dibuka.
 * Melebihi batas berarti berhenti dan escalate — bukan dikecilkan otomatis.
 */
export function checkGuardrails(
  diff: DiffSummary,
  config: Config,
): GuardrailVerdict {
  const violations: string[] = [];
  const { limits } = config;

  if (diff.filesChanged > limits.maxFilesChanged) {
    violations.push(
      `file diubah ${diff.filesChanged} melebihi batas ${limits.maxFilesChanged}`,
    );
  }

  if (diff.diffLines > limits.maxDiffLines) {
    violations.push(
      `baris diff ${diff.diffLines} melebihi batas ${limits.maxDiffLines}`,
    );
  }

  const blocklistHits = matchBlocklist(
    diff.stats.map((s) => s.file),
    config.blocklist,
  );

  for (const hit of blocklistHits) {
    violations.push(`daftar cegat: ${hit.file} (${hit.reason})`);
  }

  return { ok: violations.length === 0, violations, blocklistHits };
}

/**
 * Klasifikasi jalur gerbang.
 *
 * Dijalankan dari DIFF, bukan dari tiket — sebelum agent kerja kita cuma bisa
 * menebak file apa yang kesentuh; setelah diff jadi, kita tahu.
 *
 * Jalur 3 = senior review wajib. Jalur 2 = review cepat (default).
 * Jalur 1 = tanpa review sebelum merge, dan sengaja mati sampai ada data
 * yang membuktikan area itu layak.
 */
export function classifyLane(
  diff: DiffSummary,
  blocklistHits: BlocklistHit[],
  rspec: RspecResult | null,
  config: Config,
): Lane {
  if (blocklistHits.length > 0) return 3;

  const { laneRules } = config;

  if (!laneRules.lane1Enabled) return 2;

  const testsGreen =
    rspec !== null &&
    rspec.ran &&
    !rspec.timedOut &&
    rspec.exitCode === 0 &&
    (rspec.failureCount === null || rspec.failureCount === 0);

  if (!testsGreen) return 2;

  if (diff.diffLines > laneRules.lane1MaxDiffLines) return 2;

  if (laneRules.lane1RequiresNewTests && diff.addedTestFiles.length === 0) {
    return 2;
  }

  const allCovered = diff.stats.every((stat) =>
    stat.file.startsWith("spec/") ||
    laneRules.coveredPathPrefixes.some((prefix) => stat.file.startsWith(prefix)),
  );

  return allCovered ? 1 : 2;
}

export function laneLabel(lane: Lane | null): string {
  switch (lane) {
    case 1:
      return "Jalur 1 — tanpa review sebelum merge";
    case 2:
      return "Jalur 2 — review cepat";
    case 3:
      return "Jalur 3 — senior review wajib";
    default:
      return "belum diklasifikasi";
  }
}
