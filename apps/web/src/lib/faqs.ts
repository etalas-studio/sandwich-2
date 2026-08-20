import type { Lang } from './i18n'

export interface FaqItem {
  q: string
  a: string
}

export const FAQS: Record<Lang, FaqItem[]> = {
  en: [
    {
      q: 'What can SANDWICH produce?',
      a: 'PRDs, client-ready quotations, live prototypes, and software specs. Each deliverable is generated one at a time and saved with version history.',
    },
    {
      q: 'Can it turn a messy brief into a PRD?',
      a: 'Yes. Add rough notes first; SANDWICH then asks focused questions before generating a structured PRD with requirements, user flows, and technical notes.',
    },
    {
      q: 'Can I upload voice notes, screenshots, and documents?',
      a: 'Yes, after login. The workspace accepts image, audio, PDF, and DOCX attachments. The public landing prompt accepts text and preserves it through signup.',
    },
    {
      q: 'How does the generation flow work?',
      a: 'Drop a brief, choose a deliverable, answer clarifying questions, then generate. You can revise the saved document later without losing earlier versions.',
    },
    {
      q: 'How much does it cost?',
      a: 'Starter is Rp 50.000 for 30 days with 5 generated PRDs and 100 AI chat messages per month. Pro is Rp 100.000 for 30 days with unlimited documents and chat.',
    },
  ],
  id: [
    {
      q: 'SANDWICH bisa menghasilkan apa saja?',
      a: 'PRD, quotation siap kirim ke klien, prototype live, dan software specs. Setiap deliverable dibuat satu per satu dan disimpan dengan riwayat versi.',
    },
    {
      q: 'Bisa mengubah brief berantakan jadi PRD?',
      a: 'Bisa. Masukkan catatan kasar dulu; SANDWICH akan mengajukan pertanyaan terarah sebelum membuat PRD terstruktur berisi requirement, user flow, dan catatan teknis.',
    },
    {
      q: 'Bisa upload voice note, screenshot, dan dokumen?',
      a: 'Bisa, setelah login. Workspace menerima lampiran gambar, audio, PDF, dan DOCX. Prompt di landing page menerima teks dan menyimpannya selama proses daftar.',
    },
    {
      q: 'Bagaimana alur generate-nya?',
      a: 'Masukkan brief, pilih deliverable, jawab pertanyaan klarifikasi, lalu generate. Dokumen yang tersimpan bisa direvisi tanpa kehilangan versi sebelumnya.',
    },
    {
      q: 'Berapa harganya?',
      a: 'Starter Rp 50.000 untuk 30 hari dengan 5 PRD hasil generate dan 100 pesan chat AI per bulan. Pro Rp 100.000 untuk 30 hari dengan dokumen dan chat unlimited.',
    },
  ],
}
