import Link from 'next/link'
import Image from 'next/image'
import { LandingNav } from './landing/LandingNav'
import { GridLines } from './landing/GridLines'
import { ACCENT, LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED } from './landing/tokens'
import type { PostMeta } from '../lib/blog'

export default function BlogLayout({
  meta,
  children,
}: {
  meta: PostMeta
  children: React.ReactNode
}) {
  const date = new Date(meta.date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return (
    <div className="min-h-screen bg-white relative overflow-hidden" style={{ fontFamily: "'Inter Tight', 'Inter', sans-serif" }}>
      <GridLines />
      <LandingNav />
      <main className="max-w-2xl mx-auto px-6 pt-24 pb-12 relative z-10">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm transition-colors mb-8 hover:text-neutral-900"
          style={{ color: LIGHT_TEXT_MUTED }}
        >
          <iconify-icon icon="solar:arrow-left-linear" width="14" />
          Insights
        </Link>
        <header className="mb-10">
          <time dateTime={meta.date} className="text-xs font-medium" style={{ color: LIGHT_TEXT_MUTED }}>
            {date}
          </time>
          <h1
            className="mt-2 text-4xl md:text-5xl font-medium tracking-tighter leading-tight"
            style={{ color: LIGHT_TEXT_PRIMARY }}
          >
            {meta.title}
          </h1>
          <p className="mt-3 text-base" style={{ color: LIGHT_TEXT_MUTED }}>{meta.description}</p>
          {meta.image && (
            <div className="relative w-full aspect-[16/9] mt-8 rounded-2xl overflow-hidden ring-1 ring-black/10">
              <Image
                src={meta.image}
                alt={meta.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
        </header>
        <article className="blog-article">{children}</article>

        <div className="mt-16 pt-8 border-t border-black/5 flex items-center justify-between">
          <Link href="/blog" className="text-sm font-medium hover:text-neutral-900 transition-colors" style={{ color: LIGHT_TEXT_MUTED }}>
            ← Insights
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            {'Coba SANDWICH'}
            <iconify-icon icon="solar:arrow-right-linear" width="16" />
          </Link>
        </div>
      </main>
    </div>
  )
}
