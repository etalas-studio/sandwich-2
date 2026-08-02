# Primer: Cara Baca Test di Repo Runchise + Arsitektur Runtime Agent

Ditulis 31 Juli 2026. Semua contoh diambil dari repo `runchise/runchise` yang asli.

Dokumen ini dua bagian dan bisa dibaca terpisah:

- **Bagian A** — cara baca dan mengelompokkan test di repo ini
- **Bagian B** — agent-nya jalan di mana, dipantau gimana, dan dibatasi apa

---

# BAGIAN A — Test di repo ini

## A1. Ada empat jenis, dan bedanya cuma "sejauh mana dia nyentuh sistem"

Repo ini punya 1.658 file spec. Kelihatannya kacau, tapi sebenarnya cuma empat kelompok. Yang membedakan: seberapa banyak bagian sistem yang harus hidup supaya test itu bisa jalan.

### 1. Test fungsi murni — `spec/helpers/`

Yang paling gampang. Kasih input, cek output. Gak butuh database, gak butuh apa-apa.

`spec/helpers/file_helper_spec.rb`:

```ruby
RSpec.describe FileHelper, type: :helper do
  context '.detect_csv_delimiter' do
    context 'when the file is comma-separated' do
      let(:file) { File.open('spec/fixtures/files/comma.csv') }

      it 'detects comma as the delimiter' do
        expect(described_class.detect_csv_delimiter(file)).to eq(',')
      end
    end
  end
end
```

Bacanya: ambil file contoh, panggil fungsinya, harapkan hasilnya `,`. Selesai. Jalannya milidetik.

**Ini jenis yang paling cocok buat agent** — cepat, hasilnya pasti, gak ada efek samping.

### 2. Test model — `spec/models/` (113 file)

Nyentuh database. Biasanya nguji aturan validasi.

`spec/models/product_custom_sku_spec.rb`:

```ruby
describe ProductCustomSku, type: :model do
  include_context 'products creations'

  describe '#valid?' do
    context 'check_sku_from_product' do
      context 'when sku in product already exists' do
        let(:custom_sku) { build(:product_custom_sku, brand: brand, product: latte, sku: latte.sku) }

        it 'returns error' do
          expect(custom_sku.valid?).to be_falsey
          expect(custom_sku.errors.full_messages.first).to include(I18n.t('product_custom_skus.errors.sku_has_been_taken'))
        end
      end
    end
  end
end
```

### 3. Test request — `spec/requests/` (500 file)

Paling realistis, paling lambat. Nembak endpoint HTTP betulan.

`spec/requests/timezones_request_spec.rb`:

```ruby
describe 'API Access List', type: :request do
  it 'should be able to get list with specifics country' do
    get '/api/timezones', params: { format: 'json', country: 'Indonesia' }
    expect(response).to have_http_status(:ok)
    response_body = JSON.parse(response.body)
    expect(response_body['timezones'].length).to eq 4
  end
end
```

### 4. Test domain — `spec/domains/` (915 file, kelompok terbesar)

Isinya campuran dari tiga jenis di atas, tapi diorganisir per domain bisnis: `spec/domains/accounting/`, `spec/domains/restaurant/`, dan seterusnya.

---

## A2. Jurus baca cepat — ini yang lu butuhin

Masalah lu: "ada banyak test, gue gak bisa bedain ini buat apa."

Solusinya: **jangan baca isinya. Baca cuma baris `describe`, `context`, dan `it`.** Tiga itu kalau digabung membentuk satu kalimat utuh.

Contoh dari `product_custom_sku_spec.rb` di atas:

| Baris | Isi |
|---|---|
| `describe ProductCustomSku` | ProductCustomSku |
| `describe '#valid?'` | ketika divalidasi |
| `context 'when sku in product already exists'` | kalau SKU-nya sudah ada di product |
| `it 'returns error'` | menghasilkan error |

Gabung: *"ProductCustomSku, ketika divalidasi, kalau SKU-nya sudah ada di product, menghasilkan error."*

Itu seluruh maksud test tersebut, dan lu gak perlu baca satu baris pun dari isinya. Kalau kalimat itu gak kebentuk, berarti test-nya memang ditulis jelek — dan itu masalah penulisnya, bukan pemahaman lu.

