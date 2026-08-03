import { Link, useLocation } from 'react-router-dom'

type NavItem = 'overview' | 'tickets' | 'pi-poc' | 'users' | 'settings'

const navItems: { id: NavItem; label: string; icon: string; disabled?: boolean; to: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'solar:home-2-linear', to: '/overview' },
  { id: 'tickets', label: 'Tickets', icon: 'solar:document-text-linear', to: '/tickets' },
  { id: 'pi-poc', label: 'Pi POC', icon: 'solar:widget-3-linear', to: '/pi-poc' },
  { id: 'users', label: 'Users', icon: 'solar:users-group-rounded-linear', disabled: true, to: '/users' },
  { id: 'settings', label: 'Settings', icon: 'solar:settings-linear', to: '/settings' },
]

interface SidebarProps {
  username: string
  onLogout: () => void
  onPurge: () => void
}

export default function Sidebar({ username, onLogout, onPurge }: SidebarProps) {
  const location = useLocation()
  const initials = username.slice(0, 2).toUpperCase() || '?'

  // Derive active nav from current path
  const getActiveNav = (): NavItem => {
    const path = location.pathname
    if (path === '/overview') return 'overview'
    if (path.startsWith('/tickets')) return 'tickets'
    if (path === '/pi-poc') return 'pi-poc'
    if (path === '/settings') return 'settings'
    return 'overview'
  }
  const active = getActiveNav()

  return (
    <aside className="relative z-20 w-56 shrink-0 border-r border-white/[0.04] bg-[#0a0a0a]/30 backdrop-blur-md flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.04]">
        <div
          className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#333] to-[#111] flex items-center justify-center border border-[#333]"
          style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -2px 6px rgba(0,0,0,0.8)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/90">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-white text-sm font-normal tracking-tight ds-text-shadow">Runchise</span>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className={`
              relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-light transition-colors
              ${item.disabled
                ? 'text-white/20 cursor-not-allowed pointer-events-none'
                : active === item.id
                  ? 'text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.02] cursor-pointer'
              }
            `}
          >
            {active === item.id && !item.disabled && (
              <div
                className="absolute inset-0 rounded-lg border border-white/[0.05] bg-white/[0.03]"
                style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)' }}
              />
            )}
            <iconify-icon
              icon={item.icon}
              width="16"
              className={`relative z-10 ${item.disabled ? 'text-white/20' : active === item.id ? 'text-white/70' : ''}`}
            />
            <span className="relative z-10">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto p-3 border-t border-white/[0.04]">
        {/* TEMPORARY dev-only button — see src/db/purge.ts. */}
        <button
          onClick={onPurge}
          className="w-full mb-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light text-[#ff8a8a]/80 border border-[#ff8a8a]/20 hover:bg-[#ff8a8a]/10 hover:text-[#ff8a8a] transition-colors"
        >
          <iconify-icon icon="solar:trash-bin-2-linear" width="14" />
          Purge DB (dev)
        </button>
        <div className="flex items-center gap-3 px-2 py-1">
          <div
            className="w-7 h-7 rounded-full bg-gradient-to-b from-[#555] to-[#333] flex items-center justify-center text-xs text-white/90 border border-white/10"
            style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 3px rgba(0,0,0,0.6)' }}
          >
            {initials}
          </div>
          <span className="text-sm text-white font-light">{username}</span>
          <button
            onClick={onLogout}
            aria-label="Log out"
            className="ml-auto text-white/30 hover:text-white/60 transition-colors"
          >
            <iconify-icon icon="solar:logout-2-linear" width="14" />
          </button>
        </div>
      </div>
    </aside>
  )
}
