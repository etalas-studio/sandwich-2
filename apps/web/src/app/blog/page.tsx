import type { Metadata } from 'next'
import Header from '../../components/Header'
import BlogCard from '../../components/BlogCard'
import { getAllPosts } from '../../lib/blog'

const bowlby = "'Bowlby One', system-ui"

export const metadata: Metadata = {
  title: 'Insights — SANDWICH',
  description: 'Articles on PRD writing, freelance project scoping, and AI tools.',
  alternates: { canonical: '/blog' },
}

export default async function BlogIndexPage() {
  const posts = await getAllPosts()
  return (
    <div className="min-h-screen bg-[#F4EBE1]">
      <div className="pt-8 pb-6 px-6 flex justify-center">
        <Header />
      </div>
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1
            className="text-5xl md:text-6xl tracking-tighter leading-none text-zinc-900"
            style={{ fontFamily: bowlby }}
          >
            Insights
          </h1>
          <p className="mt-3 text-base text-zinc-500 max-w-xl">
            Thoughts on building better products, faster.
          </p>
        </div>
        {posts.length === 0 ? (
          <p className="text-zinc-500">No articles yet.</p>
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
