import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS, getActiveNav } from '../lib/navigation'

interface SidebarProps {
  username: string
  onLogout: () => void
}

export default function Sidebar({ username, onLogout }: SidebarProps) {
  const location = useLocation()
  const initials = username.slice(0, 2).toUpperCase() || '?'
  const active = getActiveNav(location.pathname)

  return (
    <aside className="relative z-20 w-56 shrink-0 border-r border-white/[0.04] bg-[#0a0a0a]/30 backdrop-blur-md flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.04]">
        <iconify-icon icon="solar:hand-shake-linear" width="22" className="text-white/60" />
        <span className="text-white text-sm font-normal tracking-tight ds-text-shadow">Runchise</span>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => (
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
        <div className="flex items-center gap-3 px-2 py-1 mb-2">
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
