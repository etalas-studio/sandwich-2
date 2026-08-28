import {
  listConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  type Conversation as ServerConversation,
  type ConversationType,
} from '../api/conversations'
import {
  listConversationsGrouped,
  renameProject,
  type ProjectConversationGroup,
} from '../api/projects'

export type { ConversationType }

export interface LocalConversation {
  id: string
  summary: string
  description: string
  createdAt: string
  projectId: string | null
  type: ConversationType
  content?: string // AI-generated output (server: conversation.output)
  status: 'draft' | 'processing' | 'done'
  pinned?: boolean
  unread?: boolean
}

export interface ProjectSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

/**
 * A project group holds project metadata + conversation **ids only**. The
 * conversation objects stay in the single `cache` below, so every existing
 * mechanism (refresh, optimistic pin/unread/rename, delete, popstate lookup)
 * keeps working untouched. Do NOT store conversation objects here.
 */
export interface ConversationGroup {
  project: ProjectSummary
  conversationIds: string[]
}

// In-memory mirror of the server conversation list. The server is the
// source of truth — this cache only exists so the UI can read synchronously.
let cache: LocalConversation[] = []
let groupsCache: ConversationGroup[] = []

export function clearConversationsCache(): void {
  cache = []
  groupsCache = []
}

function toLocal(c: ServerConversation): LocalConversation {
  return {
    id: c.id,
    summary: c.title,
    description: c.prompt,
    createdAt: c.createdAt,
    projectId: c.projectId ?? null,
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

/**
 * Pure: fold the grouped-endpoint response into a flat conversation list
 * (newest first, matching the flat endpoint) + id-only groups (server order).
 */
export function toGroups(raw: ProjectConversationGroup[]): {
  groups: ConversationGroup[]
  conversations: LocalConversation[]
} {
  const conversations = raw
    .flatMap((g) => g.conversations)
    .map(toLocal)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const groups = raw.map((g) => ({
    project: {
      id: g.project.id,
      title: g.project.title,
      createdAt: g.project.createdAt,
      updatedAt: g.project.updatedAt,
    },
    conversationIds: g.conversations
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => c.id),
  }))
  return { groups, conversations }
}

/** Pure: order a group's conversations — pinned first, otherwise the given order. */
export function sortGroupConversations(
  ids: string[],
  byId: Map<string, LocalConversation>,
): LocalConversation[] {
  return ids
    .map((id) => byId.get(id))
    .filter((c): c is LocalConversation => !!c)
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned))
}

export function getConversations(): LocalConversation[] {
  return cache
}

export function getConversationGroups(): ConversationGroup[] {
  return groupsCache
}

export async function loadConversations(): Promise<LocalConversation[]> {
  const list = await listConversations()
  cache = list.map(toLocal)
  return cache
}

export async function loadConversationGroups(): Promise<ConversationGroup[]> {
  const raw = await listConversationsGrouped()
  const { groups, conversations } = toGroups(raw)
  cache = conversations
  groupsCache = groups
  return groupsCache
}

/**
 * Creates a conversation on the server and prepends it to the cache. When
 * `projectId` is given the new id is also threaded into that group; when absent
 * the server minted a fresh project, so the caller should reload groups.
 */
export async function createConversationLocal(input: {
  type: ConversationType
  summary: string
  description: string
  pendingType?: string
  projectId?: string
}): Promise<LocalConversation> {
  const conversation = await createConversation({
    type: input.type,
    title: input.summary,
    prompt: input.description,
    pendingType: input.pendingType,
    projectId: input.projectId,
  })
  const local = toLocal(conversation)
  cache = [local, ...cache.filter((t) => t.id !== local.id)]
  if (input.projectId) {
    groupsCache = groupsCache.map((g) =>
      g.project.id === input.projectId
        ? { ...g, conversationIds: [local.id, ...g.conversationIds.filter((id) => id !== local.id)] }
        : g,
    )
  }
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
  groupsCache = groupsCache.map((g) => ({
    ...g,
    conversationIds: g.conversationIds.filter((cid) => cid !== id),
  }))
  void deleteConversation(id).catch(() => {
    void loadConversations()
  })
}

/**
 * Optimistic project rename, reconciled against the server (which trims to 80
 * chars and strips markdown).
 */
export function renameLocalProject(id: string, title: string): void {
  groupsCache = groupsCache.map((g) =>
    g.project.id === id ? { ...g, project: { ...g.project, title } } : g,
  )
  void renameProject(id, title)
    .then((p) => {
      groupsCache = groupsCache.map((g) =>
        g.project.id === id ? { ...g, project: { ...g.project, title: p.title } } : g,
      )
    })
    .catch(() => {
      void loadConversationGroups()
    })
}
