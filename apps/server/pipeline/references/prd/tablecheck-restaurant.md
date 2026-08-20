# [Product] — Product Requirements Document

Updated: [date]

## 1. Problem & Objective Clarification

**Problem** — bullet list, boleh menyertakan angka biaya/kerugian konkret dari status quo (mis. biaya lisensi pihak ketiga per bulan) dan dampak operasional (kompleksitas, waktu respons lebih lambat) akibat memakai banyak tools.

**Objective** — 1 kalimat pembuka ("Build an in-house, API-first platform—fully integrated with [existing systems]—to:") diikuti numbered list tujuan konkret dan terukur (target %, target waktu).

**Scope Boundaries** — 1 paragraf eksplisit: siapa yang dilayani (dengan proporsi %), apa yang DIKECUALIKAN secara sengaja, dan interface mana yang jadi fokus utama vs mana yang cuma dipakai tanpa diubah.

**Success Metrics** — bullet list target terukur dengan angka eksplisit dan cara pengukurannya (mis. survey pre/post-launch).

## 2. User Personas & Journeys

Per persona: nama peran + 1 kalimat konteks (siapa mereka, device apa yang dipakai, tekanan kerja seperti apa), lalu:
- Deskripsi singkat tugas utama
- **Key journey steps** — numbered list singkat (①②③...), tiap step 2-4 kata
- **Pain Point** — 1 kalimat masalah spesifik dengan tooling existing
- **Edge Cases** — bullet list situasi tepi yang harus ditangani desain (group booking besar, walk-in saat overbooked, kondisi offline, dll)

Ditutup dengan **User Stories (Examples)** — 2-3 contoh format "As a [role], I want [goal], so [benefit]" dan catatan transparan bila ada bagian yang masih perlu divalidasi lewat riset lanjutan (mis. "we still need to refine personas via user workshops").

## 3. Feature Enhancements

Disajikan sebagai tabel perbandingan terhadap solusi lama (vs. incumbent), dengan progresi dua level detail:

Level ringkas: Epic | Enhancement | Priority (P0/P1/P2) | Notes

Level detail (lanjutan tabel yang sama, kolom ditambah): Epic | Enhancement | Priority | Rationale | Acceptance Criteria | Dependencies

Prioritas P0 dipakai untuk fitur yang jadi syarat migrasi dasar (parity dengan sistem lama); P1 untuk fitur nilai tambah; P2 untuk nice-to-have yang bisa ditunda.

## 4. Technical Considerations

Bullet list dikelompokkan per topik non-fungsional: Architecture, Performance (angka target response time, concurrent session), Availability (uptime %, deployment topology), Usability & Accessibility (bahasa, device target), Integrations (arah data — inbound/outbound/webhook), Security & Compliance (standar yang diacu: TLS versi, OWASP Top-10, WCAG), Scalability (angka throughput target), Logging & Monitoring, **Migration Strategy** (fase: dual-write → pilot di satu lokasi/segmen → cut-over penuh, masing-masing dengan target waktu T+n minggu), Testing & Deployment, **Open Technical Items** (keputusan yang masih pending dengan deadline eksplisit "decide by T+n weeks"), Assumptions, dan **Risks & Mitigations** (tabel Risk | Mitigation).

## Appendices

- Glossary — istilah domain-spesifik yang dipakai berulang di dokumen, didefinisikan singkat.
- References — standar/guideline eksternal yang diacu (mis. OWASP Top-10, WCAG checklist).
- Catatan visual — placeholder eksplisit untuk wireframe/diagram arsitektur yang akan dilampirkan di dokumen final, ditandai jelas sebagai belum final.
