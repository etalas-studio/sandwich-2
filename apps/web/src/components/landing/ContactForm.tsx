'use client'

import { useState } from 'react'
import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY } from './tokens'

const CONTACT_EMAIL = 'support@etalas.ai'

const LABELS = {
  en: {
    kicker: 'Get in touch',
    title: 'Talk to the team',
    desc: 'Questions about SANDWICH, billing, or a custom need? Send us a note directly.',
    name: 'Name',
    namePlaceholder: 'Your name',
    email: 'Email',
    emailPlaceholder: 'you@company.com',
    plan: 'Plan interest',
    planPlaceholder: 'Select a plan',
    planOptions: ['Starter (free)', 'Pro', 'Not sure yet'],
    topic: 'What do you need help with',
    topicPlaceholder: 'Select a topic',
    topicOptions: ['General question', 'Billing', 'Feature request', 'Something else'],
    details: 'Details',
    detailsPlaceholder: 'Tell us more...',
    submit: 'Send message',
  },
  id: {
    kicker: 'Hubungi kami',
    title: 'Ngobrol sama tim',
    desc: 'Ada pertanyaan soal SANDWICH, billing, atau kebutuhan khusus? Kirim pesan langsung ke kami.',
    name: 'Nama',
    namePlaceholder: 'Nama kamu',
    email: 'Email',
    emailPlaceholder: 'kamu@perusahaan.com',
    plan: 'Plan yang diminati',
    planPlaceholder: 'Pilih plan',
    planOptions: ['Starter (gratis)', 'Pro', 'Belum tahu'],
    topic: 'Butuh bantuan soal apa',
    topicPlaceholder: 'Pilih topik',
    topicOptions: ['Pertanyaan umum', 'Billing', 'Request fitur', 'Lainnya'],
    details: 'Detail',
    detailsPlaceholder: 'Ceritain lebih lanjut...',
    submit: 'Kirim pesan',
  },
}

export interface ContactFormProps {
  reveal: (id: string, extra?: string) => string
  lang: 'en' | 'id'
}

export function ContactForm({ reveal, lang }: ContactFormProps) {
  const l = LABELS[lang]
  const [form, setForm] = useState({ name: '', email: '', plan: '', topic: '', details: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setForm((prev) => ({ ...prev, [id]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const subject = encodeURIComponent(`SANDWICH inquiry from ${form.name || 'a visitor'}`)
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nPlan interest: ${form.plan}\nTopic: ${form.topic}\n\n${form.details}`,
    )
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
  }

  return (
    <section id="application" className="relative overflow-hidden py-24 border-t border-black/5 scroll-mt-24">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 60% at 50% 0%, rgba(59,130,246,0.12), transparent 70%)' }} />
      <div className="relative z-10 max-w-3xl mx-auto px-6">
        <div id="application-head" className={reveal('application-head', 'text-center mb-10')}>
          <span className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-[11px] font-medium backdrop-blur" style={{ color: TEXT_SECONDARY }}>{l.kicker}</span>
          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-light tracking-tighter" style={{ color: TEXT_PRIMARY }}>{l.title}</h2>
          <p className="mt-4 text-base" style={{ color: TEXT_SECONDARY }}>{l.desc}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-black/10 p-6 sm:p-10 rounded-2xl shadow-sm">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="col-span-1">
              <label htmlFor="name" className="block text-xs font-medium mb-2" style={{ color: TEXT_SECONDARY }}>{l.name}</label>
              <input
                type="text"
                id="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full bg-black/[0.02] border border-black/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder-black/30"
                style={{ color: TEXT_PRIMARY }}
                placeholder={l.namePlaceholder}
              />
            </div>
            <div className="col-span-1">
              <label htmlFor="email" className="block text-xs font-medium mb-2" style={{ color: TEXT_SECONDARY }}>{l.email}</label>
              <input
                type="email"
                id="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full bg-black/[0.02] border border-black/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder-black/30"
                style={{ color: TEXT_PRIMARY }}
                placeholder={l.emailPlaceholder}
              />
            </div>
            <div className="col-span-1">
              <label htmlFor="plan" className="block text-xs font-medium mb-2" style={{ color: TEXT_SECONDARY }}>{l.plan}</label>
              <select
                id="plan"
                value={form.plan}
                onChange={handleChange}
                required
                className="w-full bg-black/[0.02] border border-black/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition appearance-none"
                style={{ color: TEXT_PRIMARY }}
              >
                <option value="" className="bg-white">{l.planPlaceholder}</option>
                {l.planOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-white">{opt}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <label htmlFor="topic" className="block text-xs font-medium mb-2" style={{ color: TEXT_SECONDARY }}>{l.topic}</label>
              <select
                id="topic"
                value={form.topic}
                onChange={handleChange}
                required
                className="w-full bg-black/[0.02] border border-black/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition appearance-none"
                style={{ color: TEXT_PRIMARY }}
              >
                <option value="" className="bg-white">{l.topicPlaceholder}</option>
                {l.topicOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-white">{opt}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label htmlFor="details" className="block text-xs font-medium mb-2" style={{ color: TEXT_SECONDARY }}>{l.details}</label>
              <textarea
                id="details"
                value={form.details}
                onChange={handleChange}
                rows={3}
                required
                className="w-full bg-black/[0.02] border border-black/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder-black/30 resize-none"
                style={{ color: TEXT_PRIMARY }}
                placeholder={l.detailsPlaceholder}
              />
            </div>
          </div>
          <div className="mt-8 text-center">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-sm font-semibold transition hover:opacity-90 w-full sm:w-auto justify-center"
              style={{ backgroundColor: ACCENT, color: '#ffffff', boxShadow: '0 0 30px rgba(59,130,246,0.3)' }}
            >
              {l.submit}
              <iconify-icon icon="solar:arrow-right-linear" width="16" />
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
