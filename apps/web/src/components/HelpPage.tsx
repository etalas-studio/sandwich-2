import { useState } from 'react'
import { useLanguage } from '../lib/i18n'

const HELP_SECTIONS = [
  {
    title: { en: 'Getting Started', id: 'Memulai' },
    icon: 'solar:rocket-2-linear',
    items: [
      {
        q: { en: 'What is SANDWICH?', id: 'Apa itu SANDWICH?' },
        a: { en: 'SANDWICH is an AI pipeline that generates technical documents (PRD, MOM, Quotation, Specs) from client briefs automatically. Text input → ready-to-use document output.', id: 'SANDWICH adalah pipeline AI untuk membuat dokumen teknis (PRD, MOM, Quotation, Specs) dari brief klien secara otomatis. Input teks → output dokumen siap pakai.' },
      },
      {
        q: { en: 'How do I create my first document?', id: 'Bagaimana cara membuat dokumen pertama?' },
        a: { en: 'Type your brief in the main input, choose a document type, then press Enter or click Send. The AI will process and generate a document in seconds.', id: 'Ketik brief di kolom input utama, pilih tipe dokumen, lalu tekan Enter atau klik Send. AI akan memproses dan menghasilkan dokumen dalam beberapa detik.' },
      },
      {
        q: { en: "What's the difference between PRD, MOM, Quotation, and Specs?", id: 'Apa bedanya PRD, MOM, Quotation, dan Specs?' },
        a: { en: 'PRD: Product Requirements Document for new features. MOM: Minutes of Meeting. Quotation: project cost estimation. Specs & Task: technical breakdown and task list.', id: 'PRD: Product Requirements Document untuk fitur baru. MOM: Minutes of Meeting untuk notulen rapat. Quotation: estimasi biaya proyek. Specs & Task: breakdown teknis dan task list.' },
      },
    ],
  },
  {
    title: { en: 'Features', id: 'Fitur' },
    icon: 'solar:widget-2-linear',
    items: [
      {
        q: { en: 'How are documents saved?', id: 'Bagaimana cara menyimpan dokumen?' },
        a: { en: 'Documents are saved automatically to My Briefs after AI finishes processing. No manual save needed.', id: 'Dokumen tersimpan otomatis ke My Briefs setelah AI selesai memproses. Tidak perlu save manual.' },
      },
      {
        q: { en: 'What are chips / quick prompts?', id: 'Chips/quick prompt itu apa?' },
        a: { en: 'Chips are ready-made short prompts that appear below the input. Click one to auto-fill the input field with a template.', id: 'Chips adalah prompt singkat siap pakai yang muncul di bawah input. Klik salah satu untuk otomatis mengisi kolom input dengan template.' },
      },
      {
        q: { en: 'Is my data safe?', id: 'Apakah data saya aman?' },
        a: { en: 'Documents are stored in your browser\'s localStorage. Nothing is sent to the server except during AI processing.', id: 'Dokumen disimpan di localStorage browser Anda. Tidak dikirim ke server kecuali saat proses AI berlangsung.' },
      },
    ],
  },
  {
    title: { en: 'Troubleshooting', id: 'Troubleshooting' },
    icon: 'solar:danger-triangle-linear',
    items: [
      {
        q: { en: "Document doesn't appear after submit?", id: 'Dokumen tidak muncul setelah submit?' },
        a: { en: 'Try refreshing the page. If it still doesn\'t appear, check your internet connection and try submitting again.', id: 'Coba refresh halaman. Jika masih tidak muncul, pastikan koneksi internet stabil dan coba submit ulang.' },
      },
      {
        q: { en: 'AI is responding slowly?', id: 'AI lambat merespons?' },
        a: { en: 'Processing time depends on brief length and server load. Shorter briefs are usually processed faster.', id: 'Waktu proses bergantung pada panjang brief dan beban server. Brief yang lebih singkat biasanya lebih cepat diproses.' },
      },
      {
        q: { en: 'How do I delete a document?', id: 'Bagaimana cara menghapus dokumen?' },
        a: { en: 'Open the document from My Briefs or the type page, click the delete icon, then confirm deletion.', id: 'Buka dokumen dari My Briefs atau halaman tipe, klik ikon hapus, lalu konfirmasi penghapusan.' },
      },
    ],
  },
  {
    title: { en: 'Plans & Subscription', id: 'Paket & Langganan' },
    icon: 'solar:card-linear',
    items: [
      {
        q: { en: "What's the difference between Starter and Pro?", id: 'Apa perbedaan Starter dan Pro?' },
        a: { en: 'Starter: 5 PRDs/month + basic features. Pro: unlimited PRDs, unlimited AI chat, direct access to the Etalas team.', id: 'Starter: 5 PRD/bulan + fitur dasar. Pro: unlimited PRD, chat AI unlimited, akses langsung ke tim Etalas.' },
      },
      {
        q: { en: 'How do I upgrade to Pro?', id: 'Bagaimana cara upgrade ke Pro?' },
        a: { en: 'Click the "Upgrade to PRO" button in the left sidebar. You\'ll be taken to the payment page.', id: 'Klik tombol "Upgrade ke PRO" di sidebar kiri. Anda akan diarahkan ke halaman pembayaran.' },
      },
      {
        q: { en: 'Is there a free trial?', id: 'Apakah ada free trial?' },
        a: { en: 'Starter is free forever with limited quota. There\'s no paid trial — you can start right away with Starter.', id: 'Starter gratis selamanya dengan kuota terbatas. Tidak ada trial berbayar — Anda bisa langsung coba dengan Starter.' },
      },
    ],
  },
]

