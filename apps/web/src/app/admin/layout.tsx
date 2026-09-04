'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../hooks/useAuth'

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: 'solar:widget-2-linear' },
  { href: '/admin/users', label: 'Users', icon: 'solar:users-group-rounded-linear' },
  { href: '/admin/config', label: 'Configuration', icon: 'solar:settings-linear' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { state, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)
  const [showAccountMenu, setShowAccountMenu] = useState(false)

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

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      router.replace('/login')
    } finally {
      setLoggingOut(false)
    }
  }

  const username = state.username ?? state.email ?? '?'
  const initial = username.charAt(0).toUpperCase()

  return (
    <div className="flex min-h-screen text-neutral-800" style={{ backgroundColor: '#f8fafc' }}>
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r px-3 py-5" style={{ backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
        {/* Brand */}
        <div className="mb-7 px-2 flex items-center gap-2">
          <img src="/logo.png" alt="Spectr" className="h-6 w-auto brightness-0" />
          <div>
            <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: '#111827', fontFamily: "'Instrument Serif', serif" }}>
              Spectr
            </span>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(0,0,0,0.35)' }}>
              Admin
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
                style={active
                  ? { backgroundColor: '#3b82f6', color: '#ffffff', fontWeight: 500 }
                  : { color: '#374151' }
                }
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.06)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
              >
                <iconify-icon icon={icon} width="16" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: back link + user */}
        <div className="mt-auto border-t pt-3" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm mb-1 transition-colors"
            style={{ color: 'rgba(0,0,0,0.4)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
          >
            <iconify-icon icon="solar:arrow-left-linear" width="15" />
            Dashboard
          </Link>

          {/* User pill */}
          <button
            onClick={() => setShowAccountMenu(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
            style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)')}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#3b82f6' }}>
              {initial}
            </div>
            <p className="text-xs font-medium truncate" style={{ color: '#111827' }}>{username}</p>
          </button>

          {showAccountMenu && (
            <div className="fixed inset-0 z-50" onClick={() => setShowAccountMenu(false)}>
              <style>{`@keyframes slideUp { from { transform: translateY(4px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
              <div
                className="absolute bottom-16 left-3 w-[200px] rounded-xl overflow-hidden"
                style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', animation: 'slideUp 0.15s ease-out', boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <p className="text-sm font-semibold" style={{ color: '#111827' }}>{username}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>{state.email}</p>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => { setShowAccountMenu(false); void handleLogout() }}
                    disabled={loggingOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left disabled:opacity-50"
                    style={{ color: '#f87171' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <iconify-icon icon="solar:logout-2-linear" width="15" />
                    {loggingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-10 py-10">{children}</main>
    </div>
  )
}
