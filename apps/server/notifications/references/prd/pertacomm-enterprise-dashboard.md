# PRD: SIMPUL — Sistem Monitoring Program UMK

Version: 1.0 · Date: 6 Juni 2026 · Status: Draft

## 1. Executive Summary

SIMPUL adalah platform digital yang mendukung program pembinaan UMK binaan sebuah BUMN energi, mulai dari penetapan target kinerja peserta (OKR/KPI), pencatatan bukti progres, penilaian berjenjang oleh reviewer, sampai fasilitasi networking antar peserta dan pelaporan terpusat untuk manajemen program. Platform ini menghadirkan standarisasi penilaian yang selama ini berbeda-beda tergantung reviewer, mempercepat proses verifikasi bukti yang tadinya bisa memakan waktu berminggu-minggu, memperluas jaringan bisnis antar peserta program, memudahkan pendamping lapangan memantau banyak UMK sekaligus, dan menjadi satu sumber data yang bisa diandalkan oleh semua pihak. Target jangka panjangnya, SIMPUL menjadi platform resmi yang dipakai di seluruh program pembinaan UMK BUMN ini di Indonesia, bukan cuma satu wilayah pilot.

## 2. Problem Statement

### 2.1 Tidak Ada Platform Terintegrasi

Program berjalan lewat kombinasi spreadsheet, WhatsApp, dan dokumen fisik yang dikirim manual oleh masing-masing pendamping lapangan. Akibatnya data antar wilayah tidak konsisten, sering terjadi entri ganda, dan tim program kesulitan melacak riwayat progres satu UMK dari waktu ke waktu.

### 2.2 Proses Verifikasi Bukti Lambat dan Rawan

Bukti progres (foto, laporan, dokumen pendukung) dikirim lewat WhatsApp ke pendamping, lalu diteruskan lagi ke reviewer pusat. Setiap tahap transfer ini menambah waktu tunggu dan risiko file hilang atau rusak, sementara tidak ada jejak audit yang jelas soal siapa yang sudah memverifikasi apa.

### 2.3 Penilaian Tidak Tersentralisasi

Setiap reviewer punya cara sendiri menilai progres UMK karena tidak ada sistem skor yang seragam. Ini membuat hasil penilaian antar wilayah sulit dibandingkan, dan UMK yang sebenarnya berkinerja baik bisa dinilai lebih rendah hanya karena reviewer yang berbeda.

### 2.4 Dashboard Monitoring Tidak Tersedia

Manajemen program hanya bisa melihat progres keseluruhan lewat laporan bulanan yang disusun manual oleh tim admin, bukan data real-time. Keputusan program sering terlambat karena baru diketahui setelah data direkap di akhir bulan.

### 2.5 Fitur Networking Antar Peserta Tidak Terfasilitasi

Padahal salah satu tujuan program adalah membuka peluang bisnis antar UMK binaan, saat ini tidak ada mekanisme resmi untuk mempertemukan peserta yang saling membutuhkan, sehingga potensi kolaborasi bisnis banyak yang terlewat.

## 3. Product Vision

SIMPUL menjadi platform digital terpadu yang mengelola seluruh siklus pembinaan UMK, dari onboarding peserta, penetapan target, pemantauan progres, validasi bukti, penilaian berjenjang, networking antar peserta, sampai pelaporan ke manajemen program, dengan proses yang cepat, akurat, dan terstandarisasi di semua wilayah.

## 4. Product Goals

1. Menstandarkan proses penilaian progres UMK di seluruh wilayah program.
2. Mempercepat proses verifikasi bukti dari hitungan minggu menjadi hitungan hari.
3. Menyediakan dashboard real-time bagi manajemen program untuk memantau kinerja peserta.
4. Menghadirkan fitur networking yang memfasilitasi kolaborasi bisnis antar UMK binaan.
5. Memastikan setiap perubahan data tercatat dengan jejak audit yang lengkap.

## 5. Product Non-Goals

