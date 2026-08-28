import { describe, it, expect } from 'vitest'
import { toGroups, sortGroupConversations, type LocalConversation } from './conversations'
import type { ProjectConversationGroup } from '../api/projects'

function conv(id: string, createdAt: string, projectId: string): any {
  return {
    id, userId: 'u1', projectId, type: 'general', title: `c-${id}`, prompt: 'p',
    status: 'backlog', stage: null, output: null, feedback: null,
    pinned: false, unread: false, shareToken: null, sharedAt: null,
    createdAt, updatedAt: createdAt,
  }
}

const raw: ProjectConversationGroup[] = [
  {
    project: { id: 'p1', userId: 'u1', title: 'First', createdAt: '2026-01-02', updatedAt: '2026-01-02' },
    conversations: [conv('a', '2026-01-01T00:00:00Z', 'p1'), conv('b', '2026-01-03T00:00:00Z', 'p1')],
  },
  {
    project: { id: 'p2', userId: 'u1', title: 'Second', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    conversations: [conv('c', '2026-01-02T00:00:00Z', 'p2')],
  },
]

describe('toGroups', () => {
  it('preserves server group order and numbers conversations newest-first per group', () => {
    const { groups } = toGroups(raw)
    expect(groups.map((g) => g.project.id)).toEqual(['p1', 'p2'])
    expect(groups[0].conversationIds).toEqual(['b', 'a']) // b is newer
    expect(groups[1].conversationIds).toEqual(['c'])
  })

  it('flattens conversations newest-first and maps projectId', () => {
    const { conversations } = toGroups(raw)
    expect(conversations.map((c) => c.id)).toEqual(['b', 'c', 'a'])
    expect(conversations.every((c) => c.projectId != null)).toBe(true)
  })

  it('tolerates an empty group', () => {
    const { groups, conversations } = toGroups([
      { project: { id: 'p3', userId: 'u1', title: 'Empty', createdAt: '', updatedAt: '' }, conversations: [] },
    ])
    expect(groups[0].conversationIds).toEqual([])
    expect(conversations).toEqual([])
  })
})

describe('sortGroupConversations', () => {
  it('floats pinned first, otherwise keeps the given order, and skips unknown ids', () => {
    const byId = new Map<string, LocalConversation>([
      ['a', { id: 'a', summary: 'a', description: '', createdAt: '', projectId: 'p1', type: 'general', status: 'draft' }],
      ['b', { id: 'b', summary: 'b', description: '', createdAt: '', projectId: 'p1', type: 'general', status: 'draft', pinned: true }],
    ])
    const out = sortGroupConversations(['a', 'b', 'ghost'], byId)
    expect(out.map((c) => c.id)).toEqual(['b', 'a'])
  })
})
