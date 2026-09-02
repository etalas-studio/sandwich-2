import fs from 'fs'
import path from 'path'
import type React from 'react'

export type PostMeta = {
  title: string
  description: string
  date: string
  slug: string
  image?: string
}

// ponytail: static import map — Turbopack cannot handle template-literal dynamic
// imports at build time. When adding a new MDX post, register it here. Switch to
// template-literal dynamic import once Turbopack supports it.
type BlogModule = Promise<{ meta: PostMeta; default: React.ComponentType }>

const BLOG_MODULES: Record<string, () => BlogModule> = {
  'apa-itu-brief-klien': () => import('../../content/blog/apa-itu-brief-klien.mdx') as BlogModule,
  'apa-itu-prd': () => import('../../content/blog/apa-itu-prd.mdx') as BlogModule,
  'apa-itu-prototype': () => import('../../content/blog/apa-itu-prototype.mdx') as BlogModule,
  'apa-itu-scope-of-work': () => import('../../content/blog/apa-itu-scope-of-work.mdx') as BlogModule,
  'cara-bikin-prd': () => import('../../content/blog/cara-bikin-prd.mdx') as BlogModule,
  'kenapa-vibe-coding-butuh-prd': () => import('../../content/blog/kenapa-vibe-coding-butuh-prd.mdx') as BlogModule,
  'lovable-alternative': () => import('../../content/blog/lovable-alternative.mdx') as BlogModule,
  'prd-adalah': () => import('../../content/blog/prd-adalah.mdx') as BlogModule,
  'scope-pekerjaan-adalah': () => import('../../content/blog/scope-pekerjaan-adalah.mdx') as BlogModule,
}

const BLOG_DIR = path.join(process.cwd(), 'content/blog')

export async function getAllPosts(): Promise<PostMeta[]> {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'))
  const posts = await Promise.all(
    files.map(async (file) => {
      const slug = file.replace(/\.mdx$/, '')
      const loader = BLOG_MODULES[slug]
      if (!loader) throw new Error(`No import registered for slug: ${slug}`)
      const mod = await loader()
      return { ...mod.meta, slug }
    }),
  )
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export async function getPost(slug: string): Promise<{ meta: PostMeta; default: React.ComponentType }> {
  const loader = BLOG_MODULES[slug]
  if (!loader) throw new Error(`Post not found: ${slug}`)
  return loader()
}
