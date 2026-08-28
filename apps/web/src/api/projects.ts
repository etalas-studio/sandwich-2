import { apiUrl } from './base'
import type { Conversation } from './conversations'

export interface Project {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

/**
 * The grouped conversation listing. NOTE: `GET /api/conversations?groupBy=project`
 * returns *raw* drizzle rows (a superset of the flat endpoint's shape), and the
 * inner join means projects with zero conversations are absent and conversations
 * with a null project_id are invisible. Only id/title/prompt/createdAt/pinned/
 * unread/projectId are relied on downstream.
 */
export interface ProjectConversationGroup {
  project: Project
  conversations: Conversation[]
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(apiUrl('/api/projects'), { credentials: 'include' })
  return json<Project[]>(res)
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(id)}`), {
    credentials: 'include',
  })
  return json<Project>(res)
}

export async function renameProject(id: string, title: string): Promise<Project> {
  const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return json<Project>(res)
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'include',
  })
  if (res.status === 204) return
  if (res.status === 409) throw new Error('project still has conversations')
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
}

export async function listConversationsGrouped(): Promise<ProjectConversationGroup[]> {
  const res = await fetch(apiUrl('/api/conversations?groupBy=project'), {
    credentials: 'include',
  })
  return json<ProjectConversationGroup[]>(res)
}