- Sistem tidak bertindak sebagai marketplace transaksi antar UMK, hanya sebagai pencatat dan fasilitator perkenalan bisnis.
- Sistem tidak melakukan scoring otomatis berbasis AI/ML pada fase awal; penilaian tetap dilakukan reviewer manusia dengan bantuan alat hitung skor terstandar.
- Sistem tidak digunakan untuk transaksi keuangan atau pencairan dana program.
- Sistem tidak menggantikan sistem HR atau payroll internal BUMN.

## 6. User Personas

1. **Peserta Program (UMK):** menginput progres kegiatan, mengupload bukti pendukung, melihat skor dan feedback dari reviewer, dan menggunakan fitur networking untuk mencari mitra bisnis.
2. **Pendamping Lapangan:** memantau beberapa UMK binaan di wilayahnya, membantu peserta yang kesulitan menggunakan sistem, dan memberi catatan awal sebelum bukti masuk ke reviewer pusat.
3. **Reviewer/Approver:** melakukan review atas bukti yang diupload, memberi skor sesuai rubrik yang berlaku, dan mengirim catatan revisi jika bukti belum memenuhi kriteria.
4. **Admin Program:** mengelola data master (daftar UMK, wilayah, target program), mengatur periode penilaian, dan menangani eskalasi dari pendamping lapangan.
5. **Viewer Level Manajemen:** biasanya cukup melihat dashboard ringkasan kinerja program secara keseluruhan, dan baru masuk ke detail per UMK kalau memang diperlukan untuk pengambilan keputusan.

## 7. Product Scope

### 7.1 In Scope

1. **Authentication & User Management.** Login berbasis role, dengan pengaturan akses per wilayah untuk pendamping lapangan.
2. **Onboarding & Master Data.** Pendaftaran UMK baru beserta data wilayah dan program yang diikuti.
3. **OKR/Target Management.** Penetapan target kinerja per periode, baik per UMK maupun per kelompok UMK.
4. **Progress Input & Evidence.** Form input progres berkala plus upload bukti pendukung, lengkap dengan riwayat versi.
5. **Verification & Scoring.** Alur review bukti dengan rubrik skor terstandar dan catatan revisi kalau bukti belum lolos.
6. **Networking & Business Matching.** Direktori UMK yang bisa dicari berdasarkan kategori usaha, plus catatan pertemuan bisnis yang difasilitasi program.
7. **Dashboard & Reporting.** Ringkasan kinerja per wilayah, per periode, dan per UMK, yang bisa diekspor untuk laporan ke manajemen BUMN.
8. **Notification System.** Pengingat tenggat input progres dan notifikasi hasil review.
9. **Helpdesk.** Kanal bantuan sederhana untuk peserta yang mengalami kendala teknis.

### 7.2 Out of Scope

- Transaksi e-commerce atau payment gateway untuk penjualan produk UMK.
- Sistem manajemen inventori usaha peserta.
- AI auto-assessment untuk penilaian bukti (didorong ke fase lanjutan jika dibutuhkan).
- Video conferencing internal (program tetap memakai platform meeting yang sudah ada).

## 8. High-Level User Journey

**Peserta Program**

1. Login dan melihat dashboard target periode berjalan.
2. Mengisi form progres sesuai target yang ditetapkan.
3. Mengupload bukti pendukung.
4. Submit untuk direview.
5. Jika ada catatan revisi, memperbaiki dan mengirim ulang bukti.
6. Menggunakan fitur networking untuk mencari mitra bisnis, sebagai aktivitas sekunder di luar alur utama.
7. Melihat skor akhir periode setelah direview.

**Pendamping Lapangan**

1. Login dan melihat daftar UMK binaan di wilayahnya.
2. Memantau status progres tiap UMK, menandai yang butuh pendampingan tambahan.
3. Membantu peserta yang kesulitan mengisi form atau upload bukti.

**Reviewer**

1. Login dan melihat antrian bukti yang perlu direview.
2. Membuka bukti, menilai sesuai rubrik, memberi skor.
3. Mengirim catatan revisi jika bukti belum memenuhi kriteria, atau menyetujui jika sudah lengkap.

## 9. High-Level Features

