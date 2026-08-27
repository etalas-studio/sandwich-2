# Blog — MDX-based article system

**Date:** 2026-08-26  
**Status:** Approved for implementation

## Goal

Add a `/blog` section to the SANDWICH Next.js app that serves static MDX articles, fully SSR'd for SEO, with per-article `generateMetadata` for title, description, and OG tags.

## Architecture

MDX files live in `apps/web/content/blog/`. Next.js reads them at build time via `@next/mdx`. No CMS, no database, no runtime fetching.

```
apps/web/
  content/
    blog/
      cara-bikin-prd.mdx
      lovable-alternative.mdx
      ...
  src/
    app/
      blog/
        page.tsx          ← /blog index (server component)
        [slug]/
          page.tsx        ← /blog/[slug] dynamic route (server component)
    components/
      BlogLayout.tsx      ← shared article wrapper
      BlogCard.tsx        ← card used on /blog index
```

## Dependencies

```
@next/mdx
@mdx-js/loader
@mdx-js/react
remark-gfm        ← GitHub-flavoured markdown (tables, strikethrough)
```

No gray-matter — frontmatter is replaced by named exports from each MDX file (same pattern as Next.js `export const metadata`).

## MDX file format

Each article exports a `meta` object plus default JSX content:

```mdx
export const meta = {
  title: 'Cara Bikin PRD yang Benar',
  description: 'Panduan lengkap membuat PRD untuk freelancer dan product manager.',
  date: '2026-08-26',
  slug: 'cara-bikin-prd',
}

## Intro

Article body here...
```

The `slug` field must match the filename (without `.mdx`). `date` is ISO 8601.

## Content reader utility

`src/lib/blog.ts` — two functions, no third-party dep:

- `getAllPosts()` — reads `content/blog/*.mdx`, dynamically imports each, returns array of `meta` objects sorted by date descending. Used by `/blog` index.
- `getPost(slug)` — imports one MDX file by slug, returns `{ meta, default: Component }`. Used by `/blog/[slug]`.

Both use `fs` and dynamic `import()` — server-only, never shipped to the client.

## Routes

### `/blog` — index

Server component. Calls `getAllPosts()`, renders a list of `<BlogCard>` components. Static metadata:

```ts
export const metadata: Metadata = {
  title: 'Blog — SANDWICH',
  description: 'Articles on PRD writing, freelance project scoping, and AI tools.',
}
```

### `/blog/[slug]` — article

Server component. Calls `getPost(slug)`, 404s via `notFound()` if missing. Exports `generateMetadata` that reads from the MDX `meta` export:

```ts
export async function generateMetadata({ params }) {
  const { meta } = await getPost(params.slug)
  return {
    title: `${meta.title} — SANDWICH`,
    description: meta.description,
    openGraph: { title: meta.title, description: meta.description },
    twitter: { card: 'summary_large_image', title: meta.title, description: meta.description },
    alternates: { canonical: `/blog/${meta.slug}` },
  }
}
```

`generateStaticParams` exports all slugs for static generation at build time.

## Header extraction

The `<nav>` block (including mobile nav) in `LandingPage.tsx` is extracted into `src/components/Header.tsx`. `LandingPage.tsx` imports and renders `<Header>` — no behaviour change. Blog pages also use `<Header>`.

On `/blog` and `/blog/[slug]`, scroll-anchor links (Pipeline, How, Pricing, FAQ) will not scroll anything — they link to `/#harnesses` etc. so they still work as cross-page anchors. Login and Get Started behave normally. Logo links to `/`.

"Blog" is added to the nav link list and the footer's Product section.

## Components

**`Header`** — extracted from `LandingPage.tsx`. Accepts no props. Renders logo, nav links (including Blog), Login, Get Started, mobile nav.

**`BlogLayout`** — wraps article content. Renders `<Header>`, article `<header>` (title + date), `<article>` with prose typography class, no sidebar.

**`BlogCard`** — used on `/blog` index. Shows title, date, and description. Links to `/blog/[slug]`.

## Sitemap

`public/sitemap.xml` is currently hand-authored. After blog is live, update it to include `/blog` and each article URL. Long-term this should become a `src/app/sitemap.ts` (Next.js dynamic sitemap) — not in scope for this task, but noted.

## next.config.ts change

```ts
import createMDX from '@next/mdx'
import remarkGfm from 'remark-gfm'

const withMDX = createMDX({ options: { remarkPlugins: [remarkGfm] } })
export default withMDX({ /* existing config */ })
```

## Out of scope

- Comments
- Tags / categories
- Search
- RSS feed
- Author profiles
- Image optimisation inside MDX (use standard Next.js `<Image>` in MDX body)
- Dynamic sitemap (noted above, do after first articles are live)
