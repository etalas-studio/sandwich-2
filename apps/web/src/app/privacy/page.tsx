'use client'

import LegalPage from '../../components/LegalPage'

export default function Page() {
  return (
    <LegalPage
      title={{ en: 'Privacy Policy', id: 'Kebijakan Privasi' }}
      updated="August 20, 2026"
      sections={[
        {
          heading: { en: 'What we collect', id: 'Apa yang kami kumpulkan' },
          body: [
            {
              en: 'Account data: your username, email address, and password (stored as a salted hash, never in plain text).',
              id: 'Data akun: username, alamat email, dan password (disimpan sebagai salted hash, tidak pernah dalam bentuk teks biasa).',
            },
            {
              en: 'Brief and document content: the client briefs you submit, and the PRDs, prototypes, specs, and quotations SANDWICH generates from them. Before you sign up, a brief you type on the landing page is saved only in your browser\'s local storage (as "sandwich_draft") so it survives the redirect into registration. It is not sent to our servers until you have an account.',
              id: 'Konten brief dan dokumen: brief klien yang kamu kirim, serta PRD, prototype, specs, dan quotation yang dihasilkan SANDWICH darinya. Sebelum kamu mendaftar, brief yang kamu ketik di landing page hanya disimpan di local storage browser kamu (sebagai "sandwich_draft") agar tetap ada saat diarahkan ke halaman registrasi. Data ini belum dikirim ke server kami sampai kamu punya akun.',
            },
            {
              en: 'Usage and billing data: document/prototype/chat counts against your monthly quota, subscription plan and status, and payment confirmation state (we do not store your card or bank details; payments are processed by our payment provider).',
              id: 'Data penggunaan dan billing: jumlah dokumen/prototype/chat terhadap kuota bulanan kamu, paket dan status langganan, serta status konfirmasi pembayaran (kami tidak menyimpan detail kartu atau rekening bank kamu; pembayaran diproses oleh payment provider kami).',
            },
          ],
        },
        {
          heading: { en: 'How we use it', id: 'Bagaimana kami menggunakannya' },
          body: [
            {
              en: 'To generate your documents and prototypes, including sending your brief content to third-party AI model providers strictly to produce your requested output.',
              id: 'Untuk menghasilkan dokumen dan prototype kamu, termasuk mengirim konten brief kamu ke penyedia model AI pihak ketiga semata-mata untuk menghasilkan output yang kamu minta.',
            },
            {
              en: 'To operate your account: authentication, quota enforcement, plan management, and transactional email (verification, password reset, payment status).',
              id: 'Untuk mengoperasikan akun kamu: autentikasi, penegakan kuota, manajemen paket, dan email transaksional (verifikasi, reset password, status pembayaran).',
            },
            {
              en: "We do not sell your brief content or generated documents, and we do not use them to train models beyond what's needed to generate your own output.",
              id: 'Kami tidak menjual konten brief atau dokumen yang kamu hasilkan, dan kami tidak menggunakannya untuk melatih model di luar kebutuhan menghasilkan output kamu sendiri.',
            },
          ],
        },
        {
          heading: { en: 'Who we share it with', id: 'Dengan siapa kami membagikannya' },
          body: [
            {
              en: 'Infrastructure and processing partners strictly needed to run SANDWICH: hosting/database providers, the AI model providers that generate your documents, and our payment provider for checkout. Each only receives what it needs to perform its function.',
              id: 'Mitra infrastruktur dan pemrosesan yang benar-benar dibutuhkan untuk menjalankan SANDWICH: penyedia hosting/database, penyedia model AI yang menghasilkan dokumen kamu, dan payment provider untuk checkout. Masing-masing hanya menerima data yang diperlukan untuk menjalankan fungsinya.',
            },
            {
              en: 'We do not sell personal data to third parties, and we only disclose it further if required by law.',
              id: 'Kami tidak menjual data pribadi ke pihak ketiga, dan hanya membukanya lebih lanjut jika diwajibkan oleh hukum.',
            },
          ],
        },
        {
          heading: { en: 'Your rights and choices', id: 'Hak dan pilihan kamu' },
          body: [
            {
              en: 'You can request an export or deletion of your account and its documents at any time by emailing support@etalas.ai. We will confirm and act on verified requests within a reasonable time.',
              id: 'Kamu bisa meminta export atau penghapusan akun beserta dokumennya kapan saja dengan email ke support@etalas.ai. Kami akan mengonfirmasi dan memproses permintaan yang terverifikasi dalam waktu yang wajar.',
            },
            {
              en: 'You can clear the local "sandwich_draft" entry at any time by clearing your browser storage for this site.',
              id: 'Kamu bisa menghapus entri lokal "sandwich_draft" kapan saja dengan membersihkan storage browser untuk situs ini.',
            },
          ],
        },
        {
          heading: { en: 'Contact', id: 'Kontak' },
          body: [
            {
              en: 'Questions about this policy? Email support@etalas.ai.',
              id: 'Ada pertanyaan tentang kebijakan ini? Email support@etalas.ai.',
            },
          ],
        },
      ]}
    />
  )
}
