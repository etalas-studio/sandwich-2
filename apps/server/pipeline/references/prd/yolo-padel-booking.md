# Product Requirements Document (PRD)

Project Name: [project] · Prepared For: [Client] · Prepared By: Etalas · Version: 1.0 · Date: [date]

## 1. Overview

Paragraf pembuka: konteks bisnis klien (berapa lokasi/unit, fasilitas apa yang ditawarkan), lalu bullet list alur pengalaman pengguna end-to-end secara singkat (pilih lokasi → pilih slot → isi data kontak → pilih metode bayar → bayar → terima konfirmasi).

Paragraf kedua: strategi bertahap — Phase 1 pakai integrasi API pihak ketiga existing (sebutkan nama platform + fungsinya) untuk exposure/management, Phase 2 baru migrasi ke sistem yang dimiliki sendiri (data ownership, loyalty program, membership, custom pricing rules).

## 2. Business Requirements

Tabel dua kolom: Requirement | Details — tiap requirement bisnis level tinggi (bukan fitur teknis) dengan detail 1 kalimat, mencakup: dukungan multi-lokasi, integrasi pihak ketiga fase 1, custom payment UI (tanpa redirect), rencana migrasi data ownership fase 2, pencegahan fraud/double-booking, kanal revenue, strategi retensi pelanggan.

## 3. Functionality Requirements

### 3.1 End-User Website
Numbered list kelompok fitur (Site & Court/Unit Selection, Booking Flow, User Information Capture, Payment Process, Confirmation & Notifications), masing-masing dengan sub-bullet detail konkret (real-time availability dari API, field mandatory vs optional, metode pembayaran yang didukung, channel notifikasi konfirmasi — WhatsApp & email — beserta isi datanya).

### 3.2 Admin Dashboard
Numbered list kelompok fitur admin (Resource/Slot Management, Booking Management, Payment Management, User Management, API Integration Controls) dengan sub-bullet konkret termasuk kontrol sync manual ke sistem pihak ketiga.

## 4. User Experience (UX) Requirements

Tabel dua kolom: Area | UX Goals — mencakup Website (mobile-first, cepat), Booking Flow (batasi jumlah step maksimal secara eksplisit, mis. "Max 4 steps"), Payment (in-page modal, hindari drop-off), Notifications (instan), Admin Dashboard (intuitif untuk staf non-teknis).

## 5. Scope

**In Scope (Phase 1)** — bullet list ringkas: website booking customer-facing, integrasi API pihak ketiga, integrasi payment gateway dengan custom UI, admin dashboard, otomasi konfirmasi WhatsApp & email.

**Out of Scope (Phase 1)** — bullet list eksplisit yang jelas ditunda ke Phase 2 (booking engine sendiri, loyalty/membership/VIP pricing, multi-language, in-app upselling).

## 6. Risks & Mitigation

Tabel tiga kolom: Risk | Impact | Mitigation — Impact pakai skala sederhana (High/Medium), tiap mitigasi ditulis sebagai aksi teknis konkret (real-time API sync + lock slot langsung setelah dipilih; payment status check + retry + manual confirmation fallback; graceful error handling + backup manual form kalau API down).

## 7. Success Metrics

Bullet list metrik dengan angka target eksplisit dan cara ukurnya jelas (% booking selesai tanpa intervensi manual, % uptime sistem booking & payment, % kasus double-booking maksimal, % conversion rate dari mulai booking sampai bayar).
