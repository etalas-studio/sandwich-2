# Runchise RR — Audit Codebase untuk AI Readiness

Ditulis 31 Juli 2026 · repo `runchise/runchise`, branch `master`, commit terakhir 30 Juli 2026
Ini bagian audit Week 1 yang sebelumnya kepending karena akses belum masuk.

---

## Ringkasan satu paragraf

Codebase-nya besar tapi jauh lebih rapi dari dugaan awal. CI-nya ada dan serius (rspec + rubocop + brakeman), strukturnya domain-driven, dan tim-nya aktif — 451 commit dari 10 orang dalam 90 hari. Artinya gerbang PR otomatis di desain pipeline **bisa dibangun**. Tiga hal yang jadi masalah nyata: **tes di domain uang hampir kosong**, ada beberapa file raksasa yang berbahaya kalau disentuh agent, dan **dokumentasi teknisnya ada di Notion — di luar repo**, jadi agent gak bisa baca.

---

## 1. Ukuran dan bentuk

| | |
|---|---|
| Ruby | 3.0.1 |
| Rails | 6.1 |
| Ukuran repo | 192 MB (94 MB di antaranya `.git`) |
| File `.rb` di `app/` | 4.446 |
| Baris kode di `app/` | ±362.000 |
| File spec | 1.658 |
| Baris kode di `spec/` | ±899.000 |
| Commit 90 hari terakhir | 451 (±5/hari) |
| Kontributor 90 hari terakhir | 10 orang |

**Catatan versi:** Ruby 3.0.1 sudah EOL sejak April 2024, dan Rails 6.1 juga sudah lewat masa dukungan keamanannya. Ini bukan blocker buat pilot, tapi ini konfirmasi keluhan "techdebt" mereka. Efeknya ke agent: model cenderung nulis idiom Ruby/Rails yang lebih baru, jadi perlu diarahkan lewat instruksi eksplisit.

---

## 2. Struktur — kabar bagus

`app/domains/` isinya 3.183 file, yaitu **72% dari seluruh kode aplikasi**. Ada 83 domain terpisah: `accounting`, `delivery`, `report`, `customer_order`, `products`, plus banyak integrasi pihak ketiga (`grab_food`, `gobiz`, `shopee_food`, `bca`, `bni_qris`, `faspay`, dan lain-lain).

Kenapa ini bagus buat agent: batas domain yang jelas berarti agent bisa dikasih ruang kerja sempit. "Kerjakan tiket ini, dan cuma sentuh `app/domains/report/`" itu instruksi yang bisa ditegakkan.

**Tapi ada satu domain raksasa:** `restaurant` isinya **1.156 file** — seperempat dari seluruh kode aplikasi. Jadi di dalam struktur yang rapi itu, masih ada satu monolit. Membatasi agent ke `restaurant/` praktis sama dengan gak membatasi apa-apa.

### 12 domain terbesar

| Domain | File |
|---|---|
| restaurant | 1.156 |
| report | 156 |
| accounting | 153 |
| grab_food | 111 |
| gobiz | 94 |
| delivery | 92 |
| dine_in | 86 |
| shopee_food | 85 |
| customer_order | 78 |
| resource_creator | 73 |
| enterprise | 69 |
| products | 54 |

---

## 3. CI — ada, dan lebih lengkap dari yang gue duga

Ini temuan paling melegakan. Sebelumnya gue nulis "kalau CI-nya gak ada, desain pipeline runtuh". Ternyata ada.

**`bitbucket-pipelines.yml`** menjalankan:

1. Cek nama branch (`check_branch_name.sh`)
2. `bundle exec rspec spec` — seluruh test suite
3. `brakeman` — pemindai celah keamanan
4. `rubocop --require rubocop-rails` — linter
5. Build Docker + push ke AWS ECR

Test-nya butuh layanan pendukung: PostgreSQL 14, Redis, Elasticsearch 7.12, dan ClickHouse.

**Artinya gerbang PR di desain pipeline bisa langsung dipakai.** Agent dapat umpan balik otomatis: test, lint, dan pemindaian keamanan.

**Dua hal yang perlu dikonfirmasi ke Runchise:**

