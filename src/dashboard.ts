import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readIndex } from "./record.js";
import type { Outcome, RunRecord } from "./types.js";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  plan_failed: "rencana gagal",
  plan_timeout: "rencana timeout",
  plan_out_of_scope: "di luar lingkup",
  awaiting_plan_approval: "menunggu approve",
  plan_rejected: "rencana ditolak",
  implementing: "sedang dikerjakan",
  no_changes: "tidak ada perubahan",
  guardrail_blocked: "kena batas aman",
  tests_failed: "test merah",
  ready_for_review: "siap direview",
  error: "error",
};

interface Metrics {
  total: number;
  readyForReview: number;
  attemptSuccessRate: number | null;
  autonomyRate: number | null;
  autonomyDenominator: number;
  medianDurationSec: number | null;
  byOutcome: Array<[string, number]>;
  byLane: Array<[string, number]>;
}

export function computeMetrics(records: RunRecord[]): Metrics {
  const total = records.length;
  const ready = records.filter((r) => r.outcome === "ready_for_review");

  // Autonomy rate: dari PR yang sudah di-merge, berapa persen yang TIDAK
  // disentuh manusia sama sekali. Ini metrik utama pilot. Hanya dihitung dari
  // percobaan yang sudah diisi hasil review-nya — bukan dari semua percobaan.
  const reviewed = records.filter(
    (r) => r.merged === true && r.humanEditedLines !== null,
  );
  const untouched = reviewed.filter((r) => (r.humanEditedLines ?? 1) === 0);

  const durations = records.map((r) => r.durationSec).sort((a, b) => a - b);

  const outcomeCounts = new Map<string, number>();
  for (const r of records) {
    const label = OUTCOME_LABEL[r.outcome] ?? r.outcome;
    outcomeCounts.set(label, (outcomeCounts.get(label) ?? 0) + 1);
  }

  const laneCounts = new Map<string, number>();
  for (const r of records) {
    const key = r.lane === null ? "belum diklasifikasi" : `Jalur ${String(r.lane)}`;
    laneCounts.set(key, (laneCounts.get(key) ?? 0) + 1);
  }

  return {
    total,
    readyForReview: ready.length,
    attemptSuccessRate: total > 0 ? ready.length / total : null,
    autonomyRate: reviewed.length > 0 ? untouched.length / reviewed.length : null,
    autonomyDenominator: reviewed.length,
    medianDurationSec: median(durations),
    byOutcome: [...outcomeCounts.entries()].sort((a, b) => b[1] - a[1]),
    byLane: [...laneCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return (a + b) / 2;
}

export function generateDashboard(runsRoot: string): string {
  const records = readIndex(runsRoot);
  const metrics = computeMetrics(records);
  const html = renderHtml(records, metrics);
  const outPath = join(runsRoot, "index.html");
  writeFileSync(outPath, html, "utf8");
  return outPath;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(0)}%`;
}

function mins(value: number | null): string {
  return value === null ? "—" : `${(value / 60).toFixed(1)} mnt`;
}

function renderHtml(records: RunRecord[], m: Metrics): string {
  const rows = [...records]
    .reverse()
    .map((r) => {
      const ticket = r.ticketUrl
        ? `<a href="${esc(r.ticketUrl)}">${esc(r.ticket)}</a>`
        : esc(r.ticket);
      const blocked = r.blockedBy.length > 0 ? esc(r.blockedBy.join("; ")) : "";
      const violations = r.violations.length > 0 ? esc(r.violations.join("; ")) : "";
      const note = [blocked, violations].filter((s) => s.length > 0).join(" · ");
      const rspec =
        r.rspec === null || !r.rspec.ran
          ? "—"
          : `${String(r.rspec.exampleCount ?? "?")} ex / ${String(r.rspec.failureCount ?? "?")} gagal`;

      return `<tr>
  <td>${ticket}</td>
  <td class="mono">${esc(r.runId)}</td>
  <td>${r.lane === null ? "—" : String(r.lane)}</td>
  <td>${esc(OUTCOME_LABEL[r.outcome] ?? r.outcome)}</td>
  <td class="num">${String(r.filesChanged)}</td>
  <td class="num">${String(r.diffLines)}</td>
  <td class="num">${String(r.addedTestFiles)}</td>
  <td>${rspec}</td>
  <td class="num">${(r.durationSec / 60).toFixed(1)}</td>
  <td class="num">${r.humanEditedLines === null ? "—" : String(r.humanEditedLines)}</td>
  <td class="note">${note}</td>
</tr>`;
    })
    .join("\n");

  const outcomeList = m.byOutcome
    .map(([label, count]) => `<li>${esc(label)}: <b>${String(count)}</b></li>`)
    .join("");

  const laneList = m.byLane
    .map(([label, count]) => `<li>${esc(label)}: <b>${String(count)}</b></li>`)
    .join("");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Runchise AI Dev Pipeline — Rekaman Percobaan</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         margin: 0; padding: 32px; max-width: 1400px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { opacity: .65; margin: 0 0 24px; font-size: 13px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; }
  .card { border: 1px solid rgba(128,128,128,.35); border-radius: 8px;
          padding: 12px 16px; min-width: 150px; }
  .card .k { font-size: 12px; opacity: .65; }
  .card .v { font-size: 22px; font-weight: 600; margin-top: 2px; }
  .card .h { font-size: 11px; opacity: .55; margin-top: 2px; }
  .split { display: flex; gap: 40px; flex-wrap: wrap; margin-bottom: 28px; }
  .split h2 { font-size: 13px; margin: 0 0 8px; }
  .split ul { margin: 0; padding-left: 18px; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { text-align: left; padding: 7px 10px;
           border-bottom: 1px solid rgba(128,128,128,.25); vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; opacity: .7; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.mono, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
  td.note { font-size: 11px; opacity: .75; max-width: 320px; }
  .empty { padding: 40px 0; opacity: .6; }
  footer { margin-top: 32px; font-size: 11px; opacity: .55; }
</style>
</head>
<body>
<h1>Runchise AI Dev Pipeline — Rekaman Percobaan</h1>
<p class="sub">Dibangkitkan ${esc(new Date().toISOString())} dari runs.jsonl</p>

<div class="cards">
  <div class="card"><div class="k">Percobaan</div><div class="v">${String(m.total)}</div></div>
  <div class="card"><div class="k">Siap direview</div><div class="v">${String(m.readyForReview)}</div></div>
  <div class="card"><div class="k">Attempt success</div><div class="v">${pct(m.attemptSuccessRate)}</div>
    <div class="h">target Week 3: 60%</div></div>
  <div class="card"><div class="k">Autonomy rate</div><div class="v">${pct(m.autonomyRate)}</div>
    <div class="h">dari ${String(m.autonomyDenominator)} PR merged · target 40%</div></div>
  <div class="card"><div class="k">Median durasi</div><div class="v">${mins(m.medianDurationSec)}</div></div>
</div>

<div class="split">
  <div><h2>Hasil akhir</h2><ul>${outcomeList || "<li>belum ada</li>"}</ul></div>
  <div><h2>Jalur gerbang</h2><ul>${laneList || "<li>belum ada</li>"}</ul></div>
</div>

${
  records.length === 0
    ? '<p class="empty">Belum ada percobaan. Jalankan <code>npm run run:queue</code> dulu.</p>'
    : `<table>
<thead><tr>
  <th>Tiket</th><th>Run</th><th>Jalur</th><th>Hasil</th>
  <th>File</th><th>Baris</th><th>Spec baru</th><th>Rspec</th>
  <th>Menit</th><th>Diedit manusia</th><th>Catatan</th>
</tr></thead>
<tbody>
${rows}
</tbody>
</table>`
}

<footer>
Kolom "Diedit manusia" diisi manual setelah review — itu sumber angka autonomy rate,
dan satu-satunya kolom yang tidak bisa diisi otomatis.
</footer>
</body>
</html>
`;
}
