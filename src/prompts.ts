import type { Config, TicketInput } from "./types.js";

function blocklistSummary(config: Config): string {
  // Ringkas jadi daftar direktori/file unik supaya prompt tidak membengkak.
  const patterns = config.blocklist.map((b) => b.pattern);
  return patterns.map((p) => `  - ${p}`).join("\n");
}

const REPO_CONTEXT = `Repo ini aplikasi Ruby on Rails milik Runchise (software operasional restoran).
Ruby 3.0.1, Rails 6.1. Test pakai RSpec, data test pakai FactoryBot (lihat spec/factories/).
Struktur utama: app/domains/ berisi 83 domain bisnis; app/models, app/controllers,
app/queries, app/helpers juga dipakai. Spec ada di spec/ dengan pola
spec/helpers, spec/models, spec/requests, spec/domains.`;

export function buildPlanPrompt(ticket: TicketInput, config: Config): string {
  return `${REPO_CONTEXT}

TAHAP INI: HANYA MEMBACA. Kamu tidak punya izin mengubah file apa pun.
Tugasmu cuma menyusun rencana. Jangan mencoba menulis atau mengedit.

TIKET ${ticket.key}
Judul: ${ticket.summary}

Deskripsi:
${ticket.description}

BATAS YANG BERLAKU
- Maksimal ${String(config.limits.maxFilesChanged)} file boleh diubah.
- Maksimal ${String(config.limits.maxDiffLines)} baris perubahan.
- Path berikut TIDAK BOLEH disentuh sama sekali:
${blocklistSummary(config)}

Kalau tiket ini tidak mungkin dikerjakan tanpa menyentuh path terlarang, atau
tidak mungkin di dalam batas di atas, tulis "OUT_OF_SCOPE" di bagian Verdict dan
jelaskan alasannya. Jangan memaksa.

Kalau deskripsi tiket tidak menyebut hasil yang diharapkan dengan jelas, tulis
"NEEDS_SPEC" di Verdict dan sebutkan persis informasi apa yang kurang. Jangan menebak.

Keluarkan rencana dengan format persis seperti ini:

## Verdict
OK | OUT_OF_SCOPE | NEEDS_SPEC

## Root cause
Di mana masalahnya, dengan path file dan nomor baris kalau ketemu.

## Files to touch
- path/ke/file.rb — alasan

## Characterization tests to write first
Test yang merekam perilaku SEKARANG, termasuk kalau perilakunya salah.
- spec/path/ke/file_spec.rb — perilaku apa yang direkam

## Change
Perubahan kode yang akan dilakukan, singkat.

## Out of scope
Apa yang sengaja TIDAK dikerjakan.

## Risk
Siapa lagi yang memakai kode ini, dan apa yang bisa ikut berubah tanpa sengaja.
`;
}

export function buildImplementPrompt(
  ticket: TicketInput,
  plan: string,
  config: Config,
): string {
  return `${REPO_CONTEXT}

TIKET ${ticket.key}
Judul: ${ticket.summary}

Deskripsi:
${ticket.description}

RENCANA YANG SUDAH DISETUJUI — ikuti ini, jangan melebar:
${plan}

URUTAN KERJA YANG WAJIB DIIKUTI

1. Tulis characterization test DULU, sebelum menyentuh kode produksi.
   Characterization test merekam perilaku yang ADA SEKARANG — termasuk kalau
   perilaku itu salah. Contoh: kalau fungsi sekarang mengubah karakter Mandarin
   menjadi underscore, maka test-nya menegaskan hasil ber-underscore itu.
   Jalankan test tersebut dan pastikan HIJAU sebelum lanjut. Kalau merah,
   berarti pemahamanmu soal perilaku sekarang masih salah — perbaiki dulu.

2. Baru ubah kode produksinya.

3. Jalankan test lagi. Test yang sengaja merekam perilaku salah sekarang harus
   MERAH — itu tandanya perubahanmu kena sasaran. Test lain harus tetap hijau.

4. Perbarui test yang merah itu menjadi perilaku yang benar sesuai tiket.

ATURAN KERAS
- Jangan sentuh path berikut, apa pun alasannya:
${blocklistSummary(config)}
- Maksimal ${String(config.limits.maxFilesChanged)} file, maksimal ${String(config.limits.maxDiffLines)} baris perubahan.
- Jangan commit dan jangan push. Orchestrator yang urus itu.
- Jangan mengubah Gemfile, Gemfile.lock, atau konfigurasi CI.
- Kalau kamu menemukan perilaku aneh yang BUKAN bagian dari tiket ini, JANGAN
  kunci jadi test dan jangan perbaiki. Tulis di bagian CATATAN di akhir jawabanmu.
  Perilaku aneh yang dikunci jadi test akan mengabadikan bug jadi aturan resmi.
- Kalau di tengah jalan ternyata rencananya salah, BERHENTI. Jelaskan kenapa di
  CATATAN. Jangan mengarang solusi lain di luar rencana.

Akhiri jawabanmu dengan:

## CATATAN
Hal yang perlu diketahui reviewer manusia. Tulis "tidak ada" kalau memang tidak ada.
`;
}

/** Ambil nilai Verdict dari keluaran tahap rencana. */
export function parseVerdict(plan: string): "OK" | "OUT_OF_SCOPE" | "NEEDS_SPEC" | "UNKNOWN" {
  const match = /##\s*Verdict\s*\n+\s*(OK|OUT_OF_SCOPE|NEEDS_SPEC)/i.exec(plan);
  if (!match) return "UNKNOWN";
  const value = (match[1] ?? "").toUpperCase();
  if (value === "OK" || value === "OUT_OF_SCOPE" || value === "NEEDS_SPEC") {
    return value;
  }
  return "UNKNOWN";
}

/** Ambil daftar file dari bagian "Files to touch" untuk pemeriksaan scope awal. */
export function parsePlannedFiles(plan: string): string[] {
  const section = /##\s*Files to touch\s*\n([\s\S]*?)(?:\n##\s|$)/i.exec(plan);
  if (!section) return [];

  const files: string[] = [];
  for (const line of (section[1] ?? "").split("\n")) {
    const match = /^\s*[-*]\s*([^\s—-]+)/.exec(line);
    if (match && match[1]) files.push(match[1].trim());
  }
  return files;
}
