'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../hooks/useAuth'

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/config', label: 'Configuration' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { state, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && state.status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [isLoading, state.status, router])

  if (isLoading || state.status !== 'authenticated') {
    return <div className="min-h-screen bg-neutral-950" />
  }

  if (state.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        Forbidden — admin only.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <nav className="border-b border-neutral-800 px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-6">
          <span className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">
            Admin
          </span>
          <div className="flex gap-1">
            {NAV.map(({ href, label }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-neutral-800 text-neutral-100'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>
          <div className="ml-auto">
            <Link
              href="/dashboard"
              className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-900"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </nav>
      <main className="px-6 py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
