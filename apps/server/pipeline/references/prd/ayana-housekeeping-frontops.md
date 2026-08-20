# [Product] — PRD

Prepared by: Etalas · Date: [date] · Version: Draft v0.1

## 1. Executive Summary

3 paragraf pendek: (1) konteks industri klien + kenapa operational excellence krusial buat brand mereka, (2) kondisi tool existing saat ini dan kenapa itu cuma "partial solution" (nama tool existing boleh disebut, tapi jelaskan keterbatasannya — biasanya jadi data-entry tool doang, bukan command center; proses manual lewat WhatsApp/verbal jadi sumber inkonsistensi), (3) satu kalimat penutup yang menyimpulkan kebutuhan platform baru dan manfaat utamanya (single source of truth, kolaborasi lintas departemen, respons lebih cepat).

## 2. Strategic Context

### 2.1 [Industri] Trend
Bullet list tren industri terkini yang relevan (personalisasi real-time, mobile-first operations, SLA-driven workflow, data-driven decision making) — tiap bullet **bold label** + 1 kalimat elaborasi.

### 2.2 [Klien]'s Competitive Imperative
Bullet list argumen kenapa klien spesifik butuh ini SEKARANG (ekspektasi pelanggan naik, kompleksitas properti/operasi bertambah, efisiensi biaya tenaga kerja krusial karena double-entry manual).

## 3. As-Is Process Overview

Per proses inti (misal: penanganan komplain, operasional harian): numbered steps kondisi SEKARANG (siapa melakukan apa, pakai tool apa), diikuti **Pain Points** sebagai bullet list singkat dan konkret (bukan generik).

## 4. Target Personas

Tabel: Persona | Key Goals | Pain Points | Device/Environment — satu baris per role, ringkas 1 baris per kolom. Personas termasuk level operasional (staf lapangan) sampai level manajemen (GM/Ops Director) yang butuh dashboard, bukan cuma end-user.

## 5. Detailed Problem Statement

Bullet list masalah, masing-masing **bold label singkat** diikuti 1 kalimat penjelasan dampaknya (operational inefficiency, training complexity, delayed resolution, manual handover risk, limited visibility, system performance issues, no SLA enforcement).

## 6. Future-State Vision

Ditulis sebagai narasi "Imagine this:" — 1-2 skenario konkret berupa alur sebab-akibat pendek dihubungkan tanda "→" (trigger → sistem bereaksi → hasil), lalu ditutup satu kalimat tagline produk (mis. "This is [ProductName] 2.0 — fast, connected, data-driven.").

## 7. Functional Requirements (Detailed)

Dikelompokkan per modul (mis. 7.1 Complaints & Requests, 7.2 Room/Task Assignment, 7.3 Handover & Communication, 7.4 Reporting & Analytics), tiap modul berupa bullet list kapabilitas konkret.

### 7.5 Scope & Boundaries
**In-Scope** — bullet list modul yang masuk delivery, ditulis spesifik (bukan cuma nama modul, tapi mekanismenya — mis. "Bi-directional integration for status, traces, and queue flags").
**Out of Scope** — bullet list eksplisit yang SENGAJA tidak masuk, dengan alasan singkat kalau perlu (mis. "hanya basic sync", "kecuali dibutuhkan defect reporting").

## 8. Non-Functional Requirements (Expanded)

Bullet list per kategori dengan **bold label**: Performance (angka target response time), Reliability (uptime %), Security (RBAC, audit logging, encryption in transit & at rest), Localization (bahasa yang didukung + rencana ekspansi), Scalability (target jumlah properti/concurrent user).

## 9. Implementation Roadmap

Tabel: Phase | Deliverables — dipecah Phase 1 (MVP) → Phase 2 (integrasi + analytics) → Phase 3 (multi-property/AI-driven insights).

## 10. Change Management Plan

Bullet list dengan **bold label**: Stakeholder buy-in (demo awal ke user kunci), Training sessions (hands-on per role), Phased rollout (mulai satu departemen/properti dulu), Feedback loop (check-in rutin pasca-launch).

## 11. Governance & Maintenance

Bullet list singkat: siapa jadi single point of accountability di sisi klien, proses change request pasca go-live, jadwal review analitik berkala.

## 12. Risks & Mitigation (Detailed)

Tabel: Risk | Likelihood | Impact | Mitigation — Likelihood dan Impact dinilai terpisah (Low/Medium/High), bukan digabung jadi satu skala.

## 13. Success Measurement Framework

Bullet list dikelompokkan per kategori **bold label**: Operational KPIs, Guest/Customer Experience KPIs, Adoption Metrics, Business Metrics (masing-masing 1-2 metrik konkret).

## 14. Pre-Workshop User Confirmation Questions

Ini section KHAS dan bernilai tinggi — daftar pertanyaan klarifikasi yang TERSTRUKTUR PER KATEGORI (bukan daftar flat), untuk dibawa ke workshop dengan klien SEBELUM development mulai:
- **A. Business Goals & Success Metrics (Strategic)** — pertanyaan soal top objectives, definisi sukses dari sisi manajemen, target finansial.
- **B. Process Understanding & Current Gaps** — proses spesifik apa yang mau didigitalkan, volume transaksi harian/mingguan, peak load period.
- **C. User Roles & Permissions** — konfirmasi daftar role, siapa punya approval authority, data sensitif apa yang perlu dibatasi.
- **D. Integration Requirements** — level integrasi ke sistem existing (read-only vs bi-directional), kebutuhan compliance/data residency.
- **E. UX & Mobile Considerations** — device yang dipakai staf, area blank-spot konektivitas, kebutuhan multilingual/accessibility.
- **F. Notifications & Escalations** — event apa yang trigger alert real-time, channel notifikasi yang disukai, aturan eskalasi berjenjang.

Tiap pertanyaan ditulis SPESIFIK dan actionable — bukan pertanyaan umum "apa kebutuhan Anda", tapi hal yang jawabannya langsung menentukan keputusan desain/arsitektur.

## Appendix — Vocabulary / Glossary

Tabel: Term/Singkatan | Full Form | Description — WAJIB ada kalau domain klien banyak istilah/singkatan internal (istilah operasional, nama role, status codes). Ini memastikan dokumen bisa dibaca tim lain tanpa perlu tanya-tanya istilah.
