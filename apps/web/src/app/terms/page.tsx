'use client'

import LegalPage from '../../components/LegalPage'

export default function Page() {
  return (
    <LegalPage
      title={{ en: 'Terms of Service', id: 'Syarat & Ketentuan' }}
      updated="August 20, 2026"
      sections={[
        {
          heading: { en: 'The service', id: 'Layanan' },
          body: [
            {
              en: 'Spectr is operated by Etalas. It turns a client brief into a PRD, clickable prototype, feature specs, and a quotation via an AI-driven pipeline. Generated output is a starting point. Review it before you send it to a client or act on it.',
              id: 'Spectr dioperasikan oleh Etalas. Layanan ini mengubah brief klien menjadi PRD, prototype yang bisa diklik, feature specs, dan quotation lewat pipeline berbasis AI. Output yang dihasilkan adalah titik awal. Periksa dulu sebelum kamu kirim ke klien atau tindak lanjuti.',
            },
          ],
        },
        {
          heading: { en: 'Plans and billing', id: 'Paket dan billing' },
          body: [
            {
              en: 'Starter is free and includes a limited monthly quota of documents, prototypes, and AI chat messages. Pro is a paid monthly subscription with unlimited usage, billed in advance for each billing period.',
              id: 'Starter gratis dan mencakup kuota bulanan terbatas untuk dokumen, prototype, dan pesan chat AI. Pro adalah langganan bulanan berbayar dengan penggunaan unlimited, ditagih di muka untuk setiap periode billing.',
            },
            {
              en: 'Subscriptions renew automatically each period unless cancelled. You can cancel anytime from your account settings; cancellation stops future renewal but does not retroactively refund the current period except as described in our Refund Policy.',
              id: 'Langganan diperpanjang otomatis setiap periode kecuali dibatalkan. Kamu bisa membatalkan kapan saja dari pengaturan akun; pembatalan menghentikan perpanjangan berikutnya tapi tidak me-refund periode berjalan secara otomatis kecuali sesuai Kebijakan Refund kami.',
            },
          ],
        },
        {
          heading: { en: 'Your content', id: 'Konten kamu' },
          body: [
            {
              en: 'You keep ownership of the briefs you submit and the documents Spectr generates for you. You are responsible for having the right to submit any client content you paste into Spectr, and for reviewing generated output before relying on it commercially.',
              id: 'Kamu tetap memiliki brief yang kamu kirim dan dokumen yang dihasilkan Spectr untuk kamu. Kamu bertanggung jawab memastikan kamu punya hak untuk mengirim konten klien apa pun yang kamu tempel ke Spectr, dan untuk memeriksa output sebelum mengandalkannya secara komersial.',
            },
            {
              en: 'You grant us a limited license to process your content solely to operate and improve the generation pipeline for your account.',
              id: 'Kamu memberi kami lisensi terbatas untuk memproses kontenmu semata-mata untuk mengoperasikan dan meningkatkan pipeline generation untuk akun kamu.',
            },
          ],
        },
        {
          heading: { en: 'Acceptable use', id: 'Penggunaan yang wajar' },
          body: [
            {
              en: "Don't use Spectr to generate or distribute unlawful, infringing, or abusive content, attempt to bypass usage quotas or security controls, or resell access without our written agreement.",
              id: 'Jangan gunakan Spectr untuk menghasilkan atau menyebarkan konten ilegal, melanggar hak pihak lain, atau bersifat abusive, mencoba melewati batas kuota atau kontrol keamanan, atau menjual kembali akses tanpa persetujuan tertulis dari kami.',
            },
          ],
        },
        {
          heading: { en: 'Disclaimer and liability', id: 'Penyangkalan dan tanggung jawab' },
          body: [
            {
              en: 'Spectr is provided "as is." AI-generated output can contain errors. We do not guarantee it is complete, accurate, or fit for a specific purpose. To the extent permitted by law, our liability for any claim relating to the service is limited to the amount you paid us in the 3 months before the claim.',
              id: 'Spectr disediakan "apa adanya." Output hasil AI bisa mengandung kesalahan. Kami tidak menjamin kelengkapan, akurasi, atau kesesuaiannya untuk tujuan tertentu. Sejauh diizinkan hukum, tanggung jawab kami atas klaim apa pun terkait layanan ini dibatasi sebesar jumlah yang kamu bayarkan ke kami dalam 3 bulan sebelum klaim diajukan.',
            },
          ],
        },
        {
          heading: { en: 'Changes and contact', id: 'Perubahan dan kontak' },
          body: [
            {
              en: 'We may update these terms as the product evolves; material changes will be reflected here with an updated date. Questions? Email hello@etalas.com.',
              id: 'Kami dapat memperbarui syarat ini seiring perkembangan produk; perubahan signifikan akan tercermin di sini dengan tanggal yang diperbarui. Ada pertanyaan? Email hello@etalas.com.',
            },
          ],
        },
      ]}
    />
  )
}
