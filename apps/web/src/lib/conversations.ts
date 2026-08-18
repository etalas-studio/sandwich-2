import {
  listConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  type Conversation as ServerConversation,
  type ConversationType,
} from '../api/conversations'

export type { ConversationType }

export interface LocalConversation {
  id: string
  summary: string
  description: string
  createdAt: string
  type: ConversationType
  content?: string // AI-generated output (server: conversation.output)
  status: 'draft' | 'processing' | 'done'
  pinned?: boolean
  unread?: boolean
}

// In-memory mirror of the server conversation list. The server is the
// source of truth — this cache only exists so the UI can read synchronously.
let cache: LocalConversation[] = []

export function clearConversationsCache(): void { cache = [] }

function toLocal(c: ServerConversation): LocalConversation {
  return {
    id: c.id,
    summary: c.title,
    description: c.prompt,
    createdAt: c.createdAt,
    type: (c.type as ConversationType) ?? 'general',
    content: c.output ?? undefined,
    status:
      c.status === 'done' ? 'done' : c.status === 'in_progress' ? 'processing' : 'draft',
    pinned: c.pinned,
    unread: c.unread,
  }
}

function toServerPatch(patch: Partial<LocalConversation>): Parameters<typeof updateConversation>[1] {
  const out: Parameters<typeof updateConversation>[1] = {}
  if (patch.summary !== undefined) out.title = patch.summary
  if (patch.description !== undefined) out.prompt = patch.description
  if (patch.content !== undefined) out.output = patch.content
  if (patch.pinned !== undefined) out.pinned = patch.pinned
  if (patch.unread !== undefined) out.unread = patch.unread
  if (patch.type !== undefined) out.type = patch.type
  if (patch.status !== undefined) {
    out.status =
      patch.status === 'done' ? 'done' : patch.status === 'processing' ? 'in_progress' : 'backlog'
  }
  return out
}

export function getConversations(): LocalConversation[] {
  return cache
}

export async function loadConversations(): Promise<LocalConversation[]> {
  const list = await listConversations()
  cache = list.map(toLocal)
  return cache
}

/**
 * Creates a conversation on the server and prepends it to the cache.
 */
export async function createConversationLocal(input: {
  type: ConversationType
  summary: string
  description: string
  pendingType?: string
}): Promise<LocalConversation> {
  const conversation = await createConversation({
    type: input.type,
    title: input.summary,
    prompt: input.description,
    pendingType: input.pendingType,
  })
  const local = toLocal(conversation)
  cache = [local, ...cache.filter((t) => t.id !== local.id)]
  return local
}

/**
 * Optimistic local update, reconciled against the server in the background.
 */
export function updateLocalConversation(id: string, patch: Partial<LocalConversation>): void {
  cache = cache.map((t) => (t.id === id ? { ...t, ...patch } : t))
  void updateConversation(id, toServerPatch(patch)).catch(() => {
    void loadConversations()
  })
}

/**
 * Optimistic local delete, reconciled against the server in the background.
 */
export function deleteLocalConversation(id: string): void {
  cache = cache.filter((t) => t.id !== id)
  void deleteConversation(id).catch(() => {
    void loadConversations()
  })
}
