'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LogOut, ChevronDown, LayoutDashboard, Users, Settings, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/config', label: 'Configuration', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { state, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)

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

  const initials = (state.username ?? state.email ?? '?')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-neutral-800/60 px-3 py-5">
        {/* Brand */}
        <div className="mb-7 px-2">
          <span
            className="text-lg tracking-wide text-white"
            style={{ fontFamily: "'Bowlby One', sans-serif" }}
          >
            Spectr
          </span>
          <div className="mt-0.5 text-[10px] uppercase tracking-widest text-neutral-600">
            Admin
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: back link + user */}
        <div className="mt-auto space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-600 transition-colors hover:text-neutral-400"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            Dashboard
          </Link>

          {/* User info + logout */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-900 outline-none">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-medium text-neutral-300">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-neutral-200">
                  {state.username}
                </div>
                <div className="truncate text-[10px] text-neutral-500">
                  {state.email}
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52 bg-neutral-900 border-neutral-800">
              <div className="px-2 py-1.5 text-xs text-neutral-500">
                {state.email}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={loggingOut}
                className="gap-2 text-sm text-neutral-300 hover:text-white focus:text-white cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-10 py-10">{children}</main>
    </div>
  )
}
