# QUOTATION PENGEMBANGAN LMS — Pertamina UMK Academy 2026

Kepada Yth. PT Impala Ruang Bersama (Impala Network)
Perihal: Quotation Pengembangan LMS UMK Academy 2026 - etalas
Nomor Dokumen: 001/07/2026 · Tanggal: 5 Agustus 2026

Bersama dokumen ini kami sampaikan penawaran teknis dan komersial untuk pengembangan Web-based LMS & Program Management Platform, disusun mengikuti ruang lingkup, batasan anggaran, dan skema milestone pada dokumen acuan yang diberikan klien.

## 1. Profil Perusahaan dan Portofolio

### 1.1 Profil Singkat
| Atribut | Keterangan |
|---|---|
| Nama Perusahaan | PT. Etalas Karya Internasional |
| Tahun Berdiri | 2022 |
| Jumlah Tim Tetap | 14 orang (Product, Design, Engineering, QA) |
| Domisili | Jakarta |
| Fokus Layanan | Web application development, sistem berbasis role & workflow |

### 1.2 Portofolio Proyek Sejenis
Proyek relevan sebagai referensi kapabilitas tim dalam membangun sistem dengan kompleksitas serupa (multi-role, kurasi berjenjang, pelaporan program).

## 2. Pendekatan Teknis, Tech Stack, Arsitektur, dan Asumsi Kapasitas

### 2.1 Pendekatan Teknis
- Metodologi agile dengan rilis bertahap (R0-R9) mengikuti tanggal wajib siap; setiap rilis melalui demo dan UAT sebelum go-live.
- Arsitektur modular: setiap modul dibangun sebagai domain terpisah agar perubahan pada satu modul tidak mengganggu modul lain.
- Role-based access control (RBAC) untuk setiap role utama, dengan audit trail dasar pada aksi kurasi dan approval.
- Desain data model mempertimbangkan volume dan kebutuhan agregasi sejak awal (R0), untuk menghindari refactor besar di rilis lanjutan.

### 2.2 Tech Stack yang Diusulkan
| Layer | Teknologi |
|---|---|
| Frontend | Next.js (React) + Tailwind CSS, responsive |
| Backend | Node.js (NestJS) atau Laravel - REST API, modular per domain |
| Database | PostgreSQL, Redis untuk cache/queue ringan |
| Autentikasi | Email/password + OTP dasar, role-based session |
| Reporting/Export | Server-side generation untuk export Excel & PDF report |
| Infrastruktur | Deploy ke server/cloud yang disediakan klien; CI sederhana |

### 2.3 Asumsi Kapasitas
- Estimasi jumlah pengguna/akun pada puncak periode kritis akan dikonfirmasi bersama klien pada tahap R0 untuk menyesuaikan sizing server.
- Ukuran dan jenis file upload dibatasi pada format umum untuk menjaga performa upload dan storage.
- Bila estimasi berubah signifikan setelah R0, penyesuaian arsitektur/kapasitas non-trivial diproses melalui Change Request.

## 3. Rincian Harga per Work Package, Manpower, Durasi, dan Person-Day

Struktur pos pekerjaan mengikuti Struktur Biaya Acuan pada dokumen acuan klien. Harga disajikan itemized dengan pemisahan DPP dan PPN 11%.

| No. | Work Package | Person-Day |
|---|---|---|
| 1 | Product discovery, alur bisnis, spesifikasi teknis | 3 hari |
| 2 | Adaptasi UI/UX & design system | 4 hari |
| 3 | Backend inti, autentikasi, database, role permission | 12 hari |
| 4 | Modul inti sesuai domain (pendaftaran, verifikasi, kurasi, scoring) | 12 hari |
| ... | ... modul lanjutan per fase ... | ... |
| N-2 | QA, UAT, deployment, basic security hardening | 5 hari |
| N-1 | Dokumentasi, pelatihan admin, source-code handover | 3 hari |
| N | Stabilisasi & technical support pasca go-live | 5 hari |

### 3.1 Komposisi Manpower
| Peran | Jumlah | Alokasi Utama |
|---|---|---|
| Project Manager / Business Analyst | 1 orang | Spesifikasi, backlog, koordinasi weekly review — sepanjang durasi proyek |
| UI/UX Designer | 1 orang | Design system & mockup di fase awal, penyesuaian ringan di rilis berikutnya |
| Backend Developer | 2 orang | API, database, modul inti, integrasi reporting |
| Frontend Developer | 1 orang | UI tiap role, dashboard, responsive layout |
| QA Engineer | 1 orang | Test case, UAT tiap rilis, regresi, verifikasi acceptance criteria |

