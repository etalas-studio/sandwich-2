import type { Metadata } from 'next'
import LandingPage from '../components/LandingPage'
import { FAQS } from '../lib/faqs'

export const metadata: Metadata = {
  title: 'SANDWICH — Turn a Messy Client Brief into an Execution-Ready Spec',
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
    'Sandwich',
    'Sandwich PRD',
    'Sandwich Prototype',
    'Sandwich Etalas',
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
  ],
  metadataBase: new URL('https://sandwich.etalas.com'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'SANDWICH — Turn a Messy Client Brief into an Execution-Ready Spec',
    description:
      'From a messy brief to a validated PRD, prototype, quotation, and specs — one AI pipeline, not five tools.',
    url: 'https://sandwich.etalas.com',
    siteName: 'SANDWICH',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SANDWICH — Turn a Messy Client Brief into an Execution-Ready Spec',
    description:
      'From a messy brief to a validated PRD, prototype, quotation, and specs — one AI pipeline, not five tools.',
  },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingPage />
    </>
  )
}
