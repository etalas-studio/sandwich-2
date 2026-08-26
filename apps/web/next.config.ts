import createMDX from '@next/mdx'
import type { NextConfig } from 'next'

// ponytail: remarkGfm omitted — Turbopack (default in Next.js 16) cannot serialize
// function-valued loader options. Apply remarkGfm at content-parse time (e.g. via
// next-mdx-remote or a remark processor) when GFM is needed at build pipeline level.
const withMDX = createMDX({})

const config: NextConfig = {}

export default withMDX(config)
