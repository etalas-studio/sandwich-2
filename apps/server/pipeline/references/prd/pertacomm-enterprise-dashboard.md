# [WIP] PRD: [Product Name]

Version: 1.0 · Date: [date] · Status: Draft

## 1. Executive Summary

Satu paragraf: nama platform, program/inisiatif apa yang didukung, mekanisme inti (monitoring kinerja via OKR/KPI, evidence tracking, penilaian berjenjang, networking antar peserta, reporting terpusat). Ditutup bullet list solusi terpadu yang dihadirkan (standarisasi penilaian, akselerasi verifikasi, ekspansi jaringan, kemudahan pendampingan, single source of truth) dan satu kalimat ambisi skala (mis. "menjadi platform resmi digunakan seluruh peserta program di Indonesia").

## 2. Problem Statement

Sub-section bernomor (2.1, 2.2, ...), tiap satu masalah inti dengan heading singkat, lalu bullet list akibat konkretnya. Contoh pola: "Tidak Ada Platform Terintegrasi" → proses manual (spreadsheet/WhatsApp/dokumen) → data tidak konsisten, duplicate entry, sulit tracking historis. Sub-masalah lain yang lazim: proses evidence lambat & tidak aman, penilaian tidak tersentralisasi, dashboard monitoring tidak tersedia, fitur kolaborasi/networking antar peserta tidak terfasilitasi.

## 3. Product Vision

Satu paragraf padat: platform digital terpadu yang mengelola seluruh siklus [proses inti program] dari onboarding, monitoring, validasi, scoring, networking, hingga reporting — cepat, akurat, dan terstandarisasi.

## 4. Product Goals

Numbered list, tiap goal kalimat aksi (Meningkatkan..., Menstandarkan..., Mempercepat..., Menyediakan..., Menghadirkan..., Memastikan...) — grounded langsung ke problem statement.

## 5. Product Non-Goals

Section EKSPLISIT yang sering dilewatkan PRD lain — bullet list hal yang SENGAJA tidak dikerjakan sistem ini, supaya ekspektasi klien gak melebar. Contoh pola: "Sistem tidak bertindak sebagai marketplace (hanya pelacakan)", "Sistem tidak melakukan scoring menggunakan AI/ML (pada fase awal)", "Sistem tidak digunakan untuk transaksi keuangan."

## 6. User Personas

Numbered list per role (peserta program, pendamping lapangan, reviewer/approver, admin program, viewer level manajemen), masing-masing dengan bullet list tanggung jawab/aksi utama di sistem — ditulis sebagai kata kerja (Menginput..., Mengupload..., Melakukan review..., Melihat dashboard...).

## 7. Product Scope

### 7.1 In Scope
Numbered list modul-modul utama (Authentication & User Management, Onboarding & Master Data, OKR/Target Management, Progress Input & Evidence, Verification & Scoring, Networking & Business Matching, Dashboard & Reporting, Notification System, Helpdesk, LMS jika relevan), tiap modul dengan sub-bullet kapabilitas konkret.

### 7.2 Out of Scope
Bullet list eksplisit (transaksi e-commerce, payment gateway, inventory system, AI auto-assessment untuk fase lanjutan, video conferencing internal).

## 8. High-Level User Journey

Per persona utama, numbered steps end-to-end (login → lihat dashboard → isi progress/draft → upload evidence → submit → jika revisi, perbaiki → lakukan aktivitas sekunder seperti networking/LMS → lihat skor akhir). Setiap persona punya journey terpisah meski beberapa step overlap.

## 9. High-Level Features

Flat numbered list (bukan dikelompokkan) semua fitur besar sistem — ini beda dari section 7.1 yang dikelompokkan; di sini cukup daftar nama fitur runtutan sesuai urutan alur kerja (Login & Role-Based Dashboard, Master Data, OKR/Target Engine, Evidence Upload + Versioning, Review & Scoring, Automatic Calculation Engine, Revision Workflow, Audit Trail & Compliance Layer, Networking Module, Business Matching Records, Marketplace/Export Tracking jika ada, Exhibition/Media Tracking jika ada, Global Dashboards, Readiness Index Computation, Helpdesk Ticketing, Notification System, Admin Configuration, LMS jika ada).

## 10. System-Wide Requirements (High Level)

Sub-section per kategori non-fungsional dengan angka target eksplisit:
- **Performance** — jumlah pengguna aktif yang harus disupport, target load time dashboard, target response time form submit.
- **Security** — metode auth (mis. JWT-based), RBAC, enkripsi data sensitif, audit trail wajib untuk semua perubahan.
- **Scalability** — target pertumbuhan jumlah pengguna, dukungan integrasi sistem internal klien di masa depan.
- **Availability** — target uptime minimal.
- **Compliance** — standar yang wajib dipatuhi sesuai jenis klien (mis. standar manajemen data BUMN, atau standar industri relevan lainnya).

## 11. Success Metrics / KPIs

Dua tingkat metrik dipisah jelas:
- **Product Success Metrics** — metrik adopsi & kualitas penggunaan sistem itu sendiri (% pengisian KPI tepat waktu, % progress disetujui tanpa revisi berulang, jumlah aktivitas networking tercatat, % reviewer yang pakai scoring engine).
- **Program-Level KPIs** — metrik dampak bisnis/program yang lebih besar dari sekadar penggunaan sistem (peningkatan omzet, peningkatan jumlah transaksi, peningkatan aktivitas ekspor, pertumbuhan readiness index).

## 12. Risks & Mitigation

Numbered list risiko, tiap risiko heading singkat lalu bullet list mitigasi konkret. Contoh pola: "Risiko: [peserta] kurang digital-savvy" → mitigasi: antarmuka sederhana, panduan tutorial video, bantuan pendamping lapangan.

## 13. Release Strategy & Phasing

Dipecah per Phase (Phase 1 – Core Foundations, Phase 2 – Governance & Analytics, Phase 3 – Expansion & Business Enablement, Phase 4 – Enterprise Features), tiap phase bullet list deliverable konkret yang dikerjakan di situ — modul kompleks (business matching, marketplace, export tracking, LMS+certificate) SENGAJA didorong ke phase belakang, bukan phase 1.

## 14. Appendix — Term & Definitions

Bullet list singkat: Singkatan — kepanjangan/peran singkat. Dipakai kalau domain klien punya banyak singkatan spesifik program/organisasi (role, dokumen, badan pengelola).

---

**Catatan gaya:** dokumen ini kadang lanjut ke bagian "Functional Requirement Details" per fitur dalam format User Story + Acceptance Criteria super detail (lihat referensi quotation `impala-pertacomm-effort-estimation` untuk pola itu) — dipakai saat PRD level tinggi ini butuh diturunkan ke spesifikasi teknis siap-QA dalam dokumen yang sama.