const QUICK_LINKS = [
  { icon: 'solar:chat-round-dots-linear', label: { en: 'Chat with Team', id: 'Chat dengan Tim' }, sub: { en: 'Contact support directly', id: 'Hubungi support langsung' } },
  { icon: 'solar:book-linear', label: { en: 'Documentation', id: 'Dokumentasi' }, sub: { en: 'Full guide', id: 'Panduan lengkap' } },
  { icon: 'solar:video-frame-play-horizontal-linear', label: { en: 'Video Tutorial', id: 'Video Tutorial' }, sub: { en: 'Step-by-step visual', id: 'Step-by-step visual' } },
  { icon: 'solar:stars-linear', label: { en: 'Changelog', id: 'Changelog' }, sub: { en: 'Latest updates', id: 'Update terbaru' } },
]

export default function HelpPage() {
  const { lang } = useLanguage()
  const [open, setOpen] = useState<string | null>(null)
  const L = (s: { en: string; id: string }) => s[lang]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px', backgroundColor: '#f4ebe1' }}>
      <div style={{ maxWidth: '672px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ color: '#1a1a1a', fontFamily: "'Bowlby One', system-ui", fontSize: '22px', letterSpacing: '-0.03em', margin: 0 }}>
            HELP & DOCS
          </h1>
          <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '13px', marginTop: '4px' }}>
            {lang === 'id' ? 'Panduan penggunaan SANDWICH' : 'SANDWICH usage guide'}
          </p>
        </div>

        {/* Quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
          {QUICK_LINKS.map(({ icon, label, sub }) => (
            <button
              key={label.en}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
                borderRadius: '12px', textAlign: 'left', cursor: 'pointer',
                backgroundColor: '#0a0a0a', border: '1px solid #0a0a0a',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(249,24,20,0.2)',
              }}>
                <iconify-icon icon={icon} width="18" style={{ color: '#f91814' }} />
              </div>
              <div>
                <p style={{ color: '#ffffff', fontSize: '13px', fontWeight: 600, margin: 0 }}>{L(label)}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0 }}>{L(sub)}</p>
              </div>
            </button>
          ))}
        </div>

        {/* FAQ accordion */}
        {HELP_SECTIONS.map((section) => (
          <div key={section.title.en} style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <iconify-icon icon={section.icon} width="13" style={{ color: 'rgba(0,0,0,0.4)' }} />
              <span style={{ color: '#1a1a1a', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {L(section.title)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {section.items.map((item, i) => {
                const itemKey = `${section.title.en}-${i}`
                const isOpen = open === itemKey
                return (
                  <div key={itemKey} style={{ borderRadius: '10px', overflow: 'hidden', backgroundColor: '#0a0a0a' }}>
                    <button
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 20px', textAlign: 'left', cursor: 'pointer',
                        backgroundColor: isOpen ? 'rgba(255,255,255,0.04)' : 'transparent',
                        border: 'none', transition: 'background-color 0.15s',
                      }}
                      onClick={() => setOpen(isOpen ? null : itemKey)}
                      onMouseEnter={e => { if (!isOpen) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = isOpen ? 'rgba(255,255,255,0.04)' : 'transparent' }}
                    >
                      <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 500, paddingRight: '16px' }}>{L(item.q)}</span>
                      <iconify-icon
                        icon={isOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                        width="14"
                        style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}
                      />
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 20px 16px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>{L(item.a)}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Contact banner */}
        <div style={{
          marginTop: '32px', padding: '20px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '16px',
          backgroundColor: '#0a0a0a', border: '1px solid #0a0a0a',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#f91814',
          }}>
            <iconify-icon icon="solar:chat-round-dots-bold" width="18" style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#ffffff', fontSize: '13px', fontWeight: 600, margin: 0 }}>
              {lang === 'id' ? 'Butuh bantuan lebih?' : 'Need more help?'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px', marginBottom: 0 }}>
              {lang === 'id' ? 'Tim kami siap membantu via chat langsung.' : 'Our team is ready to help via live chat.'}
            </p>
          </div>
          <button style={{
            flexShrink: 0, padding: '8px 16px', borderRadius: '999px',
            backgroundColor: '#f91814', color: '#fff',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
            transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {lang === 'id' ? 'Hubungi Kami' : 'Contact Us'}
          </button>
        </div>
      </div>
    </div>
  )
}