1. Login & Role-Based Dashboard
2. Master Data (UMK, wilayah, program)
3. OKR/Target Engine
4. Evidence Upload dengan Versioning
5. Review & Scoring
6. Automatic Score Calculation Engine
7. Revision Workflow
8. Audit Trail & Compliance Layer
9. Networking Module
10. Business Matching Records
11. Global Dashboard untuk Manajemen
12. Readiness Index Computation
13. Helpdesk Ticketing
14. Notification System
15. Admin Configuration

## 10. System-Wide Requirements (High Level)

- **Performance:** mendukung minimal 5.000 pengguna aktif secara bersamaan, dashboard dimuat dalam waktu di bawah 3 detik, form submit merespons dalam waktu di bawah 2 detik.
- **Security:** autentikasi berbasis JWT, role-based access control per wilayah dan per peran, enkripsi data sensitif peserta, dan audit trail wajib untuk setiap perubahan data.
- **Scalability:** arsitektur mampu bertumbuh mengikuti penambahan jumlah peserta program tiap tahun, serta terbuka untuk integrasi dengan sistem internal BUMN di masa depan.
- **Availability:** target uptime minimal 99.5% selama jam operasional program.
- **Compliance:** mengikuti standar pengelolaan data internal BUMN yang berlaku, termasuk kebijakan retensi dan akses data peserta.

## 11. Success Metrics / KPIs

**Product Success Metrics**

- Persentase pengisian progres yang tepat waktu sesuai tenggat periode.
- Persentase bukti yang disetujui tanpa revisi berulang.
- Jumlah aktivitas networking yang tercatat per periode.
- Persentase reviewer yang aktif menggunakan scoring engine dibanding menilai manual di luar sistem.

**Program-Level KPIs**

- Peningkatan omzet rata-rata UMK peserta dibanding sebelum mengikuti program.
- Peningkatan jumlah transaksi bisnis hasil networking yang difasilitasi platform.
- Pertumbuhan readiness index UMK dari periode ke periode.

## 12. Risks & Mitigation

1. **Risiko:** peserta UMK kurang terbiasa dengan sistem digital.
   Mitigasi: antarmuka dibuat sesederhana mungkin, disediakan panduan tutorial video, dan pendamping lapangan dilibatkan aktif membantu peserta di tahap awal.
2. **Risiko:** reviewer di berbagai wilayah tetap menilai secara tidak konsisten meski sudah ada rubrik.
   Mitigasi: sesi kalibrasi penilaian rutin antar reviewer, dan sistem menampilkan skor rata-rata sebagai pembanding saat reviewer memberi nilai.
3. **Risiko:** koneksi internet terbatas di beberapa wilayah binaan.
   Mitigasi: form input dan upload bukti dirancang agar tetap bisa disimpan sementara secara lokal dan disinkronkan otomatis saat koneksi tersedia.

## 13. Release Strategy & Phasing

- **Phase 1 (Core Foundations):** authentication, master data, OKR/target management, progress input, evidence upload, review dan scoring dasar.
- **Phase 2 (Governance & Analytics):** dashboard manajemen, audit trail lengkap, notification system, helpdesk.
- **Phase 3 (Expansion & Business Enablement):** networking module dan business matching records.
- **Phase 4 (Enterprise Features):** readiness index computation dan integrasi lanjutan dengan sistem internal BUMN.

## 14. Appendix — Term & Definitions

| Istilah | Kepanjangan / Penjelasan |
|---|---|
| UMK | Usaha Mikro dan Kecil, peserta utama program pembinaan |
| OKR | Objectives and Key Results, kerangka penetapan target kinerja peserta |
| Readiness Index | Skor komposit yang menggambarkan kesiapan bisnis UMK berdasarkan beberapa indikator program |
| BUMN | Badan Usaha Milik Negara, pemilik program pembinaan ini |

---

**Catatan gaya:** dokumen ini kadang lanjut ke bagian "Functional Requirement Details" per fitur dalam format User Story + Acceptance Criteria yang lebih detail, dipakai saat PRD level tinggi ini perlu diturunkan ke spesifikasi teknis siap-QA dalam dokumen yang sama.
