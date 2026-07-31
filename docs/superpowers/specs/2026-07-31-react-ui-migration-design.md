# Migrasi UI ke React + TypeScript (Vite) — Design

Ditulis 31 Juli 2026.

## Konteks & motivasi

`web/index.html` sekarang satu file 569 baris: state global (`S`, `tab`, `openRun`, `sel`), render lewat string `innerHTML` manual (rawan lupa `esc()` → XSS), event binding lewat fungsi global (`window.xxx`) yang di-attach ke `onclick` di string HTML, dan drag-drop yang di-rewire manual tiap kali `render()` dipanggil. Ini jalan, tapi setiap fitur baru menambah lebih banyak state global dan lebih banyak string concatenation.

Goal migrasi ini: **codebase UI yang rapi, per-modul**, bukan didorong oleh satu fitur spesifik. Fitur baru (panel biaya/token, editor rencana, dll.) ditunda — dibangun di atas fondasi baru setelah migrasi ini selesai, bukan bagian dari lingkup ini.

## Keputusan yang diubah dari CLAUDE.md

CLAUDE.md keputusan #5 saat ini: *"Nol dependency runtime. Hanya `typescript` dan `@types/node` sebagai devDependency... Frontend sengaja satu file HTML tanpa build step."*

Ini diubah secara sadar (bukan default drift) menjadi: **orchestrator (root) tetap nol dependency runtime**, tapi **frontend (`web/`) sekarang punya build step dan dependency React+Vite**, sengaja dipisah ke `package.json` sendiri supaya batasnya tetap jelas. Argumen "kami tidak memasang apa pun aneh di mesin kalian" tetap valid untuk bagian yang menyentuh repo klien (orchestrator); tidak lagi berlaku untuk lapisan UI murni.

## Pendekatan yang dipertimbangkan (dan ditolak)

- **Preact + htm via CDN/vendor lokal, tanpa build step** — sempat jadi rekomendasi awal karena tidak melanggar keputusan #5 sama sekali. Ditolak setelah user secara eksplisit memilih React+TypeScript penuh, sadar konsekuensi build step.
- **Refactor vanilla JS saja (tanpa framework)** — nol risiko terhadap keputusan proyek, tapi tidak menjawab keinginan eksplisit user untuk pakai React.
- **JSDoc + `@ts-check`** (type-safety tanpa compile step) — ditolak karena user memilih TypeScript native (`.tsx`), yang mengharuskan build step apa pun pilihannya.
- **Monorepo dengan npm workspaces** — dipertimbangkan (native npm, zero dependency baru), tapi user memilih dua folder independen sepenuhnya: `web/` punya `npm install` sendiri, tidak ada workspace linking ke root.

## Stack

- React + TypeScript + Vite, di folder `web/` dengan `package.json` dan `tsconfig.json` sendiri — terpisah total dari root (dua `npm install` berbeda, tanpa workspace linking).
- Dependency baru (hanya di `web/package.json`): `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`.
- Tanpa state-management library tambahan (Redux/Zustand/dll.) — `useState`/`useEffect` bawaan React cukup untuk skala app ini.
- Root `package.json` (orchestrator) tidak berubah dependency-nya — tetap hanya `typescript` + `@types/node`.

## Struktur file

```
web/
  index.html                 — entry Vite: <div id="root"> + <script type=module src=/src/main.tsx>
  vite.config.ts              — proxy /api dan /api/events ke backend saat dev
  package.json                 — react, react-dom, vite, dll. (terpisah dari root)
  tsconfig.json                 — strict, konsisten dengan root (noUncheckedIndexedAccess dll.)
  src/
    main.tsx                    — mount App ke #root
    api.ts                       — wrapper fetch, port 1:1 dari api() lama
    types.ts                      — tipe Ticket/Run/Job/Config, cermin src/types.ts backend
    state.ts                       — hook useAppState(): load tickets/runs/jobs/config, buka EventSource sekali, refetch saat event job/run
    App.tsx                        — shell: Nav + tab state (useState) + outlet komponen aktif
    components/
      Nav.tsx
      Board.tsx                  — papan 5 kolom
      Queue.tsx                  — antrean + drag-drop reorder
      Review.tsx
      Metrics.tsx
      Settings.tsx
      RunDetail.tsx               — detail percobaan + form review
      Diff.tsx                     — render diff (dipisah karena logikanya spesifik)
    styles.css                     — CSS dipindah dari <style> inline, isi sama — tidak redesign visual
  dist/                            — hasil `vite build`, gitignored, jadi webRoot backend
```

Tab aktif (`tab`), run yang terbuka (`openRun`), dan seleksi checkbox (`sel`) jadi `useState` di `App.tsx`, diturunkan sebagai props ke komponen anak — tidak perlu React Context untuk app sekecil ini.

## Build & dev workflow

