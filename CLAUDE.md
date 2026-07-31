# CLAUDE.md — konteks proyek

Baca ini dulu sebelum mengubah apa pun. Ditulis 31 Juli 2026.

---

## Proyek ini apa

Orchestrator ("mandor") yang menjalankan coding agent per tiket Jira di git worktree terpisah, menegakkan guardrail, dan merekam tiap percobaan.

**Yang dibangun di sini bukan AI-nya.** AI-nya Claude Code, sudah terpasang. Yang dibangun adalah lapisan di sekelilingnya: intake tiket, pembatasan scope, gerbang keamanan, pengukuran, dan UI.

Repo target ada di `../runchise` — monolit Rails milik klien. **Jangan pernah commit apa pun ke repo itu dari sini.**

## Konteks engagement

- **Runchise** = klien. Produk software operasional restoran. Repo `RR` = backend Rails (Ruby 3.0.1, Rails 6.1) di Bitbucket. Orang: Daniel, Joshua, Paula.
- **Etalas** = vendor (kita). Pandu, Dharma, Hanif.
- Pilot 3 minggu, mulai 27 Juli 2026. Notes meeting ada di `docs/00-mulai-dari-sini.md`.
- Model: langganan Claude (karena itu **harus** Claude Code — langganan tidak boleh dipakai lewat tool pihak ketiga). Amazon Bedkrock API key menyusul nanti.

## Tesis pilot — jangan dibelokkan tanpa alasan kuat

Tim Runchise **tidak lambat**: 277 tiket selesai dalam 90 hari (±21,5/minggu), median 6 hari, 10 kontributor. Yang mahal di codebase mereka adalah **memahami kode sebelum mengubah, dan memastikan benar setelah mengubah.**

Maka penyempitannya ada di **verifikasi**, bukan produksi kode. Menambah output agent di sisi produksi hanya memperpanjang antrean di gerbang review.

Karena itu urutannya: **agent menulis characterization test dulu, baru mengubah kode.** Coverage adalah alat tukar untuk menebus gerbang manusia. Penjelasan lengkap di `docs/02-desain-pipeline.md`.

## Status sekarang

| Bagian | Status |
|---|---|
| Orchestrator dua tahap (rencana → approve → implementasi) | jalan, typecheck bersih |
| Guardrail + klasifikasi jalur | jalan, 38 selftest lolos |
| Backend API + SSE | jalan, semua endpoint diuji manual |
| UI 5 layar (React + Vite, `web/src/`) | jalan; diverifikasi manual di browser untuk 5 tab + detail run (status `error`); form review & tombol approve/reject belum diuji dengan data nyata — belum ada run yang sampai `awaiting_plan_approval` atau `ready_for_review` |
| Pembukaan PR otomatis | **belum ada** — butuh kredensial Bitbucket |
| Pencatatan biaya/token | **belum ada** — datanya ada di transcript, belum diringkas |
| Intake Jira otomatis | **belum ada** — `queue.json` masih manual, dan itu disengaja untuk pilot |
| Percobaan sungguhan end-to-end | **belum pernah** |

### Blocker nomor satu

`RAILS_MASTER_KEY` belum ada dari Runchise. Tanpa itu rspec tidak bisa jalan, jadi tahap implementasi tidak bisa diselesaikan. Tahap rencana (`--plan-only`) **sudah bisa** dijalankan sekarang tanpa itu.

Blocker lain yang belum terjawab sejak awal: **siapa reviewer di sisi Runchise dan berapa jam per minggu.** Itu plafon throughput sebenarnya.

## Keputusan yang jangan diubah tanpa berpikir

