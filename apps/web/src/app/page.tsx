import type { Metadata } from 'next'
import LandingPage from '../components/LandingPage'
import { FAQS } from '../lib/faqs'

export const metadata: Metadata = {
  title: 'Spectr — Turn a Messy Client Brief into an Execution-Ready Spec',
  description:
    'From a messy brief to a validated PRD, prototype, quotation, and specs — one AI pipeline, not five tools.',
  keywords: [
    'PRD generator',
    'PRD maker',
    'Prototype maker',
    'Prototype builder',
    'online PRD generator',
    'online Prototype builder',
    'client brief to spec',
    'AI product spec',
    'product requirements document',
    'Product Manager Tool',
    'Project Manager Tool',
    'prototype generator',
    'quotation generator',
    'AI pipeline',
    'brief to PRD',
    'vibe coding',
    'vibecoding',
    'vibe coder',
    'vibecoder',
    'AI lovable',
    'AI Indonesia',
    'AI',
    'lovable',
    'lovable alternative',
    'lovable indonesia',
    'PRD',
    'Prototype',
    'Prototype Design',
    'Design Prototype',
    'Prototype Design Tool',
    'Design Prototype Tool',
    'Spectr',
    'Spectr PRD',
    'Spectr Prototype',
    'Spectr Etalas',
    'Etalas',
    'Product Etalas',
    'Product Etalas Indonesia',
    'Produk Etalas',
    'Produk Etalas Indonesia',
    // Indonesian-language
    'brief klien',
    'spesifikasi proyek',
    'dokumen produk',
    'bikin PRD',
    'tools freelancer Indonesia',
    'RAB aplikasi',
    'proposal proyek',
    'scope of work Indonesia',
    // Freelancer audience
    'freelance developer tools',
    'client brief template',
    'scope of work generator',
    'project proposal generator',
    'freelance project scope',
    'project estimate tool',
    'client requirements document',
    // AI coverage
    'AI project manager tool',
    'AI spec generator',
    'AI PRD generator',
    'AI product requirements',
    'AI project planning',
    'AI for developers',
    'AI brief analyzer',
    'AI product manager tool',
    'ChatGPT for PRD',
    'Claude for PRD',
    'ChatGPT for Prototype',
    'Claude for Prototype',
    'generative AI tools',
    // Pain-point based
    'cara bikin PRD',
    'template brief klien',
    'contoh scope of work proyek IT',
    'cara ngitung harga project freelance',
    'contoh PRD aplikasi',
    'template proposal proyek IT',
    // Competitor comparison
    'bolt alternative',
    'v0 alternative',
    'cursor alternative',
    'replit alternative',
    'lovable vs bolt',
    // Job title + task
    'product manager PRD template',
    'freelance developer proposal',
    'web developer quotation template',
    'web developer quotation template indonesia',
  ],
  metadataBase: new URL('https://spectr.id'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Spectr — Turn a Messy Client Brief into an Execution-Ready Spec',
    description:
      'From a messy brief to a validated PRD, prototype, quotation, and specs — one AI pipeline, not five tools.',
    url: 'https://spectr.id',
    siteName: 'Spectr',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Spectr — Turn a Messy Client Brief into an Execution-Ready Spec',
    description:
      'From a messy brief to a validated PRD, prototype, quotation, and specs — one AI pipeline, not five tools.',
  },
  authors: [{ name: 'Etalas', url: 'https://etalas.com' }],
}

const appJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Spectr',
  description: 'From a messy brief to a validated PRD, prototype, quotation, and specs — one AI pipeline, not five tools.',
  url: 'https://spectr.id',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Organization', name: 'Etalas', url: 'https://etalas.com' },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.q.en,
    acceptedAnswer: { '@type': 'Answer', text: faq.a.en },
  })),
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingPage />
    </>
  )
}
