import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'id'

const STORAGE_KEY = 'sandwich_lang'

const STRINGS = {
  // ── Prompt chips ──
  chip_prd: { en: 'PRD', id: 'PRD Lengkap' },
  chip_prototype: { en: 'Prototype', id: 'Prototype' },
  chip_quotation: { en: 'Quotation', id: 'Quotation' },

  // ── Nav ──
  nav_how: { en: 'How It Works', id: 'Cara Kerja' },
  nav_pipeline: { en: 'Pipeline', id: 'Pipeline' },
  nav_pricing: { en: 'Pricing', id: 'Harga' },
  nav_faq: { en: 'FAQ', id: 'FAQ' },
  nav_get_started: { en: 'Get Started', id: 'Mulai Sekarang' },

  // ── Hero ──
  hero_tagline: { en: 'From a messy brief to an execution-ready spec', id: 'Dari brief berantakan jadi spek siap eksekusi' },
  hero_prompt_placeholder: { en: 'Tell us about your brief...', id: 'Ceritain brief lo di sini...' },
  hero_ticket_created: { en: 'Ticket created!', id: 'Ticket dibuat!' },
  hero_ticket_processing: { en: 'Your pipeline is processing the brief. Check the result in the dashboard.', id: 'Pipeline sedang memproses brief kamu. Cek hasilnya di dashboard.' },
  hero_see_result: { en: 'See result', id: 'Lihat hasil' },
  hero_error_generic: { en: 'Failed to submit', id: 'Gagal mengirim' },

  // ── Harnesses / How it works ──
  harnesses_kicker: { en: 'The Harnesses', id: 'The Harnesses' },
  harnesses_title: { en: 'MESSY INPUT. CLEAN SPEC.', id: 'INPUT BERANTAKAN. SPEC RAPI.' },
  harnesses_desc: {
    en: 'Client sends a voice note, a screenshot, a Notion dump. SANDWICH turns all of it into structured, machine-readable specs — validated and ready for your agent to execute.',
    id: 'Klien kirim voice note, screenshot, Notion dump. SANDWICH ubah semua itu jadi structured, machine-readable specs — tervalidasi dan siap dieksekusi agent kamu.',
  },
  step_1_label: { en: 'Send Brief', id: 'Kasih Brief' },
  step_1_desc: { en: 'Raw input, any language', id: 'Input kasar, bahasa apapun' },
  step_2_label: { en: 'AI Processes', id: 'AI Proses' },
  step_2_desc: { en: 'Order → Prep → Recipe', id: 'Order → Prep → Recipe' },
  step_3_label: { en: 'Get the Spec', id: 'Dapat Spec' },
  step_3_desc: { en: 'PRD, MOM, Quotation', id: 'PRD, MOM, Quotation' },
  step_4_label: { en: 'Agent Executes', id: 'Agent Eksekusi' },
  step_4_desc: { en: 'Claude, Pi, or Codex', id: 'Claude, Pi, atau Codex' },
  right_write_spec: { en: 'Write Spec', id: 'Tulis Spec' },
  right_structure_brief: { en: 'Structure the Brief', id: 'Struktur Brief' },
  right_quotation: { en: 'Quotation', id: 'Quotation' },

  // ── Pipeline ──
  pipeline_kicker: { en: 'Got a Spec?', id: 'Got a Spec?' },
  pipeline_title_l1: { en: 'FEED YOUR', id: 'FEED YOUR' },
  pipeline_title_l2: { en: 'PIPELINE.', id: 'PIPELINE.' },
  pipeline_desc_1: {
    en: "SANDWICH was built because there's always been a gap between what a client describes and what an agent can execute. The spec closes that gap. What you do with it next depends on your stack — but if you're looking for a starting point, we recommend",
    id: 'SANDWICH dibuat karena selalu ada gap antara apa yang klien deskripsikan dan apa yang bisa dieksekusi agent. Spec menutup gap itu. Setelah itu tergantung stack kamu — tapi kalau butuh titik mulai, kami rekomendasikan',
  },
  pipeline_desc_2: { en: "It's what we reach for.", id: 'Ini yang kami pakai.' },
  pipeline_cta: { en: 'Try It Now', id: 'Coba Sekarang' },

  // ── Ingredients / Stack ──
  stack_kicker: { en: 'Ingredients', id: 'Ingredients' },
  stack_title: { en: "WHAT'S IN THE STACK", id: 'ISI DI DALAM STACK' },
  stack_desc: {
    en: "Four layers, each with its own job. Together they turn client chaos into a spec your agent can execute right away.",
    id: 'Empat layer, masing-masing punya tugas. Bersama-sama mengubah chaos klien jadi spec yang bisa langsung dieksekusi agent kamu.',
  },
  stack_order_desc: { en: 'Structures the brief', id: 'Structures the brief' },
  stack_prep_desc: { en: 'Scores impact', id: 'Scores impact' },
  stack_recipe_desc: { en: 'Writes the spec', id: 'Writes the spec' },
  stack_validate_desc: { en: 'Checks confidence', id: 'Checks confidence' },

  // ── Pricing ──
  pricing_kicker: { en: 'Pricing', id: 'Harga' },
  pricing_title_l1: { en: 'SIMPLE PRICING.', id: 'HARGA SIMPEL.' },
  pricing_title_l2: { en: 'NO SURPRISES.', id: 'TANPA KEJUTAN.' },
  pricing_desc: {
    en: 'Clear options for different needs. Start free, upgrade anytime.',
    id: 'Pilihan jelas untuk kebutuhan berbeda. Mulai gratis, upgrade kapan saja.',
  },
  pricing_best_value: { en: 'Best value', id: 'Paling worth it' },
  plan_starter_desc: { en: 'For those getting serious.', id: 'Buat yang mulai serius.' },
  plan_starter_cta: { en: 'Start Now', id: 'Mulai Sekarang' },
  plan_starter_f1: { en: 'Premium AI model', id: 'Premium AI model' },
  plan_starter_f2: { en: '5 PRDs / month', id: '5 PRD / bulan' },
  plan_starter_f3: { en: 'Chat with AI about PRD, feature, and task planning (100x/mo)', id: 'Chat dengan AI mengenai planning PRD, fitur, task (100x/bln)' },
  plan_starter_f4: { en: 'Download Markdown', id: 'Download Markdown' },
  plan_starter_f5: { en: 'Generate specs for features and tasks', id: 'Generate specs untuk fitur dan task' },
  plan_pro_desc: { en: 'Unlimited, full access.', id: 'Unlimited, semua akses.' },
  plan_pro_cta: { en: 'Upgrade to Pro', id: 'Upgrade ke Pro' },
  plan_pro_f1: { en: 'Premium AI model', id: 'Premium AI model' },
  plan_pro_f2: { en: 'Unlimited PRDs', id: 'Unlimited PRD' },
  plan_pro_f3: { en: 'Chat with AI about PRD, feature, and task planning (unlimited)', id: 'Chat dengan AI mengenai planning PRD, fitur, task (unlimited)' },
  plan_pro_f4: { en: 'Download Markdown', id: 'Download Markdown' },
  plan_pro_f5: { en: 'Direct chat with Raf Dev for help', id: 'Chat langsung dengan Raf Dev untuk bantuan' },
  plan_pro_f6: { en: 'Generate specs for features and tasks', id: 'Generate specs untuk fitur dan task' },

  // ── FAQ ──
  faq_kicker: { en: 'Shout Out', id: 'Shout Out' },
  faq_title: { en: 'GOT QUESTIONS?', id: 'ADA PERTANYAAN?' },
  faq_cta: { en: 'Start Now', id: 'Mulai Sekarang' },

  // ── Footer ──
  footer_desc: {
    en: 'From a messy brief to a prototype, complete PRD, and a client-ready quotation. One pipeline, not five separate tools. For teams working with AI.',
    id: 'Dari brief berantakan jadi prototype, PRD lengkap, sampai quotation siap kirim ke klien. Satu pipeline, bukan lima tools terpisah. Untuk tim yang kerja bareng AI.',
  },
  footer_product: { en: 'Product', id: 'Produk' },
  footer_product_by: { en: 'product by', id: 'product by' },

  // ── Dashboard ──
  dash_home_headline_pipeline: { en: 'WHAT DO YOU WANT TO MAKE TODAY?', id: 'MAU BIKIN APA HARI INI?' },
  dash_home_headline: { en: 'GOT AN IDEA FOR TODAY?', id: 'PUNYA IDE APA HARI INI?' },
  dash_back_to_list: { en: 'Back to list', id: 'Kembali ke daftar' },
  dash_chat_history: { en: 'Chat History', id: 'Riwayat Chat' },
  dash_no_chats: { en: 'No chats yet', id: 'Belum ada chat' },
  dash_upgrade_pro: { en: 'Upgrade to PRO', id: 'Upgrade ke PRO' },
  dash_no_notifications: { en: 'No new notifications', id: 'Tidak ada notifikasi baru' },
  dash_finished_processing: { en: 'finished processing', id: 'selesai diproses' },
  dash_no_docs: { en: 'No documents yet', id: 'Belum ada dokumen' },
  dash_no_docs_sub: { en: 'Create your first one from the form above', id: 'Buat yang pertama dari form di atas' },
  dash_create_brief: { en: 'Create Brief', id: 'Buat Brief' },
  dash_docs_saved: { en: 'documents saved', id: 'dokumen tersimpan' },
  dash_status_processing: { en: 'Processing', id: 'Diproses' },
  dash_prototypes_saved: { en: 'prototypes saved', id: 'prototype tersimpan' },
  dash_new_prototype: { en: 'New Prototype', id: 'Prototype Baru' },
  share_title: { en: 'Share chat', id: 'Bagikan chat' },
  share_subtitle: { en: 'Only messages up to this point will be shared.', id: 'Hanya pesan sampai titik ini yang akan dibagikan.' },
  share_private_title: { en: 'Keep private', id: 'Simpan privat' },
  share_private_desc: { en: 'Only you have access', id: 'Hanya kamu yang bisa akses' },
  share_shared_title: { en: 'Shared', id: 'Dibagikan' },
  share_shared_desc: { en: 'Anyone with the link can view', id: 'Siapapun dengan link bisa lihat' },
  share_create_link: { en: 'Create share link', id: 'Buat link berbagi' },
  stage_judge: { en: 'Analyzing brief...', id: 'Menganalisis brief...' },
  stage_implement: { en: 'Writing document...', id: 'Membuat dokumen...' },
  stage_verify: { en: 'Verifying result...', id: 'Memverifikasi hasil...' },
  stage_open_pr: { en: 'Opening PR...', id: 'Membuka PR...' },
  pipeline_error: { en: 'An error occurred while processing the brief.', id: 'Terjadi error saat memproses brief.' },
  dash_templates_sub: { en: 'Pick a template, create a brief instantly', id: 'Pilih template, langsung buat brief' },
  dash_click_to_start: { en: 'Click to start →', id: 'Klik untuk mulai →' },
  dash_generic_error: { en: 'Failed to send', id: 'Gagal mengirim' },
  dash_save_resend: { en: 'Save & resend', id: 'Simpan & kirim ulang' },
  dash_time_just_now: { en: 'just now', id: 'baru saja' },
  dash_time_minutes_ago: { en: 'minutes ago', id: 'menit lalu' },
  dash_time_hours_ago: { en: 'hours ago', id: 'jam lalu' },
  dash_time_days_ago: { en: 'days ago', id: 'hari lalu' },

  // ── Auth ──
  auth_have_account: { en: 'Already have an account?', id: 'Sudah punya akun?' },
  auth_login_link: { en: 'Login', id: 'Login' },
  auth_no_account: { en: "Don't have an account?", id: 'Belum punya akun?' },
  auth_register_link: { en: 'Register', id: 'Daftar' },

  // ── Settings ──
  settings_language: { en: 'Language', id: 'Bahasa' },
  settings_language_desc: { en: 'Choose the interface language.', id: 'Pilih bahasa tampilan.' },

  // ── Plan limits ──
  plan_limit_title: { en: "You've hit your Starter limit", id: 'Kamu sudah mencapai batas Starter' },
  plan_limit_desc: { en: '5 briefs / month used. Upgrade to Pro for unlimited.', id: '5 brief / bulan sudah terpakai. Upgrade ke Pro untuk unlimited.' },
  plan_limit_upgrade: { en: 'Upgrade to Pro', id: 'Upgrade ke Pro' },

  // ── Auth shared ──
  auth_back: { en: 'Back', id: 'Kembali' },
  auth_or: { en: 'or', id: 'atau' },

  // ── Login ──
  login_title: { en: 'Welcome back', id: 'Selamat datang lagi' },
  login_subtitle: { en: 'Log in to continue to SANDWICH', id: 'Login untuk lanjut ke SANDWICH' },
  login_cta: { en: 'Log in', id: 'Masuk' },
  login_pending: { en: 'Logging in…', id: 'Masuk...' },
  login_demo: { en: 'Try demo account', id: 'Coba pakai akun demo' },

  // ── Setup / Register ──
  setup_title: { en: 'Create account', id: 'Buat akun' },
  setup_subtitle: { en: 'No account on this instance yet — register to continue.', id: 'Belum ada akun di instance ini — daftar dulu untuk lanjut.' },
  setup_pass_placeholder: { en: 'Min. 8 characters', id: 'Min. 8 karakter' },
  setup_cta: { en: 'Create account', id: 'Buat akun' },
  setup_pending: { en: 'Creating account…', id: 'Membuat akun...' },

  // ── Checkout ──
  checkout_title: { en: 'Checkout', id: 'Checkout' },
  checkout_subtitle: { en: 'Complete payment to activate your plan', id: 'Selesaikan pembayaran untuk mengaktifkan paket kamu' },
  checkout_plan_label: { en: 'Plan', id: 'Paket' },
  checkout_payment_method: { en: 'Payment method', id: 'Metode pembayaran' },
  checkout_pay_cta: { en: 'Pay', id: 'Bayar' },
  checkout_processing: { en: 'Processing…', id: 'Memproses…' },
  checkout_simulation_note: { en: 'Simulation only — no real charge.', id: 'Simulasi pembayaran — tidak ada charge sungguhan.' },
  checkout_success_title: { en: 'Payment successful', id: 'Pembayaran berhasil' },
  checkout_success_note: { en: 'This is a payment simulation — no real charge.', id: 'Ini simulasi pembayaran — belum ada charge sungguhan.' },
  checkout_success_cta: { en: 'Go to Dashboard', id: 'Lanjut ke Dashboard' },
  checkout_price_per_month: { en: '/ month', id: '/ bulan' },
  checkout_plan_active: { en: 'plan is now active.', id: 'kamu aktif.' },
  checkout_method_qris: { en: 'QRIS', id: 'QRIS' },
  checkout_method_card: { en: 'Credit / Debit Card', id: 'Kartu Kredit / Debit' },
  checkout_method_va: { en: 'Bank Transfer (VA)', id: 'Transfer Bank (VA)' },
} satisfies Record<string, { en: string; id: string }>

export type StringKey = keyof typeof STRINGS

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: StringKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'id') return stored
  } catch { /* ignore */ }
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang)

  const setLang = (next: Lang) => {
    setLangState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }

  const t = (key: StringKey) => STRINGS[key][lang]

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
