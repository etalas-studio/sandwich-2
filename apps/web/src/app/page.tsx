import type { Metadata } from 'next'
import LandingPage from '../components/LandingPage'
import { FAQS } from '../lib/faqs'

export const metadata: Metadata = {
  title: 'SANDWICH — Turn a Messy Client Brief into an Execution-Ready Spec',
  description:
    'From a messy brief to a validated PRD, prototype, quotation, and specs — one AI pipeline, not five tools.',
  keywords: [
    'PRD generator',
    'client brief to spec',
    'AI product spec',
    'product requirements document',
    'prototype generator',
    'quotation generator',
    'AI pipeline',
    'brief to PRD',
    'vibe coding',
    'vibecoding',
    'vibe coder',
    'vibecoder',
    'lovable',
    'lovable alternative',
    'lovable indonesia',
    'PRD',
    'Prototype',
    'Sandwich',
    'Sandwich PRD',
    'Sandwich Prototype',
    'Sandwich Etalas',
    'Etalas'
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
