import { useState } from 'react'
import { useProject } from '../hooks/useProject'
import { useIntegrations } from '../hooks/useIntegrations'
import { fetchOrgs, fetchRepos } from '../api/projects'
import type { ProjectProvider, VcsOrg, VcsRepo } from '../api/projects'
import { useQuery } from '@tanstack/react-query'

const PROVIDERS: Array<{ id: ProjectProvider; name: string; logo: string }> = [
  { id: 'github', name: 'GitHub', logo: 'simple-icons:github' },
  { id: 'bitbucket', name: 'Bitbucket', logo: 'simple-icons:bitbucket' },
]

function ButtonPrimary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      className="relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed"
      disabled={disabled}
      onClick={onClick}
    >
      <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
      <span
        className="relative px-4 py-2 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
        style={{
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        {children}
      </span>
    </button>
  )
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ds-card-outer ds-shadow-elevated">
      <div className="ds-card-inner p-6">
        <div className="absolute inset-0 ds-noise pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-base font-normal tracking-tight text-white ds-text-shadow mb-4">Project</h3>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Provider picker (no provider connected yet) ──

function ProviderPicker({ connectedProviders }: { connectedProviders: Set<ProjectProvider> }) {
  return (
    <div>
      <p className="text-xs text-white/50 font-light mb-4">
        Connect GitHub or Bitbucket to pick a repository. Automation and Open PR run against your chosen repo.
      </p>
      <div className="flex gap-3">
        {PROVIDERS.map((p) => (
          <a
            key={p.id}
            href={`/api/integrations/${p.id}/authorize`}
            className="flex-1 flex items-center gap-2 justify-center px-4 py-3 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-white/80 hover:bg-white/[0.06] transition-colors"
          >
            <iconify-icon icon={p.logo} width="16" />
            {connectedProviders.has(p.id) ? `Use ${p.name}` : p.name}
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Org/repo picker (provider connected, no project chosen) ──

function RepoPicker({
  provider,
  onConnect,
  isConnecting,
}: {
  provider: ProjectProvider
  onConnect: (owner: string, repoSlug: string, defaultBranch: string) => void
  isConnecting: boolean
}) {
  const [org, setOrg] = useState<string | null>(null)
  const [customOrg, setCustomOrg] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [repos, setRepos] = useState<VcsRepo[]>([])

  const orgsQuery = useQuery<VcsOrg[]>({
    queryKey: ['project-orgs', provider],
    queryFn: () => fetchOrgs(provider),
  })

  // Use customOrg if typed, otherwise first discovered org
  const selectedOrg = customOrg || (org ?? orgsQuery.data?.[0]?.slug) || null

  const reposQuery = useQuery({
    queryKey: ['project-repos', provider, selectedOrg, page, q],
    queryFn: () => fetchRepos(provider, selectedOrg!, page, q || undefined),
    enabled: !!selectedOrg,
  })

  const allRepos = page === 1 ? reposQuery.data?.repos ?? [] : [...repos, ...(reposQuery.data?.repos ?? [])]

  const handleLoadMore = () => {
    if (reposQuery.data?.nextPage) {
      setRepos(allRepos)
      setPage(reposQuery.data.nextPage)
    }
  }

  return (
    <div>
      <p className="text-xs text-white/50 font-light mb-4">Pick a repository to connect.</p>

      {orgsQuery.isLoading && (
        <div className="flex items-center gap-2 mb-3 text-xs text-white/40">
          <iconify-icon icon="solar:refresh-linear" width="14" className="animate-spin" />
          Syncing workspaces…
        </div>
      )}

      {orgsQuery.isError && (
        <div className="mb-3 p-2.5 rounded border border-[#ff8a8a]/20 bg-[#ff8a8a]/[0.04]">
          <p className="text-xs text-[#ff8a8a] font-light">
            Failed to load workspaces: {orgsQuery.error instanceof Error ? orgsQuery.error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {orgsQuery.data && orgsQuery.data.length > 0 && (
        <select
          value={customOrg || (org ?? '')}
          onChange={(e) => {
            setOrg(e.target.value)
            setCustomOrg('')
            setPage(1)
            setRepos([])
          }}
          className="w-full mb-3 bg-[#0a0a0a] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/10 font-light"
        >
          {orgsQuery.data.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.isPersonal ? `${o.name} (personal)` : o.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Or type a workspace slug…"
          value={customOrg}
          onChange={(e) => {
            setCustomOrg(e.target.value)
            setOrg(null)
            setPage(1)
            setRepos([])
          }}
          className="flex-1 bg-[#0a0a0a] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/10 font-light"
        />
      </div>

      <input
        type="text"
        placeholder="Search repositories…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setPage(1)
          setRepos([])
        }}
        className="w-full mb-3 bg-[#0a0a0a] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/10 font-light"
      />

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {reposQuery.isLoading && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-white/40">
            <iconify-icon icon="solar:refresh-linear" width="14" className="animate-spin" />
            Loading repositories…
          </div>
        )}
        {allRepos.map((repo) => (
          <button
            key={`${repo.owner}/${repo.slug}`}
            onClick={() => onConnect(repo.owner, repo.slug, repo.defaultBranch)}
            disabled={isConnecting}
            className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] text-sm text-white/80 font-mono transition-colors disabled:opacity-40"
          >
            {repo.slug}
          </button>
        ))}
      </div>

      {reposQuery.isError && (
        <div className="mt-3 p-2.5 rounded border border-[#ff8a8a]/20 bg-[#ff8a8a]/[0.04]">
          <p className="text-xs text-[#ff8a8a] font-light">
            Failed to load repositories: {reposQuery.error instanceof Error ? reposQuery.error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {reposQuery.data?.nextPage && (
        <button
          onClick={handleLoadMore}
          className="mt-3 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          Load more
        </button>
      )}
    </div>
  )
}

// ── Main component ──

export default function ProjectSection() {
  const { project, isLoading, isConnecting, isSyncing, connect, clear, sync } = useProject()
  const { integrations } = useIntegrations()
  const [pickerProvider, setPickerProvider] = useState<ProjectProvider | null>(null)
  const [confirmingChange, setConfirmingChange] = useState(false)

  const connectedProviders = new Set(
    integrations.filter((i) => (i.id === 'github' || i.id === 'bitbucket') && i.connected).map((i) => i.id as ProjectProvider),
  )

  if (isLoading) {
    return (
      <CardShell>
        <div className="h-24 animate-pulse bg-white/[0.02] rounded-lg" />
      </CardShell>
    )
  }

  // ── Connected: collapsed summary ──
  if (project && project.cloneStatus === 'ready') {
    return (
      <CardShell>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <iconify-icon icon={project.provider === 'github' ? 'simple-icons:github' : 'simple-icons:bitbucket'} width="18" className="text-white/60" />
            <div>
              <p className="text-sm text-white/90 font-mono">{project.owner}/{project.repoSlug}</p>
              <p className="text-xs text-white/40 font-light">{project.defaultBranch}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ButtonPrimary onClick={sync} disabled={isSyncing}>
              {isSyncing ? 'Pulling…' : 'Sync'}
            </ButtonPrimary>
            <button
              onClick={() => setConfirmingChange(true)}
              className="px-4 py-2 rounded-lg text-xs text-white/60 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              Change project
            </button>
          </div>
        </div>

        {confirmingChange && (
          <div className="mt-4 p-4 rounded-lg border border-[#ff8a8a]/20 bg-[#ff8a8a]/[0.04]">
            <p className="text-xs text-white/70 font-light mb-3">
              This will delete all tickets, blocklist entries, and scan history for the current project. Continue?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingChange(false)}
                className="px-3 py-1.5 rounded-md text-xs text-white/60 border border-white/[0.08]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await clear()
                  setConfirmingChange(false)
                }}
                className="px-3 py-1.5 rounded-md text-xs text-[#ff8a8a] border border-[#ff8a8a]/30 bg-[#ff8a8a]/10"
              >
                Delete and change project
              </button>
            </div>
          </div>
        )}
      </CardShell>
    )
  }

  // ── Cloning ──
  if (project && project.cloneStatus === 'cloning') {
    return (
      <CardShell>
        <div className="flex items-center gap-3">
          <iconify-icon icon="solar:refresh-linear" width="18" className="text-white/60 animate-spin" />
          <p className="text-sm text-white/70 font-light">Setting up project…</p>
        </div>
      </CardShell>
    )
  }

  // ── Failed ──
  if (project && project.cloneStatus === 'failed') {
    return (
      <CardShell>
        <div className="p-3 rounded-lg border border-[#ff8a8a]/20 bg-[#ff8a8a]/[0.04] mb-3">
          <p className="text-xs text-[#ff8a8a] font-light">{project.cloneError ?? 'Failed to set up project.'}</p>
        </div>
        <button
          onClick={clear}
          className="px-4 py-2 rounded-lg text-xs text-white/60 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
        >
          Back to repos
        </button>
      </CardShell>
    )
  }

  // ── Repo picker (a provider is connected but nothing chosen yet) ──
  const activeProvider = pickerProvider ?? (connectedProviders.size > 0 ? [...connectedProviders][0]! : null)
  if (activeProvider) {
    return (
      <CardShell>
        {connectedProviders.size > 1 && (
          <div className="flex gap-2 mb-3">
            {[...connectedProviders].map((p) => (
              <button
                key={p}
                onClick={() => setPickerProvider(p)}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                  activeProvider === p ? 'text-white bg-white/[0.08]' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {PROVIDERS.find((provider) => provider.id === p)?.name}
              </button>
            ))}
          </div>
        )}
        <RepoPicker
          provider={activeProvider}
          isConnecting={isConnecting}
          onConnect={(owner, repoSlug, defaultBranch) => connect(activeProvider, owner, repoSlug, defaultBranch)}
        />
      </CardShell>
    )
  }

  // ── Provider picker (nothing connected yet) ──
  return (
    <CardShell>
      <ProviderPicker connectedProviders={connectedProviders} />
    </CardShell>
  )
}
