import Link from 'next/link'
import Header from './Header'
import type { PostMeta } from '../lib/blog'

const bowlby = "'Bowlby One', system-ui"

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
    <div className="min-h-screen bg-[#F4EBE1]">
      <div className="pt-8 pb-6 px-6 flex justify-center">
        <Header />
      </div>
      <main className="max-w-2xl mx-auto px-6 py-12">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mb-8"
        >
          ← Insights
        </Link>
        <header className="mb-10">
          <time dateTime={meta.date} className="text-xs text-zinc-400 font-medium">
            {date}
          </time>
          <h1
            className="mt-2 text-4xl md:text-5xl tracking-tighter leading-tight text-zinc-900"
            style={{ fontFamily: bowlby }}
          >
            {meta.title}
          </h1>
          <p className="mt-3 text-base text-zinc-500">{meta.description}</p>
        </header>
        <article className="blog-article">{children}</article>
      </main>
    </div>
  )
}
