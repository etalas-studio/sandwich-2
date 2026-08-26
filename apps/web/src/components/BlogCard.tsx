import Link from 'next/link'
import type { PostMeta } from '../lib/blog'

export default function BlogCard({ post }: { post: PostMeta }) {
  const date = new Date(post.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return (
    <Link href={`/blog/${post.slug}`} className="block group">
      <article className="border border-zinc-200 rounded-2xl p-6 hover:border-zinc-400 transition-colors">
        <time dateTime={post.date} className="text-xs text-zinc-400 font-medium">{date}</time>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900 group-hover:text-[#f91814] transition-colors leading-snug">
          {post.title}
        </h2>
        <p className="mt-2 text-sm text-zinc-500 leading-relaxed line-clamp-2">{post.description}</p>
      </article>
    </Link>
  )
}