Aturan praktis: `describe` = benda atau metode yang diuji. `context` = kondisinya. `it` = hasil yang diharapkan.

## A3. Dua istilah pendukung yang bakal sering lu lihat

**Factory** — resep bikin data palsu buat test. Ada di `spec/factories/`, repo ini punya 433 file.

```ruby
FactoryBot.define do
  factory :access_token, class: "Doorkeeper::AccessToken" do
    expires_in { 2.hours }
    scopes { "public" }
  end
end
```

Habis itu di test cukup tulis `create(:access_token)` dan datanya jadi. Tanpa factory, tiap test harus nyiapin data manual dari nol.

**Shared context** — setup yang dipakai berulang di banyak test. Itu arti baris `include_context 'products creations'` di contoh tadi: "pakai setup produk yang udah didefinisikan di tempat lain".

---

## A4. Characterization test — dan kenapa rasanya aneh

Ini jenis test yang jadi inti rencana kita, dan bentuknya bikin bingung kalau belum pernah lihat.

**Test biasa** menjawab: *"apakah kode ini benar?"*
**Characterization test** menjawab: *"kode ini sekarang perilakunya apa?"*

Bedanya: characterization test **gak peduli benar atau salah.** Tugasnya cuma memotret keadaan sekarang.

Contoh nyata pakai bug RR-7338. Kode yang sekarang, di `app/helpers/file_helper.rb`:

```ruby
def safe_file_name(filename = '')
  filename.gsub(/[^0-9a-z._]/i, '_')
end
```

Characterization test-nya begini:

```ruby
context '.safe_file_name' do
  it 'replaces mandarin characters with underscores' do
    expect(FileHelper.safe_file_name('库存变动.xlsx')).to eq('_____.xlsx')
  end

  it 'keeps latin letters, digits, dots and underscores' do
    expect(FileHelper.safe_file_name('Report_2026.xlsx')).to eq('Report_2026.xlsx')
  end

  it 'replaces slashes with underscores' do
    expect(FileHelper.safe_file_name('a/b.csv')).to eq('a_b.csv')
  end
end
```

Perhatiin test pertama: dia **menegaskan perilaku yang salah.** Kita tulis `eq('_____.xlsx')` — persis bug yang dilaporin.

Kelihatan konyol, tapi ini gunanya:

1. Sekarang perilaku lama **terdokumentasi dan terkunci**. Sebelumnya gak ada yang tau, karena fungsi ini dipanggil 19 kali dari 12 file dan gak punya test sama sekali.
2. Begitu regex-nya diubah, test pertama **merah** — dan itu memang yang kita mau. Merahnya jadi bukti bahwa perubahan kita kena sasaran.
3. Test kedua dan ketiga **harus tetap hijau.** Itu buktinya kita gak ngerusak penamaan file di `gl_journal_entries_controller.rb`, `gl_books_controller.rb`, dan 17 titik lainnya.
4. Habis itu test pertama diperbaiki jadi perilaku yang diinginkan: `eq('库存变动.xlsx')`.

Jadi alurnya: **potret dulu → ubah → lihat apa yang bergeser → perbarui potretnya.**

Analoginya: sebelum renovasi rumah, lu foto dulu semua ruangan. Bukan karena fotonya bagus, tapi biar habis renovasi lu bisa bandingin — mana yang berubah sesuai rencana, mana yang berubah tanpa lu sadari.

**Dan ini alasan kenapa pendekatan ini melewati masalah terbesar kita:** characterization test **gak butuh acceptance criteria.** Speknya cukup "rekam yang ada sekarang". Jadi 59 tiket berdeskripsi kosong dan 83 tiket berspek screenshot itu jadi gak relevan untuk pekerjaan ini.

**Tapi hati-hati:** kalau agent nemu perilaku yang jelas-jelas aneh, itu **naik ke manusia**, jangan langsung dikunci jadi test. Kalau enggak, kita malah mengabadikan bug jadi aturan resmi.

---

# BAGIAN B — Agent-nya jalan di mana

## B1. Keputusan engine: Claude Code

Notes meeting nyebut "Claude (Subscription)". Langganan Claude Pro/Max itu buat dipakai lewat produk Anthropic sendiri, termasuk Claude Code — bukan buat dipakai tool pihak ketiga. Jadi kalau kita mau pakai langganan mereka, **Claude Code adalah satu-satunya pilihan yang bersih.**

