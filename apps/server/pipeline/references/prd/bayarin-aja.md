# Product Requirements Document

Project Name: [project] · Version: 1.0 · Last Updated: [date] · Prepared by: Etalas Product Team

## 1. Overview

**Context:** 1-2 kalimat tentang situasi pasar/user existing yang menciptakan celah/masalah.
**Problem:** bullet list masalah konkret, termasuk kenapa solusi existing (kompetitor) tidak cukup (mis. biaya terlalu tinggi, tidak ada fitur X).
**Solution:** 1 kalimat pembuka "Build a [nama kategori produk] where:" diikuti bullet list mekanisme inti secara berurutan (step-like, bukan daftar fitur random).

## 2. Goals and Success Metrics

Tabel dua kolom: Goal | Metric — setiap goal bisnis punya metric kuantitatif berpasangan langsung di sebelahnya (bukan dipisah section).

## 3. User Roles

Daftar role bernomor simple (Buyer, Seller, Admin, dst) — tanpa deskripsi panjang di section ini, deskripsi ditaruh di journey.

### 3.1 User Journey

Per role: journey ditulis sebagai numbered steps, tiap step punya sub-bullet detail (apa yang terjadi, siapa dinotifikasi, apa syaratnya). Mencakup step opsional (mis. "Review & Rating (Optional)") jika relevan.

### 3.2 Admin Dashboard

Bullet list nama-nama panel/fitur admin level tinggi (Verification Panel, Ledger, Dispute Center, Analytics) — bukan detail acceptance criteria, itu ditaruh di section fitur.

## 4. Features & Tasks (Detailed by Flow)

Dikelompokkan per flow besar (A, B, C, ...). Tiap task individual ditulis dengan format konsisten:
- **Task: [nama aksi]**
  - **Context:** siapa dan kenapa butuh ini
  - **Problem:** apa yang terjadi kalau task ini tidak ada
  - **DoD (Definition of Done):** bullet list kondisi teknis konkret — field input, status transition, siapa dinotifikasi, format data

Edge case & exception handling ditulis sebagai section tersendiri di akhir grup flow (contoh: "Buyer Doesn't Confirm Receipt?", "Seller Fails to Ship?") — pertanyaan sebagai heading, jawaban sebagai bullet mitigasi.

## 5. Buyer/Seller Dashboard (matrix fitur per role)

Tabel: Feature | Role A | Role B — pakai checkmark/cross untuk menunjukkan siapa punya akses ke apa. Ditutup dengan "Main Data Points" — bullet field-field kunci yang tampil di dashboard.

## 6. Admin Dashboard

Tabel dua kolom: Feature | Description.

## 7. System Architecture Overview

Tabel dua kolom: Component | Stack — hanya nama teknologi per layer (Frontend, Backend/API, Database, Auth, File Storage, Payment Gateway, Notifications, Hosting), tanpa justifikasi panjang.

## 8. Integration Touchpoints

Tabel: Integration | Purpose | Direction (Inbound/Outbound/Webhook) | Notes.

## 9. Data Models (MVP Level)

Per entity, nama entity sebagai heading, lalu satu baris daftar field (id, field1, field2, ...) — level ringkas, bukan skema DB penuh.

## 10. MVP Scope Clarification

Tabel dua kolom: Feature | Included in MVP? (checkmark/cross) — daftar semua fitur yang dibahas sebelumnya plus yang sengaja dikeluarkan, biar scope MVP eksplisit dan tidak ambigu.

## 11. Suggested Estimation Breakdown Format

Tabel: Task | Subtasks | Estimation (days) — placeholder "x" pada kolom angka kalau estimasi belum difinalisasi tim delivery.

## 12. Non-Functional Requirements

Tabel dua kolom: Area | Details (Performance, Security, Reliability, Audit Logs, Uptime).

## 13. Proposal Narrative (for Business Team)

Satu paragraf ringkas versi "elevator pitch" dari seluruh PRD — ditulis untuk audiens non-teknis (bisnis/stakeholder), bukan mengulang detail teknis.

## 14. Branding Note (opsional)

Kalau nama produk perlu dijustifikasi: breakdown arti nama + alasan (mudah diingat, sesuai tone lokal), plus daftar nama alternatif yang dipertimbangkan.