1. Ada **dua** konfigurasi CI di repo — `bitbucket-pipelines.yml` dan `.circleci/config.yml`. Perlu tau mana yang beneran jalan sekarang.
2. **Berapa lama satu run penuh?** Suite-nya pakai gem `parallel_tests`, yang biasanya cuma dipasang kalau suite-nya sudah lama banget. Kalau satu run 40 menit, loop umpan balik agent jadi lambat dan itu perlu diperhitungkan. Angkanya cuma bisa dilihat dari riwayat build di Bitbucket.

---

## 4. Tes — dan ini masalah seriusnya

`simplecov` sudah terpasang, jadi angka coverage sebenarnya bisa diukur. Tapi buat menjalankannya perlu environment lengkap, jadi di bawah ini gue pakai **rasio jumlah file spec dibanding file aplikasi** sebagai perkiraan kasar. Ini bukan coverage sesungguhnya — cuma indikator kasar mana yang diperhatikan dan mana yang ditinggalkan.

| Domain | File aplikasi | File spec | Rasio |
|---|---|---|---|
| Seluruh `app/` | 4.446 | 1.658 | 37% |
| restaurant | 1.156 | 299 | 26% |
| accounting | 153 | 46 | 30% |
| **report** | **156** | **5** | **3%** |
| **jurnal** | **37** | **1** | **3%** |

Dua baris terakhir itu yang bikin gue berhenti.

`report` dan `jurnal` praktis tidak punya tes. Dan kalau lihat backlog Jira mereka, **tiket laporan itu salah satu kelompok terbesar** — banyak tiket bertipe report tweak dan bug laporan. Jadi area yang paling sering butuh perbaikan justru area yang paling gak punya jaring keselamatan.

`jurnal` itu jurnal akuntansi. Satu file spec untuk 37 file kode, di domain yang langsung menyentuh angka uang klien.

**Konsekuensi konkret buat desain pipeline:** CI hijau di domain `report` atau `jurnal` **tidak berarti apa-apa**, karena hampir gak ada tes yang bisa merah. Jadi untuk dua domain ini, syarat "characterization test wajib sebelum ngoding" bukan sekadar bagus — itu satu-satunya cara agent boleh nyentuh sama sekali.

---

## 5. File yang berbahaya buat agent

| Jumlah | Kriteria |
|---|---|
| 25 file | lebih dari 800 baris |
| 219 file | lebih dari 300 baris |

Yang terbesar:

| File | Baris |
|---|---|
| `app/models/concerns/product_logic.rb` | 2.648 |
| `app/models/order_transaction.rb` | 2.437 |
| `app/helpers/notification_helper.rb` | 2.007 |
| `app/queries/product_query.rb` | 1.719 |
| `app/models/concerns/sale_transaction_logic.rb` | 1.620 |
| `app/controllers/api/orders_controller.rb` | 1.564 |

Kenapa ini masalah: `product_logic.rb` itu sebuah *concern* 2.648 baris — artinya dia di-include ke banyak model sekaligus. Ubah satu metode di situ, efeknya nyebar ke tempat yang gak kelihatan dari diff-nya.

Analoginya: ini kabel yang ditarik ke seluruh rumah. Ganti satu sambungan, lampu di kamar lain bisa mati, dan lu gak akan tau sampai ada yang ngeluh.

**Usul aturan:** daftar file ini masuk daftar cegat. Kalau agent kepaksa nyentuh salah satunya, otomatis kena `risk:high` — senior review wajib, apa pun isi tiketnya.

---

## 6. Dokumentasi — masalah yang paling murah dibenerin

| Yang ada | Isi |
|---|---|
| `README.md` | 57 baris, dan isinya **daftar tech debt**, bukan penjelasan sistem |
| `DEVSETUP.md` | 164 baris, setup lingkungan lokal |
| `CLAUDE.md` / `AGENTS.md` / `.cursorrules` | **tidak ada** |

README-nya sendiri ngaku: *"This readme is now used to put Tech Debt only, when you need to check/update our documentation please go checkout our Notion for Backend."*

Jadi dokumentasi teknis sesungguhnya ada di **Notion** — di luar repo. Ini pola yang sama dengan masalah tiket Slack: konteks penting duduk di tempat yang gak bisa dibaca agent saat dia kerja.

Dua hal yang bisa dikerjakan:

