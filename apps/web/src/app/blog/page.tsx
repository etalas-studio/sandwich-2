import type { Metadata } from 'next'
import Header from '../../components/Header'
import BlogCard from '../../components/BlogCard'
import { GridLines } from '../../components/landing/GridLines'
import { LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED } from '../../components/landing/tokens'
import { getAllPosts } from '../../lib/blog'

export const metadata: Metadata = {
  title: 'Insights — SANDWICH',
  description: 'Articles on PRD writing, freelance project scoping, and AI tools.',
  alternates: { canonical: '/blog' },
}

export default async function BlogIndexPage() {
  const posts = await getAllPosts()
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <GridLines />
      <div className="pt-8 pb-6 px-6 flex justify-center relative z-10">
        <Header />
      </div>
      <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        <div className="mb-10">
          <h1
            className="text-5xl md:text-6xl font-medium tracking-tighter leading-none"
            style={{ color: LIGHT_TEXT_PRIMARY }}
          >
            Insights
          </h1>
          <p className="mt-3 text-base max-w-xl" style={{ color: LIGHT_TEXT_MUTED }}>
            Thoughts on building better products, faster.
          </p>
        </div>
        {posts.length === 0 ? (
          <p style={{ color: LIGHT_TEXT_MUTED }}>No articles yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
