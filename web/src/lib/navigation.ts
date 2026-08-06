export type NavItem = 'overview' | 'tickets' | 'integrations' | 'users' | 'settings'

export interface NavEntry {
  id: NavItem
  label: string
  icon: string
  disabled?: boolean
  to: string
}

export const NAV_ITEMS: NavEntry[] = [
  { id: 'overview', label: 'Overview', icon: 'solar:home-2-linear', to: '/old/overview' },
  { id: 'tickets', label: 'Tickets', icon: 'solar:notes-linear', to: '/old/tickets' },
  { id: 'integrations', label: 'Integrations', icon: 'solar:link-round-angle-linear', to: '/old/integrations' },
  { id: 'users', label: 'Users', icon: 'solar:users-group-rounded-linear', disabled: true, to: '/old/users' },
  { id: 'settings', label: 'Settings', icon: 'solar:settings-linear', to: '/old/settings' },
]

export function getActiveNav(pathname: string): NavItem {
  if (pathname === '/old/overview') return 'overview'
  if (pathname.startsWith('/old/tickets')) return 'tickets'
  if (pathname === '/old/integrations') return 'integrations'
  if (pathname === '/old/settings') return 'settings'
  return 'overview'
}
