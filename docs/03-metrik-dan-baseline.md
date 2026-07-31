# Runchise AI Dev Pipeline — Definisi Sukses & Baseline

**Status:** draft internal Etalas · 30 Juli 2026
**Kriteria dari klien:** *"speed up development"*
**Tujuan dokumen:** menerjemahkan itu jadi angka yang bisa diukur sebelum Week 2, dan mengunci apa yang dianggap berhasil / gagal.

---

## 1. Masalah dengan "speed up development"

Kalimat itu tidak bisa dievaluasi. Akhir Week 3 dua pihak bisa sama-sama merasa benar dan tetap tidak sepakat.

Lebih spesifik: "cepat" bisa berarti tiga hal berbeda yang trade-off-nya saling tabrakan — tiket per minggu naik, waktu tempuh per tiket turun, atau jam engineer yang kepakai berkurang. Pipeline agent bisa memperbaiki satu dan memperburuk yang lain. Contoh paling nyata: agent menghasilkan 10 PR seminggu, tapi review-nya makan 8 jam senior. Throughput naik, waktu engineer justru habis. Itu kemunduran yang terlihat seperti kemajuan.

Jadi harus ada satu metrik utama, beberapa pendamping, dan **satu metrik pengaman yang tidak boleh memburuk**.

---

## 2. Kendala ukuran sampel — baca ini sebelum bikin target

Total tiket yang bisa dikerjakan selama pilot ±18 (16 kandidat Tier A/B yang masih hidup + 1–2 dari inflow baru). Dari 16 itu, 3 masuk domain akuntansi yang wajib jalur senior review — jadi jalur cepatnya 13.

Angka inflow-nya perlu dicatat khusus: tiket yang dibuat dalam 30 hari terakhir hanya **4%** yang agent-ready (1 dari 27). Tiket masuk dalam kondisi mentah. Jadi jangan modelkan pilot ini seolah ada pasokan tiket baru yang siap dikerjakan — tidak ada, sampai gerbang DoR jalan.

Dengan n≈18, **klaim statistik tidak mungkin dibuat.** Perbaikan cycle time 30% dari 8 tiket bukan bukti, itu kebetulan. Ini harus dinyatakan terbuka ke Runchise sejak awal, bukan disembunyikan lalu ketahuan di Week 3.

Yang bisa dibuktikan dalam 3 minggu:

- Loop-nya jalan end-to-end tanpa merusak apa pun
- Berapa besar effort manusia yang tersisa per tiket
- Bagian mana yang jadi penghambat nyata
- Apakah ada indikasi terarah bahwa ini layak diperluas

Yang tidak bisa dibuktikan: angka penghematan yang bisa dipakai untuk proyeksi bujet tahunan.

---

## 3. Metrik

### M1 — Autonomy rate (metrik utama)

**Definisi:** persentase PR agent yang di-merge tanpa manusia mengubah kode sama sekali. Perubahan yang dihitung hanya edit pada kode; komentar review yang tidak berujung edit tidak dihitung.

**Kenapa ini yang utama:** ini satu-satunya metrik yang mengukur apakah pipeline-nya beneran menggeser kerjaan dari manusia ke agent. Cycle time bisa turun sementara karena efek Hawthorne — semua orang lebih rajin karena sedang diamati. Autonomy rate tidak bisa dipalsukan begitu.

**Cara ukur:** diff antara commit terakhir agent dan commit merge, per PR. Bisa diambil dari Bitbucket.

**Baseline:** tidak ada. Ini metrik baru, mulai dari nol.

**Target Week 3:** ≥40% dari PR yang merged. Tren naik antar-minggu lebih penting daripada angka absolutnya.

### M2 — Attempt success rate

**Definisi:** persentase attempt agent yang menghasilkan PR layak review (CI hijau, rencana disetujui, tidak kena circuit breaker).

**Kenapa penting:** membedakan "agent-nya gagal" dari "tiketnya jelek". Kalau success rate rendah tapi terkonsentrasi di tiket Tier B, masalahnya spec. Kalau merata di Tier A juga, masalahnya di pipeline atau codebase.

**Target Week 3:** ≥60% dari attempt.

### M3 — Cycle time: Ready → Merged

**Definisi:** median waktu dari tiket masuk status Ready sampai PR merged.

**Baseline — sudah ditarik dari Jira (31 Juli 2026):**

| Ukuran | Angka |
|---|---|
| Median waktu tempuh created → resolved | **6,0 hari** |
| Persentil 25 | 1,1 hari |
| Persentil 75 | 37,9 hari |
| Persentil 90 | 134,3 hari |
| Selesai ≤1 hari | 25% |
| Selesai ≤7 hari | 56% |
| Throughput tim | 277 tiket / 90 hari (±21,5 per minggu) |
| Tiket dibuat | 324 tiket / 90 hari (±25 per minggu) |

Median dihitung dari 100 tiket yang terakhir selesai, dari populasi 277. Throughput dan jumlah dibuat adalah hitungan penuh.

