'use client'

import LegalPage from '../../components/LegalPage'

export default function Page() {
  return (
    <LegalPage
      title={{ en: 'Refund Policy', id: 'Kebijakan Refund' }}
      updated="August 20, 2026"
      sections={[
        {
          heading: { en: 'Starter plan', id: 'Paket Starter' },
          body: [
            {
              en: "Starter is free — there is nothing to refund.",
              id: 'Starter gratis — tidak ada yang perlu di-refund.',
            },
          ],
        },
        {
          heading: { en: 'Pro plan', id: 'Paket Pro' },
          body: [
            {
              en: 'If a Pro payment is charged but never confirmed as successful (e.g. a failed or duplicate charge), we will refund it in full once verified — email support@etalas.ai with your account email and payment reference.',
              id: 'Jika pembayaran Pro tertagih tapi tidak pernah terkonfirmasi berhasil (misalnya charge gagal atau duplikat), kami akan me-refund penuh setelah terverifikasi — email support@etalas.ai dengan email akun dan referensi pembayaran kamu.',
            },
            {
              en: 'Pro is billed per period in advance. We do not prorate or refund partial periods for unused time — cancelling stops future renewal, and access continues until the current period ends.',
              id: 'Pro ditagih per periode di muka. Kami tidak memberikan prorate atau refund parsial untuk waktu yang belum terpakai — pembatalan menghentikan perpanjangan berikutnya, dan akses tetap berlaku hingga periode berjalan berakhir.',
            },
            {
              en: "If you believe your situation warrants an exception (e.g. you upgraded by mistake and haven't used the plan), email us — we review these on a case-by-case basis.",
              id: 'Jika menurut kamu situasimu layak dapat pengecualian (misalnya salah upgrade dan belum sempat menggunakan paketnya), kirim email ke kami — kami tinjau kasus per kasus.',
            },
          ],
        },
        {
          heading: { en: 'How to request', id: 'Cara mengajukan' },
          body: [
            {
              en: 'Email support@etalas.ai from your account email with the payment date and amount. We aim to respond within 2 business days and, once approved, process refunds to the original payment method within 7 business days.',
              id: 'Email support@etalas.ai dari email akun kamu dengan tanggal dan jumlah pembayaran. Kami berusaha merespons dalam 2 hari kerja dan, setelah disetujui, memproses refund ke metode pembayaran semula dalam 7 hari kerja.',
            },
          ],
        },
      ]}
    />
  )
}