Backend (`src/server.ts`) **tidak berubah** — sudah generik serve static folder lewat opsi `webRoot` (path-traversal guarded, MIME map sudah cover `.js`/`.css`). Yang berubah cuma nilai default di `src/cli.ts:183`: `resolve("web")` → `resolve("web/dist")`.

Root `package.json` scripts diperluas:
```json
"build": "tsc -p tsconfig.json && npm --prefix web run build",
"dev:web": "npm --prefix web run dev"
```

`web/package.json` scripts:
```json
"dev": "vite",
"build": "vite build",
"typecheck": "tsc --noEmit"
```

**Pemakaian normal** (bukan development UI): `npm run build` sekali (build orchestrator + `vite build` frontend ke `web/dist`), lalu `node dist/cli.js serve` seperti biasa — satu port, satu URL, tidak ada perubahan cara pakai untuk end user.

**Dev loop UI dengan hot reload**: dua terminal — `node dist/cli.js serve` (backend+API di port 4319) dan `npm run dev:web` (Vite dev server, mis. port 5173, dengan `vite.config.ts` men-proxy `/api` dan `/api/events` ke `127.0.0.1:4319`).

## Data flow

`src/api.ts` port 1:1 dari fungsi `api()` lama di `web/index.html` (fetch wrapper, parse JSON, throw kalau `!res.ok`). `src/state.ts` — custom hook `useAppState()` menggantikan variabel global `S`: `useState` untuk `tickets`/`runs`/`jobs`/`metrics`, `useEffect` membuka `EventSource("/api/events")` sekali di mount, refetch saat event `job` atau `run` masuk — logika sama persis dengan `listen()` lama, dibungkus lifecycle React (`useEffect` cleanup menutup `EventSource` saat unmount).

## Lingkup migrasi

Rewrite penuh dalam satu langkah (bukan screen-by-screen) — state model dipakai lintas semua 5 layar, migrasi parsial berarti dua pola hidup berdampingan sementara. Semua logika bisnis yang sudah ada dipindah apa adanya (grouping tiket ke kolom papan, drag-drop reorder antrean, filter `reviewItems()`, dll.), bukan ditulis ulang dari nol. Visual/CSS tidak didesain ulang — migrasi ini murni perubahan struktur kode dan state management, bukan perubahan tampilan.

**Tidak termasuk lingkup ini**: fitur baru apa pun (panel biaya/token, editor rencana interaktif, dll.) — itu dibangun setelah fondasi ini selesai.

**Bahasa UI copy**: semua string yang ditulis ulang di komponen baru (label tab, tombol, hint, pesan) ditulis dalam **bahasa Inggris**, bukan port 1:1 dari teks Indonesia yang ada sekarang. Ini bagian dari inisiatif terpisah untuk menerjemahkan seluruh proyek ke bahasa Inggris (docs/CLAUDE.md/komentar kode) — UI copy digabung ke migrasi ini karena komponennya ditulis ulang dari nol; sisanya (docs, CLAUDE.md, komentar `src/*.ts`) jadi plan terpisah karena tidak bergantung pada migrasi ini.

## Langkah migrasi

1. Scaffold `web/` sebagai proyek Vite+React+TS baru; `web/dist` masuk root `.gitignore`
2. Port CSS apa adanya ke `web/src/styles.css`
3. Port tiap fungsi `render*()` di `web/index.html` lama jadi komponen sepadan di `components/`
4. `App.tsx` gantikan `render()` + `go()` sebagai router tab manual
5. Hapus `web/index.html` versi lama, ganti entry Vite baru
6. `src/cli.ts:183` webRoot → `web/dist`
7. Verifikasi manual di browser tiap 5 layar: golden path tiap tab + edge case (papan kosong, job sedang jalan, drag reorder, submit form review) — ini juga menutup item "UI belum pernah diverifikasi tampilannya di browser" di status CLAUDE.md

## Update dokumentasi (bagian dari lingkup ini)

- **CLAUDE.md keputusan #5**: diubah untuk mencerminkan pemisahan orchestrator (nol dependency) vs frontend (React+Vite, build step) — lihat bagian "Keputusan yang diubah" di atas.
- **CLAUDE.md tabel status**: baris "UI 5 layar... belum pernah diverifikasi tampilannya di browser" diupdate setelah langkah 7 selesai.
- **CLAUDE.md tabel Struktur**: tambah baris untuk `web/src/`.

## Di luar lingkup

- Tidak ada perubahan pada `src/guardrails.ts`, `config/pipeline.json`, atau alur backend lain (`orchestrator.ts`, `jobs.ts`, endpoint API) — ini murni migrasi lapisan presentasi, kontrak `/api/*` tetap sama persis.
- Tidak ada fitur UI baru.
- Tidak ada test framework baru untuk frontend — verifikasi lewat pengecekan manual di browser (langkah 7), konsisten dengan aturan "jangan menambah test framework" di CLAUDE.md (yang secara eksplisit soal `selftest.ts`, tapi semangatnya sama: jangan menambah beban tanpa nilai jelas untuk app internal sekecil ini).
