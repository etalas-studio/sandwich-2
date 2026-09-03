import createMDX from '@next/mdx'
import type { NextConfig } from 'next'

// ponytail: remarkGfm omitted — Turbopack (default in Next.js 16) cannot serialize
// function-valued loader options. Apply remarkGfm at content-parse time (e.g. via
// next-mdx-remote or a remark processor) when GFM is needed at build pipeline level.
const withMDX = createMDX({})

const config: NextConfig = {
  images: {
    remotePatterns: [{ hostname: 'placehold.co' }],
  },
  // Dev-only: proxy /api/* and /p/* to the Express BE on 4319
  async rewrites() {
    return process.env.NODE_ENV === 'development'
      ? [{ source: '/api/:path*', destination: 'http://localhost:4319/api/:path*' },
         { source: '/p/:path*', destination: 'http://localhost:4319/p/:path*' }]
      : []
  },
}

export default withMDX(config)