1. **Agent tidak pernah push ke `master`.** Selalu branch, selalu PR. Tanpa pengecualian selama pilot.
2. **Jalur 1 (tanpa review sebelum merge) mati** di `config/pipeline.json`. Salah satu selftest sengaja memaksa ini tetap mati. Asimetrinya: auto-merge menghemat beberapa jam, satu bug lolos di domain GL bisa menutup pilot.
3. **Gerbang ditentukan dari diff, bukan dari tiket.** Sebelum agent kerja kita hanya bisa menebak file apa yang tersentuh; setelah diff ada, kita tahu.
4. **Rencana diperiksa terhadap daftar cegat sebelum satu baris kode disentuh.** Gerbang termurah di seluruh sistem.
5. **Orchestrator (root) nol dependency runtime.** Hanya `typescript` dan `@types/node` sebagai devDependency di root `package.json` — ini yang menyentuh repo klien, jadi argumen "kami tidak memasang apa pun yang aneh di mesin kalian" tetap berlaku persis di situ. Frontend (`web/`) punya `package.json` sendiri dengan React + Vite dan build step (`npm run build` dari root memicu `vite build` di `web/`) — sengaja dipisah supaya siapa pun yang membaca root `package.json` tidak salah kira agent-runner butuh React. Kalau mau menambah dependency ke root, tetap pikir dua kali; `web/` boleh menambah dependency frontend selama alasannya jelas dan tetap di `web/package.json`, bukan root.
6. **`proc.ts` tidak pernah memakai shell.** Teks tiket masuk sebagai argumen utuh, jadi isi deskripsi tiket tidak mungkin dieksekusi sebagai perintah.
7. **Pekerjaan dijalankan serial, satu per satu.** Bukan karena worktree bentrok — itu sudah terpisah — tapi karena rspec berebut satu database test yang sama.
8. **Server hanya mendengarkan di `127.0.0.1`.** UI ini bisa mengubah kode di repo klien.
9. **`runs.jsonl` append-only.** Satu percobaan bisa punya beberapa baris; pembacaan mengambil baris terakhir per `ticket/runId`. Jangan diubah jadi rewrite-in-place.

## Aturan kerja

- Setelah mengubah `config/pipeline.json`, **jalankan `npm run selftest`.** Guardrail yang salah adalah bug paling berbahaya di proyek ini, dan salahnya tidak berisik.
- Setelah mengubah kode, `npm run build` sebelum menjalankan `dist/cli.js`.
- `tsconfig.json` sengaja ketat (`noUncheckedIndexedAccess`, `strict`). Jangan dilonggarkan — setelan ini sudah menangkap bug nyata (label outcome yang kelupaan).
- Jangan menambah test framework. `selftest.ts` cukup dan tanpa dependency.
- Kalau menambah nilai `Outcome` baru, TypeScript akan memaksa melengkapi `OUTCOME_LABEL` di `dashboard.ts` dan sebaiknya juga di `OUTCOME` pada `web/index.html` (yang ini tidak dijaga compiler — mudah terlupa).

## Perintah

```bash
npm install && npm run build
node dist/cli.js doctor      # periksa prasyarat, jalankan ini dulu
npm run selftest             # 38 pemeriksaan guardrail
node dist/cli.js serve       # UI di http://127.0.0.1:4319
node dist/cli.js run --dry-run     # tanpa memanggil agent
node dist/cli.js run --plan-only   # agent dipanggil, kode tidak disentuh
node dist/cli.js run --ticket RR-7338
```

## Struktur

| Lokasi | Isi |
|---|---|
| `src/orchestrator.ts` | Alur satu percobaan. **Baca ini dulu kalau mau paham sistemnya.** |
| `src/guardrails.ts` | Daftar cegat, batas aman, klasifikasi jalur. Bagian paling kritis |
| `src/prompts.ts` | Prompt tahap rencana & implementasi |
| `src/server.ts`, `src/jobs.ts` | API, SSE, antrean serial |
| `src/selftest.ts` | 38 pemeriksaan, tanpa dependency |
| `config/pipeline.json` | Satu-satunya file yang perlu diedit rutin. 41 path daftar cegat |
| `queue.json` | Antrean tiket, manual. Gitignored |
| `web/` | Frontend React + TypeScript + Vite. `npm install` & `npm run build` terpisah dari root |
| `runs/` | Rekaman percobaan. Gitignored |
| `docs/` | Konteks analisis dan keputusan |

## Dokumen

Baca sesuai kebutuhan, jangan semua sekaligus:

| Dokumen | Kapan dibaca |
|---|---|
| `docs/00-mulai-dari-sini.md` | Orientasi. Siapa siapa, angka asli Jira, dan koreksi framing awal |
| `docs/01-audit-codebase.md` | Sebelum menyentuh apa pun soal repo klien. Struktur, coverage per domain, file berbahaya |
| `docs/02-desain-pipeline.md` | Alasan di balik alur dan gerbangnya |
| `docs/03-metrik-dan-baseline.md` | Definisi sukses, baseline nyata, kriteria berhenti |
| `docs/04-primer-test-dan-runtime.md` | Cara baca test di repo Runchise, dan penjelasan characterization test |
| `README.md` | Cara pakai, API, keterbatasan |

