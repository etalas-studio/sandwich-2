# Effort Estimation: [Project Name]

Version: 1.0 · Date: [date] · Status: Draft

## Project Summary

Dokumen ini merinci persyaratan fungsional untuk pengembangan fitur-fitur baru [Product]. Setiap fitur dijelaskan dalam format Kisah Pengguna (User Story), Kriteria Penerimaan (Acceptance Criteria), dan perkiraan waktu pengembangan.

## Feature Summary Table

Daftar seluruh fitur/modul bernomor, contoh: Authentication & User Management, Onboarding & Master Data, Target Setting, Data Entry & Evidence, Evidence Verification, Scoring Engine, Submission Frequency & Behavioural Submission, Aggregation & Networking, Approval/Revision & Governance, Notification & Scheduler, Admin & Program Configuration.

## Functional Requirement Details — pola per fitur

Setiap fitur dipecah jadi sub-bagian bernomor (mis. "1.1 – Login"), masing-masing berisi:

**User Story** — ditulis dari sudut pandang role tertentu, format: "Sebagai [role], saya ingin [aksi], sehingga [manfaat/tujuan]."

**Acceptance Criteria** — daftar bullet point yang SANGAT spesifik dan dapat diuji, mencakup:
- Elemen form/UI yang wajib ada (field, tombol, label pesan error persis)
- Aturan validasi input (format, wajib isi, batas panjang/nilai)
- Perilaku sistem pada kondisi sukses maupun gagal (pesan yang ditampilkan, redirect, status yang berubah)
- Aturan keamanan/lock-out bila relevan (contoh: percobaan gagal berulang → kunci akun sekian menit)
- Data apa saja yang harus dicatat sebagai log/audit trail (user, timestamp, before/after value)
- Batas waktu/SLA proses (contoh: link reset berlaku 30 menit, revisi wajib dalam 7 hari)

### Contoh pola — Role Access Control
Setiap role didefinisikan dengan daftar hak akses eksplisit (create/read/update/delete/approve per fitur), dan aturan "menu hanya muncul jika role memiliki izin" + "sistem harus memblokir akses URL langsung (role-based redirect)".

### Contoh pola — Scoring Engine
Untuk indikator numerik: rumus perhitungan achievement dijabarkan eksplisit (misal Achievement % = Realisasi/Target × 100), aturan pembulatan, dan validasi nilai (tidak boleh negatif, apa yang terjadi bila realisasi > target).
Untuk indikator naratif/boolean: skala penilaian, siapa yang mengisi, dan bagaimana nilai masuk ke weighted score total (Weighted Score = Σ(score × weight), total bobot per objective wajib 100%).

### Contoh pola — Revision Workflow
Alur revisi diberi tenggat waktu eksplisit (mis. 7 hari), dengan countdown yang tampil di dashboard user, serta konsekuensi jelas bila lewat tenggat (status berubah ke "Expired", nilai sebelumnya tetap berlaku).

## Gaya dan Struktur Dokumen

- Dokumen ini bukan quotation harga per work package — melainkan breakdown fungsional super-detail per fitur, cocok dipakai saat klien butuh spesifikasi teknis yang bisa langsung diturunkan jadi test case QA.
- Bahasa Indonesia formal-teknis, konsisten menggunakan heading bernomor bertingkat (1, 1.1, 1.2, ...).
- Setiap User Story SELALU diikuti Acceptance Criteria — tidak pernah berdiri sendiri tanpa kriteria yang terukur.
