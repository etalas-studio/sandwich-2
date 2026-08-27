import { apiUrl } from './base'

export type ConversationType =
  | 'prd'
  | 'mom'
  | 'quotation'
  | 'specs'
  | 'prototype'
  | 'workflow'
  | 'general'

export type ConversationStatus = 'backlog' | 'in_progress' | 'done'

export interface Conversation {
  id: string
  userId: string
  projectId: string | null
  type: string
  title: string
  prompt: string
  status: ConversationStatus
  stage: string | null
  output: string | null
  feedback: string | null
  pinned: boolean
  unread: boolean
  shareToken: string | null
  sharedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: number
  conversationId: string
  role: string
  content: string
  documentId: string | null
  document?: {
    id: string
    type: string
    title: string
    versionNo: number | null
  } | null
  createdAt: string
  attachments: Attachment[]
}

export interface Attachment {
  id: string
  userId: string
  conversationId: string | null
  messageId: number | null
  storageKey: string
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: string
  url: string
}

export interface Usage {
  used: number
  prototypeUsed: number
  chatUsed: number
  yearMonth: string
  planSlug: string | null
  isPro: boolean
  limit: number | null
  prototypeLimit: number | null
  chatLimit: number | null
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(apiUrl('/api/conversations'), { credentials: 'include' })
  return json<Conversation[]>(res)
}

export async function createConversation(input: {
  id?: string
  type?: ConversationType
  title: string
  prompt: string
  pendingType?: string
  projectId?: string
}): Promise<Conversation> {
  const res = await fetch(apiUrl('/api/conversations'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return json<Conversation>(res)
}

export async function updateConversation(
  id: string,
  data: Partial<{
    type: string | null
    title: string
    prompt: string
    status: string
    stage: string | null
    output: string | null
    feedback: string | null
    pinned: boolean
    unread: boolean
  }>,
): Promise<Conversation> {
  const res = await fetch(apiUrl(`/api/conversations/${encodeURIComponent(id)}`), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
  return json<Conversation>(res)
}

export async function patchConversation(
  id: string,
  data: Partial<{ feedback: string | null; pinned: boolean; unread: boolean }>,
): Promise<Conversation> {
  const res = await fetch(apiUrl(`/api/conversations/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
  return json<Conversation>(res)
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/conversations/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'include',
  })
  await json<{ deleted: boolean }>(res)
}

export async function getMessages(id: string): Promise<ChatMessage[]> {
  const res = await fetch(
    apiUrl(`/api/conversations/${encodeURIComponent(id)}/messages`),
    { credentials: 'include' },
  )
  return json<ChatMessage[]>(res)
}

export async function createMessage(
  conversationId: string,
  data: { content: string; attachmentIds?: string[] },
): Promise<ChatMessage> {
  const res = await fetch(
    apiUrl(`/api/conversations/${encodeURIComponent(conversationId)}/messages`),
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    },
  )
  return json<ChatMessage>(res)
}

export async function updateMessage(
  conversationId: string,
  messageId: number,
  content: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/conversations/${encodeURIComponent(conversationId)}/messages/${messageId}`),
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

export async function generateConversation(
  conversationId: string,
  data: { regenerate?: boolean } = {},
): Promise<{ conversationId: string; started: boolean }> {
  const res = await fetch(
    apiUrl(`/api/conversations/${encodeURIComponent(conversationId)}/generate`),
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    },
  )
  return json<{ conversationId: string; started: boolean }>(res)
}

export async function shareConversation(
  id: string,
): Promise<{ shareToken: string; url: string }> {
  const res = await fetch(
    apiUrl(`/api/conversations/${encodeURIComponent(id)}/share`),
    { method: 'POST', credentials: 'include' },
  )
  return json<{ shareToken: string; url: string }>(res)
}

export async function unshareConversation(id: string): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/conversations/${encodeURIComponent(id)}/unshare`),
    { method: 'POST', credentials: 'include' },
  )
  await json<{ unshared: boolean }>(res)
}

export async function uploadAttachment(
  file: Blob,
  filename: string,
  conversationId?: string,
): Promise<Attachment> {
  const fd = new FormData()
  fd.append('file', file, filename)
  if (conversationId) fd.append('conversationId', conversationId)
  const res = await fetch(apiUrl('/api/attachments'), {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  return json<Attachment>(res)
}

export async function getUsage(): Promise<Usage> {
  const res = await fetch(apiUrl('/api/usage'), { credentials: 'include' })
  return json<Usage>(res)
}

