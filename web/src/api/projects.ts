export type ProjectProvider = 'github' | 'bitbucket'
export type CloneStatus = 'cloning' | 'ready' | 'failed'

export interface Project {
  id: string
  provider: ProjectProvider
  owner: string
  repoSlug: string
  defaultBranch: string
  cloneStatus: CloneStatus
  cloneError: string | null
  connectedAt: string
  autoOpenPr: boolean
}

export interface VcsOrg {
  slug: string
  name: string
  isPersonal: boolean
}

export interface VcsRepo {
  owner: string
  slug: string
  defaultBranch: string
}

export interface VcsRepoPage {
  repos: VcsRepo[]
  nextPage: number | null
}

async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `HTTP ${res.status}`
}

export async function fetchCurrentProject(): Promise<Project | null> {
  const res = await fetch('/api/projects/current')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<Project | null>
}

export async function fetchOrgs(provider: ProjectProvider): Promise<VcsOrg[]> {
  const res = await fetch(`/api/projects/orgs?provider=${encodeURIComponent(provider)}`)
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<VcsOrg[]>
}

export async function fetchRepos(
  provider: ProjectProvider,
  org: string,
  page: number,
  q?: string,
): Promise<VcsRepoPage> {
  const params = new URLSearchParams({ provider, org, page: String(page) })
  if (q) params.set('q', q)
  const res = await fetch(`/api/projects/repos?${params.toString()}`)
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<VcsRepoPage>
}

export interface ConnectProjectResult {
  ok: boolean
  project?: Project
  error?: string
}

export async function connectProject(
  provider: ProjectProvider,
  owner: string,
  repoSlug: string,
  defaultBranch: string,
): Promise<ConnectProjectResult> {
  const res = await fetch('/api/projects/connect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, owner, repoSlug, defaultBranch }),
  })
  if (!res.ok) return { ok: false, error: await errorMessage(res) }
  const project = (await res.json()) as Project
  return { ok: true, project }
}

export interface ClearProjectResult {
  ok: boolean
  error?: string
}

export async function clearProject(): Promise<ClearProjectResult> {
  const res = await fetch('/api/projects/clear', { method: 'POST' })
  if (!res.ok) return { ok: false, error: await errorMessage(res) }
  return { ok: true }
}

export interface SyncProjectResult {
  ok: boolean
  output?: string
  error?: string
}

export async function syncProject(): Promise<SyncProjectResult> {
  const res = await fetch('/api/projects/sync', { method: 'POST' })
  const body = (await res.json().catch(() => null)) as { ok?: boolean; output?: string; error?: string } | null
  if (!res.ok) return { ok: false, error: body?.error ?? `HTTP ${res.status}` }
  return { ok: true, output: body?.output }
}

export interface SettingsResponse {
  autoOpenPr: boolean
}

export async function fetchSettings(): Promise<SettingsResponse> {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<SettingsResponse>
}

export async function updateAutoOpenPr(enabled: boolean): Promise<SettingsResponse> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ autoOpenPr: enabled }),
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<SettingsResponse>
}