## Angka penting (jangan dikarang ulang)

Dari Jira dan repo, ditarik 29–31 Juli 2026:

- 300 tiket To Do terbaru diskor: Tier A 18, B 64, C 126, D 92
- Hanya **16 tiket** sekaligus agent-ready **dan** berumur <120 hari. Tiga di antaranya domain akuntansi → jalur cepat tinggal 13
- Tiket yang dibuat 30 hari terakhir: **4%** agent-ready (1 dari 27). Tiket masuk dalam kondisi mentah
- Throughput tim: 277 selesai / 90 hari. Dibuat: 324 / 90 hari
- Median waktu tempuh 6 hari; p90 134 hari; rekor 670 hari
- Metadata: 1 tiket punya label, **0** punya component, **0** punya priority selain Medium
- Codebase: 4.446 file `.rb` di `app/`, 1.658 file spec. `app/domains/` = 72% kode, 83 domain
- Domain `restaurant` = 1.156 file (seperempat seluruh kode) — terlalu luas untuk jadi batas scope
- Rasio spec:kode — seluruh app 37%, accounting 30%, restaurant 26%, **report 3%**, **jurnal 3%**
- 25 file di atas 800 baris; terbesar `app/models/concerns/product_logic.rb` (2.648 baris)
- CI ada dan lengkap: `bitbucket-pipelines.yml` menjalankan rspec, rubocop, brakeman

## Koreksi dan jebakan yang sudah ketemu

Hal-hal yang sempat salah dan sudah diperbaiki. Ditulis di sini supaya tidak diulang.

1. **Angka "report 3% tes" menyesatkan kalau dipakai mentah.** Job laporan tesnya ada, tapi duduk di `spec/domains/restaurant/jobs/report/`, bukan di folder `report`. Fungsi laporan lebih tertes daripada rasio folder itu menyarankan.
2. **Jangan menilai kualitas tiket dari backlog To Do saja.** Itu tumpukan yang belum ada yang ambil — sampelnya bias ke kegagalan. Analisis awal terlalu keras karena kesalahan ini.
3. **Daftar cegat isinya 41 path**, bukan 44. Pernah salah hitung.
4. **Tiket bisa berisi kredensial plaintext.** RR-6966 memuat username dan password staging. Kalau tiket seperti itu masuk ke transcript agent, kredensialnya tersimpan permanen di `runs/`. Redact saat memasukkan ke `queue.json`, dan angkat ke Runchise.
5. **Judul tiket bisa tidak nyambung dengan isinya.** RR-7035 judulnya soal "scheduled menu", langkah reproduksinya soal Bulk Action → Change Sell Price. Tahap rencana seharusnya mengembalikan `NEEDS_SPEC`, bukan menebak. Tiket ini sengaja ditinggal di `queue.json` sebagai uji coba.
6. **Path relatif di config di-resolve dari root project** (direktori berisi `package.json`), bukan dari folder `config/`. Pernah salah dan membuat `../runchise` nyasar.
7. **Endpoint `/api/` yang tidak dikenal harus menjawab JSON**, bukan jatuh ke fallback HTML — kalau tidak, salah ketik URL terlihat seperti berhasil.

## Yang paling gampang salah dikerjakan

- **Melebarkan scope.** Area pilot sengaja dipilih yang paling mudah: lapisan export dan format output (fungsi murni, tidak menghitung uang, tesnya cepat). Hasil di sana **tidak bisa** ditarik lurus ke `accounting` atau ke domain `restaurant`. Katakan ini ke klien sebelum mereka menyimpulkannya sendiri.
- **Mengisi tiga field review.** `humanEditedLines`, `reviewRounds`, `merged` hanya bisa diisi manusia. Tanpa itu autonomy rate — metrik utama pilot — selamanya kosong. Itu justifikasi utama UI-nya ada.
- **Menulis banyak test yang lambat atau flaky.** Itu menyempitkan gerbang, bukan melebarkannya. Ukuran suksesnya bukan jumlah test, tapi test yang lolos konsisten dan cepat.
- **Mengunci perilaku aneh jadi test.** Kalau agent menemukan perilaku ganjil yang bukan bagian tiket, itu naik ke manusia — jangan diabadikan jadi aturan resmi.
