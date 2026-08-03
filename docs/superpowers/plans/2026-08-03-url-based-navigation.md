# URL-Based Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace state-based navigation with URL-based routing using react-router-dom.

**Architecture:** Use BrowserRouter with Routes/Route components. Navigation state derived from URL via useLocation and useSearchParams hooks. Sidebar uses Link components instead of callbacks.

**Tech Stack:** React 19, react-router-dom, Vite

## Global Constraints

- React 19.2.8 already installed
- Must preserve all existing functionality
- Query param format: `?selected=KEY` for ticket detail overlay
- Routes: `/overview`, `/tickets`, `/settings`, with `/` redirecting to `/overview`

---

### Task 1: Install react-router-dom

**Files:**
- Modify: `web/package.json`

**Interfaces:**
- Produces: `react-router-dom` package available for import

- [ ] **Step 1: Install the dependency**

```bash
cd web && npm install react-router-dom
```

- [ ] **Step 2: Verify installation**

```bash
cd web && npm ls react-router-dom
```

Expected: shows installed version

- [ ] **Step 3: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore: add react-router-dom dependency"
```

---

### Task 2: Wrap App with BrowserRouter

**Files:**
- Modify: `web/src/main.tsx`

**Interfaces:**
- Produces: Router context available to all components

- [ ] **Step 1: Update main.tsx to wrap with BrowserRouter**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 2: Verify build passes**

```bash
cd web && npm run build
```

Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add web/src/main.tsx
git commit -m "feat: wrap App with BrowserRouter"
```

---

### Task 3: Update Sidebar to use Link and useLocation

**Files:**
- Modify: `web/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: Router context from Task 2
- Produces: Sidebar with URL-based navigation via `<Link>` components

- [ ] **Step 1: Update Sidebar.tsx imports and replace callback with Link**

```tsx
import { Link, useLocation } from 'react-router-dom'

type NavItem = 'overview' | 'tickets' | 'users' | 'settings'

const navItems: { id: NavItem; label: string; icon: string; disabled?: boolean; to: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'solar:home-2-linear', to: '/overview' },
  { id: 'tickets', label: 'Tickets', icon: 'solar:document-text-linear', to: '/tickets' },
  { id: 'users', label: 'Users', icon: 'solar:users-group-rounded-linear', disabled: true, to: '/users' },
  { id: 'settings', label: 'Settings', icon: 'solar:settings-linear', to: '/settings' },
]

interface SidebarProps {
  active: NavItem
}

