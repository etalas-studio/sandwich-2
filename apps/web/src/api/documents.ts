import { apiUrl } from './base'

export type DocumentType = 'prd' | 'quotation' | 'prototype' | 'specs'

export interface DocumentListItem {
  id: string
  userId: string
  type: string
  title: string
  currentVersionId: string | null
  latestVersionNo: number | null
  currentVersionNo: number | null
  previewUrl: string | null
  conversationId: string | null
  createdAt?: string
  updatedAt: string
}

export interface DocumentVersion {
  id: string
  documentId: string
  versionNo: number
  content: string
  promptUsed: string | null
  createdAt: string
}

export interface DocumentDetail {
  id: string
  userId: string
  type: string
  title: string
  currentVersionId: string | null
  previewUrl: string | null
  createdAt: string
  updatedAt: string
  latestVersion: DocumentVersion | null
  versions: DocumentVersion[]
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
