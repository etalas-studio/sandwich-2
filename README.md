# runchise-agent-pipeline

Orchestrator untuk AI dev pipeline Runchise. Menjalankan coding agent per tiket di git worktree terpisah, menegakkan guardrail, dan merekam tiap percobaan supaya pilot menghasilkan angka — bukan cuma kesan.

Sengaja ditaruh di luar repo `runchise` supaya repo klien tidak kena file yang bukan milik mereka.

**Status:** kerangka jalan, sudah lolos typecheck dan 38 self-test. Belum pernah dijalankan dengan agent sungguhan karena `RAILS_MASTER_KEY` belum ada.

---

## Kenapa bentuknya begini

Tiga keputusan yang perlu dipahami sebelum baca kode:

**1. Dua tahap, bukan satu.** Tahap pertama agent cuma boleh membaca (`Read,Grep,Glob`) dan hasilnya rencana. Tahap kedua baru dapat izin menulis. Alasannya: membaca rencana 2 menit jauh lebih murah daripada mereview diff salah arah 400 baris. Rencana juga diperiksa terhadap daftar cegat **sebelum** satu baris kode disentuh.

**2. Gerbang ditentukan dari diff, bukan dari tiket.** Sebelum agent kerja kita cuma bisa menebak file apa yang kesentuh. Setelah diff jadi, kita tahu. Jadi klasifikasi Jalur 1/2/3 dijalankan setelah diff ada.

**3. Rekaman berupa file biasa, bukan database.** Selama pilot jumlahnya puluhan. File bisa di-`grep`, di-`diff`, dan foldernya bisa langsung diserahkan ke klien sebagai bukti.

---

## Prasyarat

| Yang dibutuhkan | Kenapa |
|---|---|
| Node 20+ | Orchestrator |
| Claude Code, sudah `/login` | Engine. Langganan Claude hanya boleh dipakai lewat Claude Code |
| Ruby 3.0.1 + `bundle install` | Menjalankan rspec |
| `docker compose up` di repo runchise | Postgres, Redis, Elasticsearch, ClickHouse untuk rspec |
| `RAILS_MASTER_KEY` | **Blocker.** Tanpa ini test suite tidak bisa jalan. Minta ke Runchise |

Mesinnya harus **persisten** — bukan container CI sekali pakai — karena login langganan Claude bersifat interaktif dan akan hilang tiap kali container dibuang.

---

## Melihat UI-nya

Dua perintah:

```bash
npm install && npm run build     # sekali saja
node dist/cli.js serve           # lalu buka http://127.0.0.1:4319
```

