import Link from 'next/link'
import Image from 'next/image'
import type { PostMeta } from '../lib/blog'
import { LIGHT_TEXT_PRIMARY, LIGHT_TEXT_MUTED } from './landing/tokens'

export default function BlogCard({ post }: { post: PostMeta }) {
  const date = new Date(post.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return (
    <Link href={`/blog/${post.slug}`} className="block group">
      <article className="rounded-2xl overflow-hidden ring-1 ring-black/10 hover:ring-black/20 transition bg-white">
        <div className="relative w-full aspect-[16/9] bg-black/5">
          <Image
            src={post.image ?? 'https://placehold.co/800x450/f7f7f8/3b82f6?text=Spectr'}
            alt={post.title}
            fill
            className="object-cover"
          />
        </div>
        <div className="p-5">
          <time dateTime={post.date} className="text-xs font-medium" style={{ color: LIGHT_TEXT_MUTED }}>{date}</time>
          <h2
            className="mt-2 text-base font-medium leading-snug transition-colors group-hover:text-[#3b82f6]"
            style={{ color: LIGHT_TEXT_PRIMARY }}
          >
            {post.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed line-clamp-2" style={{ color: LIGHT_TEXT_MUTED }}>{post.description}</p>
        </div>
      </article>
    </Link>
  )
}