Pi Agent (yang tadi kita pertimbangkan) tetap opsi bagus secara teknis, tapi dia butuh API key. Jalurnya begitu Runchise dapet **Amazon Bedrock API key** — yang di notes ditulis "later" — Pi jadi mungkin. Sampai saat itu: Claude Code.

**Konsekuensi teknis yang penting dan sering kelewat:** login langganan itu proses interaktif sekali jalan. Itu gak cocok buat container CI yang sekali pakai lalu dibuang, karena login-nya bakal hilang tiap kali.

Artinya arsitekturnya harus dua fase:

| Fase | Auth | Agent jalan di mana |
|---|---|---|
| Pilot (sekarang) | Langganan, login sekali | Satu mesin runner yang persisten |
| Nanti | Bedrock API key | Container di Bitbucket Pipelines |

Kita rancang dari awal supaya pindah fase itu cuma ganti konfigurasi, bukan tulis ulang.

## B2. Bentuk konkretnya di fase pilot

**Satu mesin runner.** Bisa laptop yang nganggur, Mac mini, atau VM kecil. Yang harus ada di dalamnya:

1. Clone repo `runchise`
2. `docker compose up` buat layanan test — PostgreSQL, Redis, Elasticsearch, ClickHouse
3. Claude Code, sudah login sekali
4. Orchestrator kita — TypeScript, kecil

**Alur satu percobaan (satu tiket):**

1. Orchestrator ambil tiket dari daftar antrean
2. Bikin **git worktree** baru — checkout terpisah di folder sendiri, jadi beberapa percobaan gak tabrakan dan repo utama gak kesentuh
3. Jalankan Claude Code **tahap baca dulu**, tanpa izin menulis. Outputnya: rencana — file mana yang mau disentuh, test apa yang mau ditulis
4. Manusia baca rencananya. Target 2 menit
5. Kalau disetujui, jalankan tahap kedua dengan izin menulis. Agent nulis characterization test dulu, baru ubah kodenya
6. Jalankan rspec pada spec yang relevan
7. Kalau lolos dan batas aman gak dilewati: push branch, buka PR
8. Semua yang terjadi ditulis ke folder rekaman

Buat pilot, pemicunya **manual atau daftar antrean sederhana — bukan webhook.** Webhook itu Week 3 kalau semuanya sudah stabil. Alasannya: makin sedikit bagian yang bergerak, makin gampang nyari sumber masalah. Dan di awal kita justru **mau** ada manusia di tengah.

## B3. Observability — yang lu tanyain

Ini bagian yang paling sering dilewatkan orang, padahal tanpa ini pilot-nya gak menghasilkan bukti apa-apa.

Prinsipnya: **satu percobaan, satu folder.** Semuanya file biasa.

```
runs/
  RR-7338/
    2026-08-04T10-22/
      meta.json         # tiket, model, mulai/selesai, token, biaya, hasil akhir
      transcript.jsonl  # tiap tool call & responsnya, urut
      files.json        # file mana yang dibaca vs diubah
      diff.patch        # perubahan kodenya
      rspec.json        # spec mana yang jalan, lolos/gagal, durasi
      plan.md           # rencana dari tahap 1 + siapa yang approve
  runs.jsonl            # indeks, satu baris per percobaan
```

Claude Code bisa mengeluarkan seluruh jalannya sebagai JSON per baris, jadi `transcript.jsonl` itu tinggal ditampung — bukan hasil parsing output terminal yang rapuh.

**Kenapa file biasa, bukan database?** Karena jumlahnya cuma 30–50 percobaan selama pilot. File itu bisa di-`grep`, bisa di-`diff`, nol biaya setup, dan folder-nya bisa langsung dikasih ke klien sebagai bukti. Database itu berlebihan di skala ini. Kalau nanti ratusan percobaan per minggu, baru pindah.

**Waktu ada yang aneh, lu ngapain?** Buka `transcript.jsonl` percobaan itu, scroll ke tool call terakhir sebelum melenceng. Di situ kelihatan agent-nya salah baca file apa, atau salah nebak apa. Itu permukaan debugging lu.

