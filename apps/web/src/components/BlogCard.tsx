import Link from 'next/link'
import Image from 'next/image'
import type { PostMeta } from '../lib/blog'

export default function BlogCard({ post }: { post: PostMeta }) {
  const date = new Date(post.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return (
    <Link href={`/blog/${post.slug}`} className="block group">
      <article className="border border-zinc-200 rounded-2xl overflow-hidden hover:border-zinc-400 transition-colors bg-white">
        <div className="relative w-full aspect-[16/9]">
          <Image
            src={post.image ?? 'https://placehold.co/800x450/F4EBE1/92400E?text=SANDWICH'}
            alt={post.title}
            fill
            className="object-cover"
          />
        </div>
        <div className="p-5">
          <time dateTime={post.date} className="text-xs text-zinc-400 font-medium">{date}</time>
          <h2 className="mt-2 text-base font-semibold text-zinc-900 group-hover:text-[#f91814] transition-colors leading-snug">
            {post.title}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 leading-relaxed line-clamp-2">{post.description}</p>
        </div>
      </article>
    </Link>
  )
}