**Implikasi besar dari angka ini:** distribusinya terbelah dua. Ada kelompok cepat (25% selesai di hari yang sama) dan ekor panjang yang membusuk (10% teratas di atas 134 hari, rekor 670 hari). Artinya target agent yang paling masuk akal bukan mempercepat tiket yang sudah 6 hari — tapi menyentuh ekor panjangnya, atau mengambil alih tiket mekanis supaya engineer bebas mengerjakan yang berat.

**Keterbatasan yang harus dicatat:** Jira hanya menyimpan timestamp transisi status, bukan jam kerja sebenarnya. Tiket yang nganggur di In Progress selama akhir pekan terhitung sama dengan tiket yang dikerjakan intens. Jadi baseline ini adalah **waktu tempuh**, bukan **effort**. Jangan dipakai untuk klaim penghematan jam.

**Target Week 3:** dilaporkan sebagai indikasi terarah, tanpa klaim signifikansi. n terlalu kecil.

### M4 — Review load per merged PR (metrik pengaman)

**Definisi:** menit review manusia per PR yang di-merge, dari self-report reviewer.

**Kenapa ini pengaman:** ini titik di mana pipeline bisa jadi net-negatif. Kalau review satu PR agent makan waktu lebih lama daripada seorang dev mengerjakan tiketnya sendiri, pipeline-nya merugikan meski semua metrik lain kelihatan bagus.

**Target Week 3:** ≤45 menit per merged PR, dan tidak naik antar-minggu.

### M5 — Intake health

**Definisi:** persentase tiket baru yang lolos gerbang DoR pada submit pertama.

**Kenapa dilacak:** ini metrik yang paling menentukan nilai jangka panjang. Kalau angka ini naik, Runchise punya perbaikan permanen yang tetap berguna meski pipeline agent-nya dihentikan. Ini bagian yang tidak bisa hilang.

**Baseline:** dari pool 300 tiket — 19,7% deskripsi kosong, 13,3% di bawah 150 karakter, 27,7% spec cuma screenshot. Ukuran paling tajam: dari tiket yang dibuat 30 hari terakhir, hanya **4%** (1 dari 27) yang agent-ready. Itu baseline yang sebenarnya.

**Target Week 3:** ≥50% tiket baru lolos submit pertama. Naik dari 4% ke 50% terdengar ekstrem, tapi ini bukan perbaikan kualitas kerja orang — ini efek dari adanya field wajib yang sebelumnya tidak ada.

### Pengaman tambahan — escaped defects

Jumlah bug yang lolos ke production dari PR agent. Target: 0 di domain `risk:high`. Satu insiden di domain uang lebih merusak kepercayaan daripada nilai seluruh pilot.

---

## 4. Yang harus dikerjakan minggu ini agar bisa diukur

| # | Item | Kenapa mendesak |
|---|---|---|
| 1 | Tarik baseline cycle time dari histori Jira | Tanpa ini M3 tidak punya pembanding, dan tidak bisa ditarik surut setelah pilot mulai |
| 2 | Aktifkan attempt log sejak attempt pertama | Attempt yang tidak tercatat hilang permanen. Ini satu-satunya sumber angka laporan Week 3 |
| 3 | Sepakati kesepakatan self-report reviewer | M4 bergantung pada reviewer mencatat waktunya. Kalau tidak disepakati sekarang, datanya tidak akan ada |
| 4 | Cek 4 crash bug skor tertinggi di Sentry | Menentukan apakah kandidat terbaik masih hidup, tanpa perlu rapat PO |

---

## 5. Kriteria berhenti (harus disepakati sebelum Week 2)

Kriteria gagal yang ditulis di awal jauh lebih kredibel daripada yang dirumuskan setelah hasilnya jelek. Ini juga yang membuat rekomendasi Week 3 bisa dipercaya.

Rekomendasikan **jangan diperluas** kalau salah satu terjadi:

- Autonomy rate di bawah 25% pada akhir Week 3, tanpa tren naik
- Review load per merged PR melebihi estimasi waktu dev manual untuk tiket setara
- Ada escaped defect di domain `risk:high`
- Attempt success rate di bawah 40% pada tiket Tier A

Rekomendasikan **perluas dengan syarat** kalau autonomy rate naik antar-minggu tapi review load masih tinggi — artinya loop-nya benar, gerbangnya yang perlu disetel.

---

## 6. Bentuk laporan Week 3

Satu halaman, tiga bagian:

1. **Apa yang jalan.** Jumlah attempt, PR merged, autonomy rate per minggu, tiket mana saja.
2. **Di mana penghambatnya.** Distribusi waktu per stage. Dugaan awal: penghambatnya kapasitas reviewer dan kualitas spec, bukan kecepatan agent. Kalau dugaan ini terbukti, itu temuan paling berharga dari pilot.
3. **Apa yang dibutuhkan untuk skala.** Perubahan proses konkret di sisi Runchise, dengan angka pendukung dari pilot.

Bagian 2 yang paling bernilai buat mereka. Bagian 1 yang paling mereka tunggu.

---

*Baseline dan angka pool berasal dari spreadsheet triage 300 tiket (Jira RR, pull 29 Juli 2026). Target di dokumen ini adalah usul Etalas, belum disepakati Runchise.*