**Dashboard:** satu halaman HTML statis yang dibangkitkan dari `runs.jsonl`. Isinya tabel — tiket, hasil, durasi, biaya, jumlah baris yang diedit manusia setelahnya. Cukup segitu. Jangan bikin aplikasi.

**Yang dicatat per percobaan, dan kenapa:**

| Data | Kenapa dicatat |
|---|---|
| Hasil akhir (PR dibuka / kena batas aman / CI merah / berhenti) | Ini pembilang semua metrik |
| Baris yang diedit manusia setelah PR dibuka | Ini **metrik utama** kita — autonomy rate |
| Ronde review | Deteksi PR yang kelihatan lolos tapi sebenarnya berantakan |
| Durasi tiap tahap | Nunjukin penyempitannya di mana. Dugaan gue: di review, bukan di agent |
| Token dan biaya | Biar ada angka biaya per tiket buat dibawa ke klien |
| File yang dibaca vs diubah | Kalau agent baca 200 file, scoping-nya kelewat luas |

## B4. Batas aman — angka konkret

Semua ini ditegakkan orchestrator, bukan diserahkan ke kesopanan agent.

| Batas | Usul awal | Kalau dilewati |
|---|---|---|
| Waktu satu percobaan | 20 menit | Dihentikan, dicatat sebagai timeout |
| Jumlah file diubah | 8 | Berhenti, escalate, jangan push |
| Baris diff | 300 | Berhenti, escalate, jangan push |
| Biaya per percobaan | ditetapkan di awal | Dihentikan |
| Retry saat CI merah | 2 kali | Escalate, jangan biarkan muter |

**Daftar cegat — agent nyentuh ini, otomatis wajib senior review:**

- 25 file di atas 800 baris, terutama `app/models/concerns/product_logic.rb` (2.648 baris), `app/models/order_transaction.rb` (2.437), `app/helpers/notification_helper.rb` (2.007)
- `app/domains/accounting/**` dan `app/domains/jurnal/**`
- Semua domain integrasi pihak ketiga: `grab_food`, `gobiz`, `shopee_food`, `bca`, `bni_qris`, `faspay`, dan sejenisnya
- `db/migrate/**`

**Yang mutlak: agent gak pernah push ke `master`.** Selalu branch, selalu PR. Tanpa pengecualian selama pilot.

## B5. Yang perlu disiapkan, dan siapa

| Kerjaan | Siapa | Catatan |
|---|---|---|
| Test suite hijau di mesin runner | Etalas | Ini kerjaan paling gak seksi dan paling menentukan. Butuh `RAILS_MASTER_KEY` dan puluhan env var dari Runchise |
| Orchestrator TypeScript | Etalas | Kecil. Worktree, panggil agent, tampung output, buka PR |
| Folder rekaman + dashboard | Etalas | Sehari |
| `RAILS_MASTER_KEY` + env var | **Runchise** | Blocker. Tanpa ini test suite gak bisa jalan |
| Nama reviewer + jam per minggu | **Runchise** | Masih belum terjawab sejak awal |
| Akses buka PR di Bitbucket | **Runchise** | Bisa pakai akun bot atau akun Etalas |

---

## Ringkasan satu halaman

**Bagian A:** ada empat jenis test di repo ini, dibedakan dari seberapa banyak sistem yang harus hidup. Buat tau satu test itu buat apa, baca cuma baris `describe`/`context`/`it` — ketiganya membentuk satu kalimat. Characterization test itu memotret perilaku sekarang termasuk bug-nya, gunanya buat ketahuan apa yang bergeser saat kode diubah, dan dia gak butuh acceptance criteria.

**Bagian B:** karena pakai langganan Claude, engine-nya Claude Code dan agent-nya jalan di satu mesin runner persisten — bukan container CI, karena login langganan gak bisa diulang tiap kali. Tiap tiket dikerjain di git worktree terpisah, dua tahap (baca dulu, tulis kemudian, dengan approval rencana di tengah). Semua jejak disimpan sebagai file biasa satu folder per percobaan, karena skalanya cuma puluhan. Batas aman ditegakkan orchestrator, bukan diminta baik-baik ke agent.

*Angka dan contoh kode di dokumen ini diambil dari repo pada 31 Juli 2026. Angka batas aman di B4 adalah usul awal dan perlu disetel setelah beberapa percobaan pertama.*