UI-nya aplikasi React + TypeScript + Vite di `web/` — `package.json` sendiri, terpisah dari root (lihat CLAUDE.md keputusan #5: root tetap nol dependency runtime, dependency React/Vite hanya ada di `web/package.json`). `npm install` di root sekarang juga menjalankan `npm install` di `web/` lewat `postinstall`, dan `npm run build` di root menjalankan `tsc` untuk orchestrator lalu `vite build` di `web/`, menghasilkan `web/dist/` — itu yang diserve `node dist/cli.js serve`.

Kalau lagi ngoprek frontend, edit source-nya butuh build ulang (`npm run build`) supaya `web/dist/` ikut berubah — atau pakai `npm run dev:web` dari root untuk mode hot-reload Vite (port 5173, proxy `/api` ke backend di `127.0.0.1:4319`) selama development aktif.

Lima layar: **Board** (kanban), **Queue** (list, tarik baris untuk mengubah prioritas), **Review** (yang menunggu kamu), **Metrics**, **Settings** (batas aman dan daftar cegat, read-only).

Progress muncul otomatis lewat SSE — tidak perlu refresh saat percobaan sedang jalan.

### Demo tanpa `RAILS_MASTER_KEY`

`queue.json` sudah berisi **10 tiket asli** dari Jira project RR. Setiap percobaan memakai kuota model, jadi tab Queue pakai **checkbox** — hanya yang dicentang yang jalan. Tidak ada tombol "jalankan semua", itu memang dibuang.

1. `node dist/cli.js serve`, buka `http://127.0.0.1:4319`
2. Tab **Queue** — centang 1–2 tiket, klik **Run N selected**. Ada konfirmasi berisi daftar tiketnya sebelum jalan
3. Progress muncul sendiri lewat SSE. Kartu pindah ke kolom **Waiting on you** di tab Board
4. Buka kartunya — di situ rencana asli dari Claude Code: file mana yang akan disentuh, test apa yang akan ditulis, dan risikonya
5. **Reject plan** aman dicoba — worktree dibuang, repo klien tidak tersentuh

Yang belum bisa: **Approve** melanjutkan ke tahap ngoding, dan itu menjalankan rspec — butuh `RAILS_MASTER_KEY` dan docker. Sampai itu ada, berhenti di langkah 4.

### Tiket mana yang dipakai untuk demo apa

Sepuluh tiket itu dipilih supaya bisa menunjukkan perilaku yang berbeda-beda:

| Tiket | Yang ditunjukkan |
|---|---|
| RR-7338 | Kandidat terbaik. Bug ada di satu baris `app/helpers/file_helper.rb`, tapi fungsi itu dipakai 19 kali termasuk di controller GL — jadi terlihat sepele padahal jangkauannya luas |
| RR-6966, RR-6424, RR-6739 | Lapisan export/format. Fungsi murni, tidak menghitung uang, tesnya cepat |
| RR-7020, RR-7110, RR-7161 | Aturan validasi. Sempit dan mudah dites |
| RR-7201 | Bug fungsional biasa, spec-nya jelas |
| RR-7035 | **Sengaja cacat.** Judulnya soal "scheduled menu", langkah reproduksinya soal Bulk Action → Change Sell Price. Tahap rencana seharusnya mengembalikan `NEEDS_SPEC`, bukan menebak |
| RR-7143 | **Sengaja dilarang.** Domain accounting. Harus dicegat di gerbang rencana sebelum satu baris kode disentuh |

Dua yang terakhir itu momen demo paling meyakinkan: bukan "agent bisa ngoding", tapi **"agent tahu kapan harus berhenti dan bertanya."**

---

## Mulai dari terminal

```bash
npm install
npm run build

# 1. Periksa prasyarat dulu. Ini akan bilang persis apa yang belum siap.
node dist/cli.js doctor

# 2. Pastikan logika guardrail benar. Jalankan ulang tiap kali config diubah.
npm run selftest

# 3. Siapkan antrean tiket
cp queue.example.json queue.json

# 4. Coba tanpa memanggil agent — memeriksa config, antrean, dan penulisan rekaman
node dist/cli.js run --dry-run

# 5. Coba tahap rencana saja — agent dipanggil, kode tidak disentuh
node dist/cli.js run --plan-only

# 6. Jalan penuh
node dist/cli.js run --ticket RR-7338
```

Selalu jalankan `doctor` dan `selftest` sebelum percobaan pertama hari itu.

---

## Perintah

| Perintah | Fungsi |
|---|---|
| `doctor` | Periksa prasyarat: config, repo, git bersih, agent, bundler, master key |
| `run` | Jalankan antrean tiket dari terminal |
| `serve` | Jalankan UI di `http://127.0.0.1:4319` |
| `dashboard` | Bangkitkan ulang `runs/index.html` dari `runs.jsonl` |

Opsi: `--config <path>` · `--queue <path>` · `--ticket <KEY>` · `--plan-only` · `--dry-run` · `--cleanup` · `--port <n>`

---

## Dua tahap yang bisa dijeda

Orchestrator dipecah supaya manusia bisa menyelipkan approval di tengah:

| Fungsi | Berhenti di mana |
|---|---|
| `runPlan()` | Bikin worktree, minta rencana, periksa rencana terhadap daftar cegat, lalu **berhenti** dengan status `awaiting_plan_approval`. Worktree dibiarkan hidup |
| `runImplement()` | Melanjutkan worktree dan rencana yang sama, buka izin menulis, ukur diff, jalankan spec, commit |
| `rejectPlan()` | Buang worktree dan branch |
| `runTicket()` | Jalur CLI: rencana lalu langsung implementasi tanpa jeda |

`runs.jsonl` bersifat append-only, jadi satu percobaan bisa punya beberapa baris (rencana → implementasi → hasil review). Pembacaan memakai baris terakhir per `ticket/runId`. Riwayat perubahan status tidak hilang, dan file tidak pernah ditulis ulang — kalau proses mati di tengah, yang sudah tercatat tetap utuh.

---

## API

Server memakai `node:http`, tanpa dependency runtime. Hanya mendengarkan di `127.0.0.1` — UI ini bisa mengubah kode di repo klien, jadi jangan pernah dibuka ke jaringan.

| Endpoint | Fungsi |
|---|---|
| `GET /api/state` | Antrean, semua percobaan, pekerjaan aktif, metrik, ringkasan config |
| `GET /api/config` | Batas aman, aturan jalur, dan daftar cegat lengkap (read-only) |
| `GET /api/runs/:ticket/:runId` | Detail satu percobaan: rencana, diff, keluaran agent, tool call |
| `POST /api/runs` | Mulai tahap rencana untuk satu tiket |
| `POST /api/runs/:t/:r/approve` | Approve rencana, lanjut ke implementasi |
| `POST /api/runs/:t/:r/reject` | Tolak rencana, buang worktree |
| `POST /api/runs/:t/:r/review` | Simpan tiga field manusia |
| `POST /api/queue/reorder` | Ubah urutan antrean = ubah prioritas |
| `GET /api/events` | SSE, progress langsung |

Pekerjaan dijalankan **satu per satu**. Bukan karena worktree bentrok — itu sudah terpisah — tapi karena rspec berebut satu database test yang sama.

---

## Guardrail

Semua ditegakkan orchestrator, bukan diminta baik-baik ke agent. Diatur di `config/pipeline.json`.

| Batas | Default |
|---|---|
| File diubah | 8 |
| Baris diff | 300 |
| Timeout tahap rencana | 10 menit |
| Timeout tahap implementasi | 20 menit |
| Timeout rspec | 30 menit |

**Daftar cegat** — agent menyentuh salah satu ini, percobaan dihentikan dan ditandai Jalur 3:

- `app/domains/accounting/`, `app/domains/jurnal/` — menyentuh angka uang klien, dan rasio tes di `jurnal` cuma 3%
- 25 file di atas 800 baris, termasuk `app/models/concerns/product_logic.rb` (2.648 baris). File sebesar itu punya efek samping yang tidak terlihat di diff
- Semua domain integrasi pihak ketiga — tidak bisa diverifikasi tanpa memanggil API sungguhan
- `db/migrate/` — tidak reversibel dengan aman

**Agent tidak pernah push ke `master`.** Selalu branch, selalu PR.

---

## Jalur gerbang

| Jalur | Arti | Syarat |
|---|---|---|
| 1 | Tanpa review sebelum merge | Area bertes, diff ≤ 50 baris, ada spec baru, CI hijau, tidak kena daftar cegat |
| 2 | Review cepat — **default** | Selain di atas |
| 3 | Senior review wajib | Kena daftar cegat, atau melewati batas aman |

**Jalur 1 mati secara default** (`laneRules.lane1Enabled: false`) dan sebaiknya tetap mati selama pilot 3 minggu. Alasannya asimetri: 20 PR auto-merge menghemat sekitar 5 jam, sedangkan satu bug lolos di domain GL bisa menutup pilot. Buka Jalur 1 kalau datanya sudah ada, bukan karena optimisme.

Naikkan area dari Jalur 2 ke Jalur 1 dengan menambah tes di area itu, lalu masukkan prefix-nya ke `laneRules.coveredPathPrefixes`. **Coverage adalah alat tukar untuk menebus gerbang manusia** — itu inti rencananya.

---

## Rekaman percobaan

```
runs/
  RR-7338/
    2026-08-04T10-22-31-004/
      meta.json                  hasil, durasi, jalur, jumlah file & baris
      plan-prompt.md             prompt tahap rencana, apa adanya
      plan.md                    rencana dari agent
      transcript-plan.jsonl      tiap tool call tahap 1
      transcript-implement.jsonl tiap tool call tahap 2
      agent-output.md            jawaban akhir agent, termasuk CATATAN
      diff.patch                 perubahan kodenya
      files.json                 file mana yang diubah, berapa baris
      tool-calls.json            hitungan tool call per jenis
      rspec.json                 hasil test
  runs.jsonl                     indeks, satu baris per percobaan
  index.html                     dashboard
```

Waktu ada yang aneh: buka `transcript-implement.jsonl`, cari tool call terakhir sebelum melenceng. Di situ kelihatan agent salah baca file apa.

### Kolom yang harus diisi manusia

Tiga field di `meta.json` sengaja `null` dan hanya bisa diisi setelah review:

- `humanEditedLines` — berapa baris kode yang diubah manusia setelah PR dibuka. **Ini metrik utama pilot.** Nol berarti agent-nya benar-benar mengambil alih kerjaan
- `reviewRounds` — berapa ronde review
- `merged` — `true` / `false`

Tanpa ketiga ini, `autonomy rate` di dashboard tidak bisa dihitung dan pilot tidak menghasilkan bukti apa pun.

---

## Ganti engine

`config/pipeline.json` menyimpan command sebagai template dengan placeholder (`{{prompt}}`, `{{allowedTools}}`). Jadi pindah dari Claude Code ke Pi Agent, atau dari langganan ke Amazon Bedrock, cukup ubah config — tidak menyentuh kode.

Catatan lisensi: langganan Claude Pro/Max hanya untuk dipakai lewat produk Anthropic sendiri. Engine lain seperti Pi butuh API key (Anthropic langsung atau Bedrock).

---

## Batasan yang perlu diketahui

Hal-hal yang belum beres, dan sengaja ditulis di sini supaya tidak jadi kejutan:

1. **Belum pernah dijalankan dengan agent sungguhan.** Baru lolos typecheck, self-test, dan dry run. Percobaan sungguhan butuh `RAILS_MASTER_KEY` dan test suite yang hijau di mesin runner.
2. **rspec hanya menjalankan spec yang relevan**, bukan seluruh suite — supaya loop umpan balik agent cepat. Konsekuensinya regresi di tempat lain bisa lolos. CI penuh di Bitbucket Pipelines tetap gerbang terakhir sebelum merge.
3. **Pemetaan file kode ke file spec masih heuristik.** Repo ini tidak konsisten: spec untuk `app/domains/report` sebagian ada di `spec/domains/report`, sebagian di `spec/domains/restaurant`. Kalau tidak ada spec yang cocok, percobaan tetap lanjut tapi ditandai di `notes`.
4. **Belum ada pembukaan PR otomatis.** Branch di-commit tapi belum di-push. Butuh kredensial Bitbucket dari Runchise dulu.
5. **Belum ada pencatatan biaya/token.** Ada di transcript, belum diringkas ke `meta.json`.
6. **Belum ada pengambilan tiket dari Jira otomatis.** Antrean masih file JSON manual — dan itu memang disengaja untuk pilot: makin sedikit bagian yang bergerak, makin gampang mencari sumber masalah.
7. Folder `runs/` mungkin masih berisi satu rekaman dry run sebagai contoh. Aman dihapus.

---

## Struktur kode

| File | Isi |
|---|---|
| `cli.ts` | Entry point, parsing flag, perintah `doctor` |
| `orchestrator.ts` | Alur satu percobaan dari awal sampai akhir |
| `guardrails.ts` | Pencocokan daftar cegat, batas aman, klasifikasi jalur |
| `prompts.ts` | Prompt tahap rencana & implementasi, parsing verdict |
| `agent.ts` | Pemanggilan agent, ekstraksi teks dari stream-json |
| `git.ts` | Worktree, ringkasan diff, commit |
| `rspec.ts` | Penentuan target spec dan eksekusinya |
| `record.ts` | Penulisan folder rekaman dan indeks |
| `dashboard.ts` | Generator HTML statis dan perhitungan metrik |
| `selftest.ts` | 38 pemeriksaan logika guardrail, tanpa dependency |
| `proc.ts` | Wrapper spawn dengan timeout, tanpa shell |

Tanpa dependency runtime. Hanya `typescript` dan `@types/node` sebagai devDependency.

`proc.ts` tidak pernah memakai shell — teks tiket masuk sebagai argumen utuh, jadi isi deskripsi tiket tidak mungkin diinterpretasi sebagai perintah shell.