## 4. Timeline Delivery

Timeline delivery mengikuti tanggal wajib siap (production readiness) yang disepakati, dengan buffer UAT minimal 1 hari untuk setiap rilis awal. Disajikan sebagai tabel: Rilis | Periode Dev/UAT | Wajib Siap | Fokus | Deliverable.

## 5. Deliverable dan Acceptance Criteria

| Area | Kriteria Penerimaan |
|---|---|
| Fungsional | Flow utama dapat dijalankan end-to-end sesuai rilis dan role permission yang berlaku. |
| Data | Data tersimpan konsisten, dapat divalidasi, difilter, diexport, dan memiliki status yang jelas. |
| Keamanan Dasar | Tidak ada credential hardcoded; akses berbasis role; data sensitif tidak terbuka ke publik. |
| Kinerja | Halaman utama responsif pada kapasitas yang disepakati. |
| Dokumentasi | Source code, deployment guide, database/data dictionary, dan admin manual diserahkan. |
| UAT | Temuan Critical dan High ditutup sebelum go-live; temuan Minor punya target penyelesaian yang disepakati. |

## 6. Warranty, Response Time, dan Batas Minor Adjustment

Bug fixing gratis untuk defect fungsional selama periode stabilisasi yang disepakati. Response time berjenjang untuk temuan Critical/High vs Medium/Minor. Batas minor adjustment (teks, label, urutan field, styling ringan) termasuk dalam cakupan standar; perubahan fitur baru/alur bisnis/integrasi baru diproses via Change Request.

## 7. Pemisahan Biaya One-Time dan Recurring

Jasa pengembangan bersifat one-time (per proyek). Server, cloud, domain, SSL, storage, dan lisensi pihak ketiga bersifat recurring dan ditanggung klien, tidak termasuk dalam nilai quotation.

## 8. Ringkasan Komersial

Disajikan sebagai tabel DPP, PPN (11%), Total Tagihan, Masa Berlaku Quotation (30 hari kalender), dan rekening pembayaran.

### 8.1 Termin Pembayaran (Skema Milestone)
Dibagi 5 tahap: kick-off & rilis awal disetujui (20%), rilis pertengahan (25% + 25%), rilis akhir/nasional (20%), stabilisasi & handover (10%). Invoice diterbitkan setelah milestone didemonstrasikan dan disetujui; pembayaran diterima maks. 14 hari kerja setelah invoice.

### 8.2 Opsi Tambahan
Item di luar scope wajib (technical support lanjutan, fitur AI, mobile native) disediakan sebagai opsi terpisah dengan estimasi biaya sesuai scope, tidak termasuk dalam total quotation.

## 9. Risiko, Dependensi, Fitur yang Dianggap Tidak Realistis, dan Mitigasi

### 9.1 Risiko Utama
Timeline rilis awal yang ketat, beberapa rilis paralel yang berisiko pada beban tim, dan volume pengguna yang belum final di awal proyek dapat mempengaruhi asumsi kapasitas.

### 9.2 Dependensi dari Klien
Kesiapan infrastruktur sejak awal, kecepatan review/approval demo per rilis, kejelasan kriteria penilaian sebelum development modul terkait dimulai, ketersediaan konten tepat waktu, dan satu PIC untuk keputusan cepat.

### 9.3 Fitur yang Dianggap Berisiko / Kurang Realistis
Fitur dengan jendela waktu ketat relatif terhadap kompleksitas logikanya diberi catatan risiko eksplisit, dengan usulan penyederhanaan scope (misalnya pakai template sederhana ketimbang generator dinamis penuh).

### 9.4 Usulan Mitigasi
Freeze spesifikasi di hari kick-off, prioritaskan fitur dengan tanggal penggunaan paling dekat, lakukan load testing ringan menjelang periode puncak, dan sepakati SLA komunikasi review/approval.

## 10. Penutup

Kami siap berdiskusi lebih lanjut mengenai penawaran ini dan menyesuaikan alokasi antarpos pekerjaan sepanjang total nilai dan deliverable minimum tetap terpenuhi. Terima kasih atas kesempatan yang diberikan.

Hormat kami,
[Nama] — [Jabatan] · etalas
