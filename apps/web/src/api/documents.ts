import { apiUrl } from './base'

export type DocumentType = 'prd' | 'quotation' | 'prototype' | 'specs' | 'mom'

export interface DocumentListItem {
  id: string
  projectId: string
  conversationId: string | null
  type: string
  title: string
  relativePath: string
  lastCommitSha: string | null
  previewUrl: string | null
  createdAt?: string
  updatedAt: string
}

export interface DocumentDetail extends DocumentListItem {
  /** The current file content from the project's git working tree. */
  content: string | null
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function listDocuments(): Promise<DocumentListItem[]> {
  const res = await fetch(apiUrl('/api/documents'), { credentials: 'include' })
  return json<DocumentListItem[]>(res)
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const res = await fetch(apiUrl(`/api/documents/${encodeURIComponent(id)}`), {
    credentials: 'include',
  })
  return json<DocumentDetail>(res)
}

export function documentExportUrl(id: string, format: 'md' | 'pdf' | 'doc'): string {
  return apiUrl(`/api/documents/${encodeURIComponent(id)}/export?format=${format}`)
}