export default function Sidebar({ active }: SidebarProps) {
  const location = useLocation()

  return (
    <aside className="relative z-20 w-56 shrink-0 border-r border-white/[0.04] bg-[#0a0a0a]/30 backdrop-blur-md flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.04]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#333] to-[#111] flex items-center justify-center border border-[#333]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -2px 6px rgba(0,0,0,0.8)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/90">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span className="text-white text-sm font-normal tracking-tight ds-text-shadow">Runchise</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            onClick={() => {
              console.log('Click:', item.id, 'disabled:', item.disabled)
            }}
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
              <div className="absolute inset-0 rounded-lg border border-white/[0.05] bg-white/[0.03]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)' }} />
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

      {/* User */}
      <div className="mt-auto p-3 border-t border-white/[0.04]">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-b from-[#555] to-[#333] flex items-center justify-center text-xs text-white/90 border border-white/10" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 3px rgba(0,0,0,0.6)' }}>
            JD
          </div>
          <span className="text-sm text-white font-light">Jane Doe</span>
          <button className="ml-auto text-white/30 hover:text-white/60 transition-colors">
            <iconify-icon icon="solar:menu-dots-linear" width="14" />
          </button>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd web && npm run build
```

Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Sidebar.tsx
git commit -m "feat: update Sidebar to use Link and useLocation"
```

---

### Task 4: Update Settings to use Link instead of callback

**Files:**
- Modify: `web/src/components/Settings.tsx`

**Interfaces:**
- Consumes: Router context from Task 2
- Produces: Settings page with Link-based back navigation

- [ ] **Step 1: Update Settings.tsx to use Link instead of onBack callback**

Update the import section and interface:

```tsx
import { Link } from 'react-router-dom'
import { useState } from 'react'
import ProjectSection from './ProjectSection'
import BlocklistSection, { mockBlocklist, type BlocklistEntry } from './BlocklistSection'
import CredentialsSection, { mockCredentials, type Credential } from './CredentialsSection'
import AccountSection, { mockAccount } from './AccountSection'

export default function Settings() {
  // ... rest of the component unchanged until the header
```

Update the header section:

```tsx
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Link
            className="text-white/40 hover:text-white transition-colors"
            to="/overview"
          >
            <iconify-icon icon="solar:arrow-left-linear" width="16" />
          </Link>
          <h1 className="text-2xl font-normal tracking-tight text-white ds-text-shadow">
            Settings
          </h1>
        </div>
        <p className="text-sm text-white/50 font-light ml-7">
          Manage project, blocklist, credentials, and account settings
        </p>
      </div>
```

- [ ] **Step 2: Verify build passes**

```bash
cd web && npm run build
```

Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Settings.tsx
git commit -m "feat: update Settings to use Link instead of onBack callback"
```

---

### Task 5: Add routes and URL-based state to App.tsx

**Files:**
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: Router context from Task 2, updated Sidebar from Task 3, updated Settings from Task 4
- Produces: Full URL-based navigation system

- [ ] **Step 1: Update imports and add routing**

Replace the entire App.tsx with URL-based routing:

```tsx
import { Routes, Route, Navigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import { useTickets, runTicket, stopTicket, duplicateTicket, deleteTicket, createTicket, computeStats, useRunArtifacts } from './types'
import type { Ticket } from './types'
import Sidebar from './components/Sidebar'
import StatsCards from './components/StatsCards'
import KanbanBoard from './components/KanbanBoard'
import TicketDetail from './components/TicketDetail'
import Settings from './components/Settings'
import mockData from './mockData'

const QUICK_ADD_TICKET = {
  key: 'RR-7338',
  url: 'https://runchise.atlassian.net/browse/RR-7338',
  summary: 'Bug: Exported File Name Replaces Mandarin Characters with Underscores (_)',
  description:
    '### Issue\n\nWhen exporting or downloading files, any Mandarin characters included in the file name are replaced with underscores (`_`) instead of being preserved.\n\nThis issue occurs regardless of the system language (Bahasa Indonesia, English, or Mandarin).\n\n**Example**\n\n* **Brand Name:** `Onboard Fajar 库存变动`\n* **Expected File Name:** `Onboard_Fajar_库存变动.xlsx`\n* **Actual File Name:** `Onboard_Fajar_____.xlsx` (Mandarin characters replaced with `_`)\n\n### Expected Behavior\n\n* Preserve all supported Unicode characters (including Mandarin) in exported file names.\n* File names should display correctly across all supported languages without replacing non-Latin characters with underscores.\n* The exported file name should match the original brand name (except for invalid filesystem characters that must still be sanitized).\n\n### Acceptance Criteria\n\n1. Exported file names preserve Mandarin characters.\n2. Exported file names preserve Unicode characters for all supported languages.\n3. Only invalid filename characters (e.g. `\\ / : * ? " < > |`) are sanitized or replaced.\n4. Export works correctly for all export types (e.g. Onboarding, Stock Product, and other exported reports/files).\n5. The issue is resolved regardless of the selected system language (English, Bahasa Indonesia, or Mandarin).',
}

function OverviewPage() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl text-white/50 font-light">Overview</h2>
        <p className="text-sm text-white/30 mt-2">Coming soon</p>
      </div>
    </div>
  )
}

function TicketsPage() {
  const { tickets, error } = useTickets()
  const [searchParams, setSearchParams] = useSearchParams()
  const [startingKeys, setStartingKeys] = useState<Set<string>>(new Set())
  const [stoppingKeys, setStoppingKeys] = useState<Set<string>>(new Set())
  const [runError, setRunError] = useState<string | null>(null)

  const selectedKey = searchParams.get('selected')
  const displayTickets = tickets ?? mockData.tickets
  const stats = computeStats(displayTickets)
  const selectedTicket = selectedKey ? displayTickets.find(t => t.key === selectedKey) ?? null : null

  const handleOpenTicket = (ticket: Ticket) => {
    setSearchParams({ selected: ticket.key })
  }

  const handleCloseTicket = () => {
    setSearchParams({})
  }

  const handleRunTicket = (key: string) => {
    setStartingKeys((prev) => new Set(prev).add(key))
    setRunError(null)
    runTicket(key)
      .then((result) => {
        if (!result.ok) setRunError(`Could not start ${key}: ${result.message}`)
      })
      .finally(() => {
        setStartingKeys((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
  }

  const handleStopTicket = (key: string) => {
    setStoppingKeys((prev) => new Set(prev).add(key))
    setRunError(null)
    stopTicket(key)
      .then((result) => {
        if (!result.ok) setRunError(`Could not stop ${key}: ${result.message}`)
      })
      .finally(() => {
        setStoppingKeys((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
  }

  const handleDuplicateTicket = (key: string) => {
    setRunError(null)
    duplicateTicket(key).then((result) => {
      if (!result.ok) setRunError(`Could not duplicate ${key}: ${result.message}`)
    })
  }

  const handleDeleteTicket = (key: string) => {
    if (!window.confirm(`Delete ${key}? This also removes its run history.`)) return
    setRunError(null)
    deleteTicket(key).then((result) => {
      if (!result.ok) setRunError(`Could not delete ${key}: ${result.message}`)
    })
  }

  const handleQuickAdd = () => {
    setRunError(null)
    createTicket(QUICK_ADD_TICKET).then((result) => {
      if (!result.ok) setRunError(`Could not add ticket: ${result.message}`)
    })
  }

  return (
    <>
      <div className="h-full overflow-y-auto hide-scrollbar p-6">
        {/* Error banner */}
        {error && (
          <div className="ds-card-outer mb-6">
            <div className="ds-card-inner p-4 border-l-2 border-l-[#ff8a8a]">
              <p className="text-sm text-[#ff8a8a]">Could not connect to server: {error}</p>
              <p className="text-xs text-white/50 mt-1">Showing mock data instead.</p>
            </div>
          </div>
        )}
        {runError && (
          <div className="ds-card-outer mb-6">
            <div className="ds-card-inner p-4 border-l-2 border-l-[#ff8a8a]">
              <p className="text-sm text-[#ff8a8a]">{runError}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-normal tracking-tight text-white ds-text-shadow">
                Tickets
              </h1>
              <span className="px-2.5 py-1 rounded-full border border-white/[0.05] bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] text-[10px] text-white/70" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)' }}>
                Today
              </span>
            </div>
            <p className="text-sm text-white/50 font-light">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}
              {displayTickets.length} tickets · {displayTickets.filter(t => t.status === 'in_progress').length} active
            </p>
          </div>
          <button
            type="button"
            onClick={handleQuickAdd}
            className="relative inline-flex group shrink-0"
          >
            <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
            <span
              className="relative px-4 py-2 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] flex items-center gap-1.5"
              style={{
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              <iconify-icon icon="solar:add-circle-linear" width="14" />
              Quick Add
            </span>
          </button>
        </div>

        {/* Stats */}
        <StatsCards stats={stats} />

        {/* Kanban */}
        <KanbanBoard
          tickets={displayTickets}
          onOpenTicket={handleOpenTicket}
          onRunTicket={handleRunTicket}
          onStopTicket={handleStopTicket}
          onDuplicateTicket={handleDuplicateTicket}
          onDeleteTicket={handleDeleteTicket}
          startingKeys={startingKeys}
          stoppingKeys={stoppingKeys}
        />
      </div>

      {/* Ticket detail overlay */}
      {selectedTicket && (
        <TicketDetail ticket={selectedTicket} onClose={handleCloseTicket} />
      )}
    </>
  )
}

function AppLayout() {
  const location = useLocation()

  // Determine active nav from current path
  const getActiveNav = (): 'overview' | 'tickets' | 'users' | 'settings' => {
    const path = location.pathname
    if (path === '/overview') return 'overview'
    if (path.startsWith('/tickets')) return 'tickets'
    if (path === '/settings') return 'settings'
    return 'overview'
  }

  return (
    <div className="ds-card-outer min-h-screen">
      <div className="ds-card-inner flex min-h-screen">
        {/* Sidebar */}
        <Sidebar active={getActiveNav()} />

        {/* Noise texture overlay */}
        <div className="ds-noise" />

        {/* Main content */}
        <main className="relative z-10 flex-1 min-h-screen overflow-hidden">
          <Routes>
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/*" element={<AppLayout />} />
    </Routes>
  )
}
```

- [ ] **Step 2: Remove unused imports from types.ts if needed**

Check if `useState` import is needed in App.tsx. It's used in TicketsPage for `startingKeys`, `stoppingKeys`, `runError` - so keep it.

- [ ] **Step 3: Verify build passes**

```bash
cd web && npm run build
```

Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: add URL-based routing to App.tsx"
```

---

### Task 6: Verify and test

**Files:**
- None (verification only)

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: build succeeds

- [ ] **Step 2: Run selftest**

```bash
npm run selftest
```

Expected: all tests pass

- [ ] **Step 3: Manual verification checklist**

Start the dev server and verify:

```bash
cd web && npm run dev
```

Check:
- [ ] `/` redirects to `/overview`
- [ ] `/overview` shows placeholder
- [ ] `/tickets` shows kanban board
- [ ] `/tickets?selected=RR-7338` shows ticket detail overlay
- [ ] `/settings` shows settings page
- [ ] Sidebar highlights correct nav item on each route
- [ ] Clicking sidebar nav items updates URL
- [ ] Browser back/forward buttons work
- [ ] Closing ticket detail removes `?selected=` from URL

- [ ] **Step 4: Final commit with roadmap update**

```bash
git add -A
git commit -m "feat: complete URL-based navigation implementation"
```
