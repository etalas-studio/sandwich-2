import type { Metadata } from 'next'
import Header from '../../components/Header'
import BlogCard from '../../components/BlogCard'
import { getAllPosts } from '../../lib/blog'

export const metadata: Metadata = {
  title: 'Blog — SANDWICH',
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
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-zinc-900 mb-8">Blog</h1>
        {posts.length === 0 ? (
          <p className="text-zinc-500">No articles yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