1. **Tulis `CLAUDE.md` di root repo.** Isinya: peta domain, konvensi kode, cara jalanin test, area yang gak boleh disentuh, daftar file cegat. Ini pekerjaan setengah hari dan langsung kepakai — termasuk buat tim mereka yang sekarang pakai Cursor tanpa file instruksi apa pun.
2. **Sambungkan Notion mereka.** Ada connector Notion, jadi dokumentasi itu sebenarnya bisa dibaca agent. Perlu izin dari Runchise.

Menarik dicatat: tim mereka sudah pakai Cursor sehari-hari, tapi repo-nya gak punya satu pun file instruksi buat AI. Jadi tiap orang praktis mulai dari nol tiap kali. Ini keuntungan cepat yang kelihatan hasilnya, terlepas dari nasib pilot-nya.

---

## 7. Integrasi pihak ketiga — hindari dulu

Dari 83 domain, belasan di antaranya integrasi eksternal: `grab_food`, `gobiz`, `shopee_food`, `grab_express`, `gosend`, `lala_move`, `bca`, `bni_qris`, `bri_tax_integration`, `faspay`, `edc_payment`, `dropbox`, `huawei`, dan lain-lain.

Domain-domain ini sebaiknya **dikeluarkan dari lingkup pilot**. Alasannya: agent gak bisa memverifikasi kerjaannya tanpa memanggil API pihak ketiga yang sungguhan, dan salah di jalur pembayaran itu kategori kesalahan yang paling gak boleh terjadi.

---

## 8. Revisi rekomendasi setelah lihat kode

| Sebelumnya | Sekarang | Alasan |
|---|---|---|
| "Kalau CI gak ada, desain runtuh" | CI ada dan lengkap — gerbang PR bisa dibangun | `bitbucket-pipelines.yml` sudah jalanin rspec, rubocop, brakeman |
| "Batasi agent per domain" | Batasi per domain, **kecuali `restaurant`** | 1.156 file, terlalu luas untuk jadi batas |
| "Test wajib nempel di tiap PR" | Sama, tapi **wajib mutlak** di `report` dan `jurnal` | Rasio spec 3%; CI hijau di sana tidak bermakna |
| Belum ada daftar cegat | Ada: 25 file di atas 800 baris | File raksasa punya efek samping yang gak kelihatan di diff |
| — | Tulis `CLAUDE.md` sebagai pekerjaan hari pertama | Belum ada file instruksi AI sama sekali |
| — | Keluarkan domain integrasi dari lingkup | Gak bisa diverifikasi tanpa API sungguhan |

---

## 9. Kandidat pilot yang paling masuk akal

Menggabungkan audit ini dengan triage Jira, tiket yang paling cocok buat percobaan pertama adalah yang **domainnya sempit, punya tes, dan gak nyentuh uang**.

Dari 16 kandidat Tier A/B yang masih hidup, yang paling aman:

- **RR-7338** — nama file export ganti karakter Mandarin jadi underscore. Acceptance criteria lengkap 5 poin, perubahannya kecil (sanitasi nama file), dan gampang dites.
- **RR-7035** — order type gak keupdate setelah ganti pilihan di scheduled menu.
- **RR-7201** — delivery kebentuk ulang otomatis setelah dihapus.

Yang **jangan** dipakai buat percobaan pertama: RR-7143, RR-7191, RR-7112. Semuanya `ACCOUNTING_LOGIC`, dan domain `jurnal`/`accounting` rasio tesnya rendah. Simpan sampai pipeline-nya sudah terbukti.

---

## 10. Yang masih perlu ditanya ke Runchise

1. CI mana yang beneran jalan — Bitbucket Pipelines atau CircleCI?
2. Satu run test penuh berapa lama? (bisa dilihat dari riwayat build)
3. Berapa angka coverage sesungguhnya dari SimpleCov? Ada laporan terakhirnya?
4. Boleh gak kita sambungkan Notion backend mereka biar agent bisa baca dokumentasi?
5. Siapa yang review, berapa jam per minggu? — **ini masih belum terjawab dari awal, dan ini plafon sebenarnya**

---

*Semua angka di dokumen ini dihitung langsung dari repo pada 31 Juli 2026. Rasio spec-terhadap-app adalah perkiraan kasar berdasarkan jumlah file, bukan coverage sesungguhnya — angka pastinya perlu menjalankan SimpleCov.*
