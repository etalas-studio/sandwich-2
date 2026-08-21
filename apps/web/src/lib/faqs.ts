export const FAQS = [
  {
    q: { en: 'What can SANDWICH actually produce?', id: 'SANDWICH sebenarnya bisa menghasilkan apa?' },
    a: {
      en: 'From a single client brief: a complete PRD (with user flows and technical notes built in), a clickable prototype, feature specs, and a client-ready quotation — all generated through one pipeline, not five separate tools.',
      id: 'Dari satu brief klien: PRD lengkap (dengan user flow dan technical notes), prototype yang bisa diklik, feature specs, dan quotation siap kirim ke klien — semua di-generate lewat satu pipeline, bukan lima tools terpisah.',
    },
  },
  {
    q: { en: 'Can it turn a messy brief into a PRD?', id: 'Bisa mengubah brief berantakan jadi PRD?' },
    a: {
      en: "Yes — that's the core job. SANDWICH takes raw, chaotic client input and structures it into a validated, machine-checkable PRD an AI agent can execute against, no guessing required.",
      id: 'Bisa — itu tugas utamanya. SANDWICH mengambil input mentah dan berantakan dari klien lalu menyusunnya jadi PRD yang tervalidasi dan machine-checkable, siap dieksekusi AI agent tanpa perlu menebak-nebak.',
    },
  },
  {
    q: { en: 'Does it build prototypes too, or just docs?', id: 'Bisa bikin prototype juga, atau cuma dokumen?' },
    a: {
      en: 'Both. The same pipeline that produces the PRD also drives prototype generation, so you show the client something that matches what gets built — no drift between spec and demo.',
      id: 'Keduanya. Pipeline yang sama yang menghasilkan PRD juga menggerakkan pembuatan prototype, jadi yang kamu tunjukkan ke klien sesuai dengan yang akan dibangun — tidak ada gap antara spec dan demo.',
    },
  },
  {
    q: { en: 'How does the quotation get generated?', id: 'Bagaimana quotation dibuat?' },
    a: {
      en: 'Once the scope is defined, SANDWICH breaks it into priced, dependency-aware line items — so the quotation is grounded in actual scope, not a guess.',
      id: 'Setelah scope ditentukan, SANDWICH memecahnya jadi item-item dengan harga dan dependency yang jelas — jadi quotation didasarkan pada scope sebenarnya, bukan tebakan.',
    },
  },
  {
    q: { en: 'Is it free?', id: 'Apakah gratis?' },
    a: {
      en: 'Starter is free: 5 documents and 3 prototypes per month, plus 100 AI chat messages. Pro is Rp 100.000/month: unlimited everything.',
      id: 'Starter gratis: 5 dokumen dan 3 prototype per bulan, plus 100 pesan chat AI. Pro Rp 100.000/bulan: unlimited semuanya.',
    },
  },
] satisfies Array<{ q: { en: string; id: string }; a: { en: string; id: string } }>
