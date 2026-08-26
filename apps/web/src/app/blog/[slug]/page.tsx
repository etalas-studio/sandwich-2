import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPost, getAllPosts } from '../../../lib/blog'
import BlogLayout from '../../../components/BlogLayout'

export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const post = await getPost(slug)
    return {
      title: `${post.meta.title} — SANDWICH`,
      description: post.meta.description,
      alternates: { canonical: `/blog/${slug}` },
      openGraph: {
        title: post.meta.title,
        description: post.meta.description,
        type: 'article',
        publishedTime: post.meta.date,
        url: `/blog/${slug}`,
      },
    }
  } catch {
    return {}
  }
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  let post: Awaited<ReturnType<typeof getPost>>
  try {
    post = await getPost(slug)
  } catch {
    notFound()
  }
  const Content = post.default
  return (
    <BlogLayout meta={post.meta}>
      <Content />
    </BlogLayout>
  )
}
