# Runchise AI Dev Pipeline — Mulai Dari Sini

Dokumen orientasi buat tim Etalas. Ditulis 31 Juli 2026.
Tujuannya: biar paham konteksnya dulu sebelum baca dokumen desain yang lebih teknis.

---

## 1. Siapa ngerjain apa

**Runchise** = klien. Produknya software operasional resto/F&B. Dari isi tiketnya, modulnya mencakup POS (kasir), inventory, procurement (pembelian), akuntansi/GL, laporan penjualan, resep, dan delivery. Repo yang kita urus namanya **RR** — backend-nya, pakai Ruby on Rails, disimpan di Bitbucket.

Orangnya: Daniel, Joshua, Paula.

**Etalas** = kita, vendor. Pandu, Dharma, lu.

**Yang diminta:** pilot 3 minggu. Bikin AI agent yang bisa ambil tiket dari Jira, nulis kodenya, terus masuk ke codebase mereka.

**Keluhan yang mereka sampaikan di meeting 27 Juli:** development-nya melambat, codebase-nya besar dan kompleks, banyak techdebt, dan ada bottleneck di testing. Sekarang tim mereka udah pakai Cursor, sebagian pakai Claude Code.

---

## 2. Angka asli dari Jira mereka

Ini gue tarik langsung dari Jira Runchise hari ini, bukan dari spreadsheet.

| Yang diukur | Angka |
|---|---|
| Tiket dibuat dalam 90 hari terakhir | 324 (±25/minggu) |
| Tiket selesai dalam 90 hari terakhir | 277 (±21,5/minggu) |
| Dari 324 tiket baru itu, yang masih nyangkut di To Do | 50 (15%) |
| Waktu tempuh tiket, dari dibuat sampai selesai — **median** | **6 hari** |
| Selesai dalam 1 hari | 25% |
| Selesai dalam 1 minggu | 56% |
| Yang paling lama 10% | di atas 134 hari |
| Rekor terlama | 670 hari |

*Catatan: median dihitung dari 100 tiket yang paling baru selesai, dari total 277. Waktu tempuh ini termasuk waktu nunggu di queue, bukan cuma waktu ngoding.*

---

## 3. Koreksi penting — dokumen gue sebelumnya keliru framingnya

Di dua dokumen sebelumnya gue nulis bahwa backlog mereka "kuburan" dan proses bikin tiketnya rusak. Setelah lihat Jira aslinya, itu **tidak akurat** dan gue perlu benerin.

Kenapa gue salah: spreadsheet triage itu isinya cuma tiket berstatus **To Do**. Tiket yang statusnya To Do adalah — secara definisi — tumpukan hal yang belum ada yang ambil. Jadi gue menilai kualitas kerja tim mereka dari tumpukan sisa.

Analoginya: gue nilai kualitas masakan sebuah restoran dari makanan yang ditinggal di piring. Yang enak udah dimakan, jadi gak masuk sampel gue.

**Gambaran sebenarnya: tim Runchise itu cepat.** 21,5 tiket selesai per minggu, separuhnya kelar dalam seminggu, seperempatnya kelar di hari yang sama. Backlog-nya numpuk pelan — sekitar 3,7 tiket per minggu.

Yang tetap benar dari analisis sebelumnya:

- Ada ekor panjang yang beneran membusuk. 10% tiket teratas butuh lebih dari 134 hari, ada yang 670 hari.
- Metadata Jira-nya memang kosong: dari 300 tiket To Do, cuma 1 punya label, 0 punya component, 0 punya priority selain Medium. Ini nyata dan tetap masalah buat routing otomatis.
- Sebagian tiket memang spec-nya cuma screenshot atau konteksnya cuma di Slack.

---

## 4. Jadi masalah mereka yang sebenarnya di mana

Kalau tim mereka ship 21,5 tiket per minggu, keluhan "development melambat" hampir pasti **bukan** soal tiket-tiket kecil ini. Itu bagian yang udah jalan lancar.

Keluhan mereka yang lain justru lebih nunjuk ke arah lain: codebase besar, techdebt, bottleneck testing. Itu semua soal **kerjaan yang berat** — fitur besar, refactor, hal yang butuh mikir lama dan susah dites.

Jadi hipotesis kerja gue sekarang:

> Nilai agent di sini bukan bikin tiket 6 hari jadi 3 hari. Nilainya adalah **ngambil alih tiket-tiket kecil yang mekanis**, supaya engineer mereka punya ruang buat ngerjain yang berat — yang beneran bikin lambat.

