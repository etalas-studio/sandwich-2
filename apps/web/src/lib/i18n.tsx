import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getPreference, setPreference } from '../api/preferences'
import { useAuth } from '../hooks/useAuth'

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
  nav_diff: { en: 'Why SANDWICH', id: 'Kenapa SANDWICH' },
  nav_deliverables: { en: 'Deliverables', id: 'Deliverables' },
  nav_comparison: { en: 'Comparison', id: 'Perbandingan' },
  nav_pricing: { en: 'Pricing', id: 'Harga' },
  nav_faq: { en: 'FAQ', id: 'FAQ' },
  nav_get_started: { en: 'Start from your brief', id: 'Mulai dari brief' },
  nav_login: { en: 'Login', id: 'Masuk' },
  nav_menu_open: { en: 'Open menu', id: 'Buka menu' },
  nav_menu_close: { en: 'Close menu', id: 'Tutup menu' },
  trusted_by: { en: 'Trusted by teams', id: 'Dipercaya tim-tim' },

  // ── Hero ──
  hero_tagline: {
    en: 'One brief in. Versioned PRD, quotation, specs, and a live prototype out. One guided pipeline.',
    id: 'Satu brief masuk. PRD, quotation, specs, dan prototype hidup keluar. Satu pipeline terpandu.',
  },
  hero_prompt_placeholder: { en: 'Tell us about your brief...', id: 'Ceritain brief lo di sini...' },
  hero_brief_created: { en: 'Brief created!', id: 'Brief dibuat!' },
  hero_brief_processing: { en: 'Your pipeline is processing the brief. Check the result in the dashboard.', id: 'Pipeline sedang memproses brief kamu. Cek hasilnya di dashboard.' },
  hero_see_result: { en: 'See result', id: 'Lihat hasil' },
  hero_error_generic: { en: 'Failed to submit', id: 'Gagal mengirim' },
  hero_send_label: { en: 'Send message', id: 'Kirim pesan' },

  // ── Harnesses / How it works ──
  harnesses_kicker: { en: 'What You Can Build', id: 'Apa yang Bisa Lo Bikin' },
  harnesses_title: { en: 'Messy input. Ready-to-use', id: 'Input berantakan. Output siap' },
  harnesses_title_serif: { en: 'output.', id: 'pakai.' },
  harnesses_desc: {
    en: 'Paste the client brief here. You can also attach voice notes, screenshots, or documents. SANDWICH turns all of it into structured documents ready to use or send to your client.',
    id: 'Paste brief klien di sini. Bisa juga lampirin voice note, screenshot, atau dokumen. SANDWICH ubah semuanya jadi dokumen terstruktur yang siap lo pakai atau kirim ke klien.',
  },
  step_1_label: { en: 'Send Brief', id: 'Kasih Brief' },
  step_1_desc: { en: 'Raw input, any language', id: 'Input kasar, bahasa apapun' },
  step_2_label: { en: 'AI Processes', id: 'AI Proses' },
  step_2_desc: { en: 'Brief → PRD → Output', id: 'Brief → PRD → Output' },
  step_3_label: { en: 'Get the Spec', id: 'Dapat Spec' },
  step_3_desc: { en: 'PRD, Specs, Quotation', id: 'PRD, Specs, Quotation' },
  step_4_label: { en: 'Agent Executes', id: 'Agent Eksekusi' },
  step_4_desc: { en: 'Send to your agent', id: 'Kirim ke agent kamu' },
  right_write_spec: { en: 'Write Spec', id: 'Tulis Spec' },
  right_structure_brief: { en: 'Structure the Brief', id: 'Struktur Brief' },
  right_quotation: { en: 'Quotation', id: 'Quotation' },

  // ── Pipeline / How it works ──
  pipeline_kicker: { en: 'How it works', id: 'Cara kerja' },
  pipeline_title_l1: { en: 'Four steps.', id: 'Empat langkah.' },
  pipeline_title_l2: { en: 'No guesswork.', id: 'Tidak ada tebak-tebakan.' },
  pipeline_subtitle: {
    en: "SANDWICH doesn't fill a generic template. It asks first, then generates.",
    id: 'SANDWICH tidak mengisi template generik. Dia tanya dulu, baru generate.',
  },
  pipeline_step_1_title: { en: 'Paste brief', id: 'Paste brief' },
  pipeline_step_1_desc: {
    en: 'Plain text, voice notes, screenshots, or documents — any format works. No special format needed.',
    id: 'Teks biasa, voice note, screenshot, atau dokumen — semua format diterima. Tidak perlu format khusus.',
  },
  pipeline_step_2_title: { en: 'Choose output', id: 'Pilih output' },
  pipeline_step_2_desc: {
    en: 'PRD, quotation, prototype, specs — or all at once. You decide what you need.',
    id: 'PRD, quotation, prototype, specs — atau semua sekaligus. Lo yang menentukan yang dibutuhkan.',
  },
  pipeline_step_3_title: { en: 'Answer questions', id: 'Jawab pertanyaan' },
  pipeline_step_3_desc: {
    en: 'AI asks what needs confirming — not guessing. This usually wraps up in 5-8 minutes.',
    id: 'AI tanya hal-hal yang perlu dikonfirmasi — bukan tebak-tebakan. Proses ini biasanya selesai dalam 5-8 menit.',
  },
  pipeline_step_4_title: { en: 'Review & share', id: 'Review & bagikan' },
  pipeline_step_4_desc: {
    en: 'Documents are saved, revisable, and shareable by link. Every version, nothing lost.',
    id: 'Dokumen tersimpan, bisa direvisi, dan punya shareable link. Setiap versi tidak ada yang hilang.',
  },
  pipeline_cta: { en: 'Start from your brief', id: 'Mulai dari brief' },

  // ── Ingredients / Stack ──
  stack_kicker: { en: 'Ingredients', id: 'Bahan-Bahan' },
  stack_title: { en: 'What you', id: 'Apa yang' },
  stack_title_serif: { en: 'get.', id: 'kamu dapat.' },
  stack_desc: {
    en: 'Four deliverables from one brief, each generated through the same pipeline.',
    id: 'Empat deliverables dari satu brief, semua di-generate lewat pipeline yang sama.',
  },
  stack_order_desc: { en: 'Requirements, modules & constraints', id: 'Requirement, modul & constraint' },
  stack_prep_desc: { en: 'Clickable UI preview', id: 'Preview UI yang bisa diklik' },
  stack_recipe_desc: { en: 'Client-ready cost estimate', id: 'Estimasi biaya siap kirim' },
  stack_validate_desc: { en: 'Feature breakdown & acceptance criteria', id: 'Breakdown fitur & acceptance criteria' },

  // ── Pricing ──
  pricing_kicker: { en: 'Pricing', id: 'Harga' },
  pricing_title_l1: { en: 'Simple pricing.', id: 'Harga simpel.' },
  pricing_title_l2: { en: 'No surprises.', id: 'Tanpa kejutan.' },
  pricing_desc: {
    en: 'Clear options for different needs. Start small, upgrade anytime.',
    id: 'Pilihan jelas untuk kebutuhan berbeda. Mulai dari yang kecil, upgrade kapan saja.',
  },
  pricing_best_value: { en: 'Best value', id: 'Paling worth it' },
  plan_starter_desc: { en: 'Free to start.', id: 'Gratis untuk mulai.' },
  plan_starter_cta: { en: 'Start Free', id: 'Mulai Gratis' },
  plan_starter_f2: { en: '5 documents / month (PRD, quotation, specs)', id: '5 dokumen / bulan (PRD, quotation, specs)' },
  plan_starter_proto: { en: '3 prototypes / month', id: '3 prototype / bulan' },
  plan_starter_f3: { en: '100 AI chat messages / month', id: '100 pesan chat AI / bulan' },
  plan_starter_f4: { en: 'Download Markdown', id: 'Download Markdown' },
  plan_starter_f5: { en: 'Generate specs for features and tasks', id: 'Generate specs untuk fitur dan task' },
  plan_pro_desc: { en: 'Unlimited, full access.', id: 'Unlimited, semua akses.' },
  plan_pro_cta: { en: 'Get Pro', id: 'Dapatkan Pro' },
  plan_pro_f2: { en: 'Unlimited documents', id: 'Unlimited dokumen' },
  plan_pro_proto: { en: 'Unlimited prototypes', id: 'Unlimited prototype' },
  plan_pro_f3: { en: 'Unlimited AI chat', id: 'Chat AI unlimited' },
  plan_pro_f4: { en: 'Download Markdown', id: 'Download Markdown' },
  plan_pro_f6: { en: 'Generate specs for features and tasks', id: 'Generate specs untuk fitur dan task' },

  // ── Sample outputs ──
  samples_kicker: { en: 'Proof, Not Promises', id: 'Bukti, Bukan Janji' },
  samples_title_l1: { en: 'See the real', id: 'Lihat hasil' },
  samples_title_l2: { en: 'output.', id: 'aslinya.' },
  samples_desc: {
    en: 'Real excerpts from documents SANDWICH generated, not mockups.',
    id: 'Cuplikan asli dari dokumen yang dibuat SANDWICH, bukan mockup.',
  },

  // ── Comparison / SANDWICH vs manual ──
  comparison_kicker: { en: 'Comparison', id: 'Perbandingan' },
  comparison_title_sans: { en: 'SANDWICH vs', id: 'SANDWICH vs' },
  comparison_title_serif: { en: 'the old way', id: 'cara lama' },
  comparison_desc: {
    en: 'No assumptions, no email ping-pong. Same documents, done in far less time.',
    id: 'Tanpa asumsi, tanpa bolak-balik email. Dokumen yang sama, waktu yang jauh lebih singkat.',
  },
  comparison_col_aspect: { en: 'Aspect', id: 'Aspek' },
  comparison_col_sandwich: { en: 'SANDWICH', id: 'SANDWICH' },
  comparison_col_manual: { en: 'Old way (manual)', id: 'Cara lama (manual)' },
  comparison_row_pd: { en: 'Time to write PRD', id: 'Waktu buat PRD' },
  comparison_row_pd_s: { en: '~5–10 min', id: '~5–10 menit' },
  comparison_row_pd_m: { en: '2–4 hours', id: '2–4 jam' },
  comparison_row_quote: { en: 'Accurate quotation', id: 'Quotation akurat' },
  comparison_row_quote_s: { en: 'Automatic from spec', id: 'Otomatis dari spec' },
  comparison_row_quote_m: { en: 'Manual estimation', id: 'Ngira-ngira manual' },
  comparison_row_proto: { en: 'Prototype UI', id: 'Prototype UI' },
  comparison_row_proto_s: { en: 'Generated instantly', id: 'Langsung generate' },
  comparison_row_proto_m: { en: 'Need Figma + designer', id: 'Butuh Figma + desainer' },
  comparison_row_version: { en: 'Document versioning', id: 'Versioning dokumen' },
  comparison_row_version_s: { en: 'Saved automatically', id: 'Tersimpan otomatis' },
  comparison_row_version_m: { en: 'Google Docs chaos', id: 'Google Docs kacau' },
  comparison_row_share: { en: 'Shareable link', id: 'Shareable link' },
  comparison_row_share_s: { en: 'Read-only, send instantly', id: 'Read-only, langsung kirim' },
  comparison_row_share_m: { en: 'Need manual export', id: 'Perlu export manual' },
  comparison_row_quality: { en: 'Output quality', id: 'Kualitas output' },
  comparison_row_quality_s: { en: 'Unique per project', id: 'Spesifik per proyek' },
  comparison_row_quality_m: { en: 'Generic template', id: 'Template generik' },

  // ── Deliverables ──
  deliverables_kicker: { en: 'Deliverables', id: 'Deliverables' },
  deliverables_title_sans: { en: 'Four documents.', id: 'Empat dokumen.' },
  deliverables_title_serif: { en: 'One brief.', id: 'Satu brief.' },
  deliverables_desc: {
    en: 'Everything a client project needs, generated from a single brief.',
    id: 'Semua yang dibutuhkan proyek klien, di-generate dari satu brief.',
  },
  deliverables_col_name: { en: 'Deliverable', id: 'Deliverable' },
  deliverables_col_desc: { en: 'Description (Output-focused)', id: 'Deskripsi (Output-focused)' },
  deliverables_prd: { en: 'PRD', id: 'PRD' },
  deliverables_prd_desc: {
    en: 'A full document ready to hand to developers — no need to re-explain.',
    id: 'Dokumen lengkap yang langsung bisa lo kasih ke developer — tanpa perlu dijelaskan ulang.',
  },
  deliverables_proto: { en: 'Prototype', id: 'Prototype' },
  deliverables_proto_desc: {
    en: 'A clickable UI you can show clients before any coding starts.',
    id: 'Tampilan yang bisa lo klik dan tunjukan ke klien sebelum mulai coding.',
  },
  deliverables_quotation: { en: 'Quotation', id: 'Quotation' },
  deliverables_quotation_desc: {
    en: 'A client-ready estimate — includes assumptions, per-item pricing, and payment terms.',
    id: 'RAB siap kirim — sudah include asumsi, harga per item, dan terms pembayaran.',
  },
  deliverables_specs: { en: 'Specs', id: 'Specs' },
  deliverables_specs_desc: {
    en: 'A technical checklist per feature — the team reference so nothing is missed or mismatched.',
    id: 'Checklist teknis per fitur — jadi patokan tim supaya ga ada yang missed atau mismatch.',
  },

  // ── Differentiators ──
  diff_kicker: { en: 'Why SANDWICH', id: 'Kenapa SANDWICH' },
  diff_title_sans: { en: 'Built for real', id: 'Dibuat buat' },
  diff_title_serif: { en: 'client work.', id: 'kerjaan klien beneran.' },
  diff_1_title: { en: 'Version history, not overwrites', id: 'Riwayat versi, bukan ditimpa' },
  diff_1_desc: { en: 'Every revision creates a new version. Nothing you generated is ever lost.', id: 'Setiap revisi bikin versi baru. Hasil generate kamu nggak pernah hilang.' },
  diff_2_title: { en: 'Documents persist, across sessions', id: 'Dokumen tersimpan, lintas sesi' },
  diff_2_desc: { en: 'Come back days later and open the same PRD. It\'s tied to your account, not one chat.', id: 'Balik lagi berhari-hari kemudian dan buka PRD yang sama. Nempel ke akun kamu, bukan cuma satu chat.' },
  diff_3_title: { en: 'Read-only share links', id: 'Link berbagi read-only' },
  diff_3_desc: { en: 'Send clients a link to view the document without giving them an account.', id: 'Kirim link ke klien buat lihat dokumen tanpa perlu kasih mereka akun.' },
  diff_4_title: { en: 'One deliverable at a time', id: 'Satu deliverable per waktu' },
  diff_4_desc: { en: 'The AI asks clarifying questions before generating each document, instead of dumping everything at once.', id: 'AI nanya dulu sebelum generate tiap dokumen, bukan langsung tumpahin semuanya sekaligus.' },

  // ── FAQ ──
  faq_kicker: { en: 'Shout Out', id: 'Nanya Yuk' },
  faq_title_sans: { en: 'Got', id: 'Ada' },
  faq_title_serif: { en: 'questions?', id: 'pertanyaan?' },
  faq_cta: { en: 'Start from your brief', id: 'Mulai dari brief' },
  closing_cta: { en: 'Start now', id: 'Mulai sekarang' },

  // ── Footer ──
  footer_desc: {
    en: 'From a messy brief to a prototype, complete PRD, and a client-ready quotation. One pipeline, not five separate tools. For teams working with AI.',
    id: 'Dari brief berantakan jadi prototype, PRD lengkap, sampai quotation siap kirim ke klien. Satu pipeline, bukan lima tools terpisah. Untuk tim yang kerja bareng AI.',
  },
  footer_product: { en: 'Product', id: 'Produk' },
  footer_product_by: { en: 'powered by', id: 'powered by' },
  footer_legal: { en: 'Legal', id: 'Legal' },
  footer_privacy: { en: 'Privacy Policy', id: 'Kebijakan Privasi' },
  footer_terms: { en: 'Terms of Service', id: 'Syarat & Ketentuan' },
  footer_refund: { en: 'Refund Policy', id: 'Kebijakan Refund' },
  footer_contact: { en: 'Contact', id: 'Kontak' },

  // ── Legal ──
  legal_back: { en: 'Back to home', id: 'Kembali ke beranda' },
  setup_legal_prefix: { en: 'By creating an account you agree to our', id: 'Dengan membuat akun kamu menyetujui' },
  setup_legal_and: { en: 'and', id: 'dan' },

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
  plan_limit_desc: { en: "You've used your monthly document quota. Upgrade to Pro for unlimited.", id: 'Kuota dokumen bulanan kamu sudah terpakai. Upgrade ke Pro untuk unlimited.' },
  prototype_quota_reached: { en: "You've reached your monthly prototype limit. Upgrade to Pro for unlimited prototypes.", id: 'Kamu sudah mencapai batas prototype bulanan. Upgrade ke Pro untuk prototype unlimited.' },
  plan_limit_upgrade: { en: 'Upgrade to Pro', id: 'Upgrade ke Pro' },
  dash_expired_banner: { en: 'Your plan has expired. Renew to continue.', id: 'Plan kamu sudah habis. Perpanjang untuk lanjut.' },
  dash_expiring_banner: { en: 'Your plan expires soon. Renew to avoid interruption.', id: 'Plan kamu segera habis. Perpanjang agar tidak terputus.' },
  dash_expired_error: { en: 'Your subscription is no longer active. Renew to continue.', id: 'Langganan kamu sudah tidak aktif. Perpanjang untuk lanjut.' },
  chat_quota_reached: { en: 'You\'ve reached your monthly chat limit. Upgrade to Pro for unlimited chat.', id: 'Kamu sudah mencapai batas chat bulanan. Upgrade ke Pro untuk chat unlimited.' },

  // ── Auth shared ──
  auth_back: { en: 'Back', id: 'Kembali' },
  auth_or: { en: 'or', id: 'atau' },

  // ── Login ──
  login_title: { en: 'Welcome back', id: 'Selamat datang lagi' },
  login_subtitle: { en: 'Log in to continue to SANDWICH', id: 'Login untuk lanjut ke SANDWICH' },
  login_identifier: { en: 'Username or Email', id: 'Username atau Email' },
  login_cta: { en: 'Log in', id: 'Masuk' },
  login_pending: { en: 'Logging in…', id: 'Masuk...' },
  login_demo: { en: 'Try demo account', id: 'Coba pakai akun demo' },
  login_forgot_password: { en: 'Forgot password?', id: 'Lupa password?' },

  // ── Forgot / Reset password ──
  forgot_title: { en: 'Reset password', id: 'Reset password' },
  forgot_subtitle: { en: "Enter your email and we'll send a reset link.", id: 'Masukkan email kamu dan kami kirim link reset.' },
  forgot_email_placeholder: { en: 'Email', id: 'Email' },
  forgot_submit: { en: 'Send reset link', id: 'Kirim link reset' },
  forgot_success: { en: 'If that email is registered, a reset link has been sent.', id: 'Kalau email itu terdaftar, link reset sudah dikirim.' },
  reset_title: { en: 'Set new password', id: 'Atur password baru' },
  reset_subtitle: { en: 'Choose a new password for your account.', id: 'Pilih password baru untuk akun kamu.' },
  reset_new_password: { en: 'New password', id: 'Password baru' },
  reset_confirm_password: { en: 'Confirm password', id: 'Konfirmasi password' },
  reset_submit: { en: 'Update password', id: 'Perbarui password' },
  reset_success: { en: 'Password updated. You can now log in.', id: 'Password diperbarui. Kamu bisa login sekarang.' },
  reset_mismatch: { en: 'Passwords do not match', id: 'Password tidak cocok' },
  setup_verify_sent_title: { en: 'Check your email', id: 'Cek email kamu' },
  setup_verify_sent_desc: { en: 'We sent a verification link. Click it to activate your account.', id: 'Kami kirim link verifikasi. Klik untuk aktivasi akun kamu.' },
  verify_title: { en: 'Verify email', id: 'Verifikasi email' },
  verify_success: { en: 'Your email is verified. You can log in now.', id: 'Email kamu terverifikasi. Kamu bisa login sekarang.' },
  verify_invalid: { en: 'This link is invalid or expired.', id: 'Link ini tidak valid atau sudah kadaluarsa.' },
  login_email_not_verified: { en: 'Email not verified yet. Check your inbox or resend.', id: 'Email belum terverifikasi. Cek inbox atau kirim ulang.' },
  login_resend: { en: 'Resend verification', id: 'Kirim ulang verifikasi' },
  resend_success: { en: 'If that email is registered and unverified, a new link has been sent.', id: 'Kalau email itu terdaftar & belum terverifikasi, link baru sudah dikirim.' },

  // ── Setup / Register ──
  setup_title: { en: 'Create account', id: 'Buat akun' },
  setup_subtitle: { en: 'Create your free SANDWICH account to turn briefs into PRDs, prototypes, and quotations.', id: 'Buat akun SANDWICH gratis untuk mengubah brief jadi PRD, prototype, dan quotation.' },
  setup_username_placeholder: { en: 'Username', id: 'Username' },
  setup_email_placeholder: { en: 'Email', id: 'Email' },
  setup_pass_placeholder: { en: 'Min. 8 characters', id: 'Min. 8 karakter' },
  setup_username_label: { en: 'Username', id: 'Username' },
  setup_email_label: { en: 'Email', id: 'Email' },
  setup_password_label: { en: 'Password', id: 'Password' },
  setup_cta: { en: 'Create account', id: 'Buat akun' },
  setup_pending: { en: 'Creating account…', id: 'Membuat akun...' },

  // ── Password visibility ──
  password_show: { en: 'Show password', id: 'Tampilkan password' },
  password_hide: { en: 'Hide password', id: 'Sembunyikan password' },

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
  checkout_payment_error: { en: 'Unable to start payment. Please try again.', id: 'Gagal memulai pembayaran. Silakan coba lagi.' },
  checkout_pending_title: { en: 'Payment pending', id: 'Pembayaran tertunda' },
  checkout_pending_note: { en: 'We haven\'t received confirmation yet. If you already paid, it may take a moment.', id: 'Konfirmasi belum kami terima. Kalau kamu sudah bayar, mungkin butuh beberapa saat.' },
  checkout_retry: { en: 'Check again', id: 'Cek lagi' },
  checkout_failed_title: { en: 'Payment failed', id: 'Pembayaran gagal' },
  checkout_failed_note: { en: 'Your payment did not complete. Please try again.', id: 'Pembayaran kamu tidak selesai. Silakan coba lagi.' },
  checkout_instructions: { en: 'Payment instructions', id: 'Instruksi pembayaran' },
  checkout_expired_banner: { en: 'Your plan has expired. Renew to continue.', id: 'Plan kamu sudah habis. Perpanjang untuk lanjut.' },
  checkout_current_plan: { en: 'You are currently on the {plan} plan.', id: 'Kamu sedang berada di paket {plan}.' },
  checkout_success_cta: { en: 'Go to Dashboard', id: 'Lanjut ke Dashboard' },
  checkout_price_per_month: { en: '/ month', id: '/ bulan' },
  checkout_plan_active: { en: 'plan is now active.', id: 'kamu aktif.' },
  checkout_method_qris: { en: 'QRIS', id: 'QRIS' },
  checkout_method_card: { en: 'Credit / Debit Card', id: 'Kartu Kredit / Debit' },
  checkout_method_va: { en: 'Bank Transfer (VA)', id: 'Transfer Bank (VA)' },

  // ── 404 ──
  notfound_title: { en: "Page not found", id: 'Halaman tidak ditemukan' },
  notfound_desc: { en: "This page doesn't exist or was moved.", id: 'Halaman ini tidak ada atau sudah dipindahkan.' },
  notfound_home: { en: 'Back to home', id: 'Kembali ke beranda' },

  // ── Home overview ──
  home_greeting_morning: { en: 'Good morning', id: 'Selamat pagi' },
  home_greeting_afternoon: { en: 'Good afternoon', id: 'Selamat siang' },
  home_greeting_evening: { en: 'Good evening', id: 'Selamat sore' },
  home_greeting_night: { en: 'Good night', id: 'Selamat malam' },
  home_subtitle_empty: { en: 'No briefs yet. Start with a sentence below.', id: 'Belum ada brief. Mulai dari satu kalimat di bawah.' },
  home_subtitle_count: { en: 'You have {n} briefs so far.', id: 'Kamu punya {n} brief sejauh ini.' },
  home_templates_btn: { en: 'Templates', id: 'Template' },
  home_all_briefs_btn: { en: 'All briefs', id: 'Semua brief' },
  home_stat_total: { en: 'Total briefs', id: 'Total brief' },
  home_stat_done: { en: 'Done', id: 'Selesai' },
  home_stat_draft: { en: 'Still draft', id: 'Masih draft' },
  home_stat_week: { en: 'This week', id: 'Minggu ini' },
  home_quota_title: { en: 'THIS MONTH\'S QUOTA', id: 'KUOTA BULAN INI' },
  home_quota_plan_starter: { en: 'Starter plan', id: 'Plan Starter' },
  home_quota_plan_pro: { en: 'Pro plan', id: 'Plan Pro' },
  home_quota_documents: { en: 'documents', id: 'dokumen' },
  home_quota_prototypes: { en: 'prototypes', id: 'prototype' },
  home_quota_chats: { en: 'chats', id: 'chat' },
  home_quota_upgrade: { en: 'Upgrade to Pro', id: 'Upgrade ke Pro' },
  home_quota_completion: { en: 'Completion rate', id: 'Tingkat Penyelesaian' },
  home_activity_title: { en: 'LAST 7 DAYS', id: 'AKTIVITAS 7 HARI' },
  home_activity_sub_zero: { en: 'No briefs made this week', id: '0 brief dibuat minggu ini' },
  home_activity_sub: { en: '{n} briefs made this week', id: '{n} brief dibuat minggu ini' },
  home_quickstart_title: { en: 'QUICK START', id: 'MULAI CEPAT' },
  home_quickstart_sub: { en: 'Pick a document type, it fills the prompt', id: 'Pilih jenis dokumen, langsung diisi ke prompt' },
  home_recent_title: { en: 'RECENT ACTIVITY', id: 'AKTIVITAS TERBARU' },
  home_recent_sub: { en: '{n} documents saved', id: '{n} dokumen tersimpan' },
  home_filter_all: { en: 'All', id: 'Semua' },
  home_filter_done: { en: 'Done', id: 'Selesai' },
  home_filter_draft: { en: 'Draft', id: 'Draft' },
  home_recent_empty_title: { en: 'No documents here yet', id: 'Belum ada dokumen di sini' },
  home_recent_empty_sub: { en: 'Write a brief above to get started', id: 'Tulis brief di atas buat mulai' },
  home_breakdown_title: { en: 'BREAKDOWN', id: 'RINCIAN' },
  home_breakdown_sub: { en: 'Per document type', id: 'Per jenis dokumen' },
  home_breakdown_empty: { en: 'Data appears after your first brief.', id: 'Data muncul setelah brief pertama.' },
  home_checklist_title: { en: 'CHECKLIST', id: 'DAFTAR CEK' },
  home_checklist_done: { en: '{done}/{total} complete', id: '{done}/{total} selesai' },
  home_check_1: { en: 'Make your first brief', id: 'Bikin brief pertama' },
  home_check_2: { en: 'Finish 1 document', id: 'Selesaikan 1 dokumen' },
  home_check_3: { en: 'Try 3 document types', id: 'Coba 3 jenis dokumen' },
  home_check_5: { en: 'Upgrade for unlimited', id: 'Upgrade biar unlimited' },
  home_tips_title: { en: 'SHARPEN YOUR RESULTS', id: 'BIAR HASILNYA MAKIN TAJAM' },
  home_tips_sub: { en: 'Three things that matter most for output quality', id: 'Tiga hal yang paling ngaruh ke kualitas output' },
  home_tip_1_title: { en: 'Name the audience & goal', id: 'Sebut audiens & goal' },
  home_tip_1_desc: { en: 'Example: "for the ops team, cut manual input by 50%".', id: 'Contoh: "buat tim ops gudang, target kurangi input manual 50%".' },
  home_tip_2_title: { en: 'Attach context', id: 'Lampirkan konteks' },
  home_tip_2_desc: { en: 'A client chat screenshot or meeting notes make scope far more accurate.', id: 'Screenshot chat klien atau catatan meeting bikin scope jauh lebih akurat.' },
  home_tip_3_title: { en: 'Iterate in chat', id: 'Iterasi di chat' },
  home_tip_3_desc: { en: 'Ask to revise a specific part, not regenerate from scratch.', id: 'Minta revisi bagian tertentu, bukan generate ulang dari nol.' },
  home_help_title: { en: 'Need help or have a feature request?', id: 'Butuh bantuan atau punya request fitur?' },
  home_help_sub: { en: 'Read the quick guide or send feedback straight to the team.', id: 'Baca panduan singkat atau kirim masukan langsung ke tim.' },
  home_help_cta: { en: 'Help & Docs', id: 'Bantuan & Dokumentasi' },
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
  const { state: authState } = useAuth()
  const isAuthed = authState.status === 'authenticated'

  // Keep <html lang> in sync so screen readers/browsers pick the right
  // pronunciation/spellcheck rules for whichever language is active.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (next: Lang) => {
    setLangState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
    // Server preference is per-account; skip the call for anonymous visitors
    // (would 401 — localStorage already persists their choice locally).
    if (isAuthed) void setPreference('lang', next).catch(() => {})
  }

  // Sync from the server for authenticated users (localStorage is the instant cache).
  useEffect(() => {
    if (!isAuthed) return
    void getPreference('lang')
      .then((value) => {
        if (value === 'en' || value === 'id') setLangState(value)
      })
      .catch(() => {})
  }, [isAuthed])

  const t = (key: StringKey) => STRINGS[key][lang]

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