Ini perlu dikonfirmasi ke Daniel/Joshua/Paula, karena mengubah cara kita ngukur sukses. Kalau hipotesisnya benar, metrik yang penting bukan "berapa tiket agent selesaikan", tapi "berapa jam engineer mereka jadi bebas".

---

## 5. Contoh konkret: tiket yang bisa dikerjain agent vs yang gak bisa

Biar kebayang bedanya, ini dua tiket asli dari backlog mereka.

### Contoh bagus — RR-7338

*"Bug: Exported File Name Replaces Mandarin Characters with Underscores"*

Nama file hasil export ganti karakter Mandarin jadi underscore. Tiketnya nulis lengkap:

- **Contoh nyata:** brand `Onboard Fajar 库存变动`
- **Harusnya:** `Onboard_Fajar_库存变动.xlsx`
- **Kenyataannya:** `Onboard_Fajar_____.xlsx`
- **Acceptance criteria:** 5 poin, ditulis eksplisit, termasuk karakter mana yang tetap boleh disanitasi

Kenapa ini enak buat agent: masalahnya sempit (sanitasi nama file), hasil yang diharapkan ditulis jelas, dan gampang dites — kasih nama Mandarin, cek nama file keluarannya. Gak ada yang perlu ditanya ke siapa pun.

### Contoh yang bikin agent nyerah

Tiket yang deskripsinya kosong, atau isinya cuma screenshot tanpa kalimat penjelas, atau nulis *"lanjutan diskusi di Slack"* + link. Dari 300 tiket To Do: 59 deskripsinya kosong, 83 spec-nya cuma screenshot, 42 konteksnya cuma di Slack.

Agent gak bisa baca Slack, dan gak bisa pakai gambar sebagai spesifikasi yang bisa dieksekusi. Bukan karena modelnya kurang pintar — informasinya memang gak ada di tempat yang bisa diakses.

### Peringatan soal spreadsheet triage-nya

Skor tier di spreadsheet itu hasil hitungan otomatis dari kata kunci dan struktur teks, bukan hasil baca manual satu-satu. Jadi ada salah nilai.

Contohnya RR-7348 *"Duplicate GL Book Issues"* — dikasih Tier C (artinya "butuh grooming"). Padahal begitu gue baca isinya, requirement-nya jelas banget: 4 poin eksplisit, plus ada 500 error yang perlu dibenerin. Kenapa skornya jelek? Karena kena penalti otomatis "menyentuh domain GL" (−2).

Jadi jangan perlakukan tier itu sebagai putusan. Itu cuma **urutan buat dibaca manusia**.

---

## 6. Yang masih gelap (dan kenapa ini menghambat)

| Yang belum diketahui | Kenapa penting |
|---|---|
| Akses Bitbucket belum masuk | Kita belum pernah lihat codebase-nya. Semua estimasi masih tebakan |
| Kondisi CI dan test suite | Kalau CI-nya gak ada atau sering merah palsu, agent gak punya cara tau kodenya bener. Ini fondasi seluruh desain |
| Siapa yang review hasil agent, berapa jam per minggu | Ini plafon sebenarnya. Agent bisa bikin 20 PR, tapi kalau cuma ada 1 orang review part-time, ya cuma segitu yang bisa masuk |
| Apakah tiket-tiket kecil ini yang mereka mau dipercepat | Kalau ternyata bukan, arah pilot-nya perlu digeser |

Tiga yang pertama itu jadwalnya Week 1. Hari ini hari ke-4 dari 21.

---

## 7. Kalau lu cuma baca satu bagian, baca ini

1. Tim Runchise **cepat** untuk tiket biasa — median 6 hari, 21,5 tiket/minggu. Jangan datang dengan asumsi mereka lambat.
2. Yang bikin mereka lambat kemungkinan kerjaan berat (codebase, techdebt, testing), bukan tiket kecil.
3. Jadi posisi agent yang paling masuk akal: **ambil yang mekanis, bebaskan waktu manusia buat yang berat.**
4. Blocker terbesar sekarang bukan teknis — kita belum bisa lihat codebase-nya, dan belum tau siapa yang review.
5. Yang wajib dibangun apa pun hasilnya: agent selalu lewat PR, jangan pernah push langsung ke master. Ada 78 tiket yang nyentuh urusan uang (GL, costing, inventory) di backlog itu.

---

## Dokumen lanjutan

- `runchise-ai-pipeline-design.md` — desain teknis alurnya, tahap per tahap
- `runchise-pilot-metrics-baseline.md` — cara ngukur sukses pilot

Keduanya masih memuat framing lama yang gue koreksi di bagian 3. Angka baseline di dokumen metrik sekarang bisa diisi dengan angka nyata di bagian 2 dokumen ini.
