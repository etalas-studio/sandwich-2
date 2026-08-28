import { useEffect, useState, useCallback } from 'react'
import { apiUrl } from '../api/base'
import { listDocuments, type DocumentListItem } from '../api/documents'
import { listProjects, type Project } from '../api/projects'
import { useLanguage } from '../lib/i18n'

const bowlby = "'Bowlby One', system-ui"

const TYPE_LABEL: Record<string, string> = {
  prd: 'PRD',
  quotation: 'Quotation',
  prototype: 'Prototype',
  specs: 'Specs',
  mom: 'MOM',
}

function truncateWords(text: string, n: number) {
  const words = text.split(/\s+/)
  return words.length <= n ? text : words.slice(0, n).join(' ') + '…'
}

function PrototypeCard({ doc, onOpenConversation }: { doc: DocumentListItem; onOpenConversation: (conversationId: string | null, docTitle: string) => void }) {
  const previewUrl = doc.previewUrl?.replace(/\/$/, '') || null
  const dateStr = new Date(doc.createdAt ?? doc.updatedAt).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div
      className="rounded-2xl border overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
      style={{ backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}
      onClick={() => onOpenConversation(doc.conversationId, doc.title)}
    >
      <div style={{ height: 180, overflow: 'hidden', position: 'relative', backgroundColor: '#f3f4f6', flexShrink: 0 }}>
        {previewUrl ? (
          <iframe
            src={previewUrl}
            title="preview"
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '400%', height: '720px',
              transform: 'scale(0.25)', transformOrigin: 'top left',
              border: 'none', pointerEvents: 'none',
            }}
            tabIndex={-1}
            aria-hidden="true"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <iconify-icon icon="solar:widget-linear" width="36" style={{ color: 'rgba(0,0,0,0.15)' }} />
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold leading-snug" style={{ color: '#111827' }}>
            {truncateWords(doc.title, 4)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{dateStr}</p>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 24,
                backgroundColor: '#111827', color: '#ffffff',
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <iconify-icon icon="solar:eye-bold" width="14" />
              Preview
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function DocGrid({
  docs,
  onOpenDocument,
  onOpenConversation,
}: {
  docs: DocumentListItem[]
  onOpenDocument: (id: string) => void
  onOpenConversation: (conversationId: string | null, docTitle: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {docs.map((d) =>
        d.type === 'prototype' ? (
          <PrototypeCard key={d.id} doc={d} onOpenConversation={onOpenConversation} />
        ) : (
          <button
            key={d.id}
            onClick={() => onOpenDocument(d.id)}
            className="flex flex-col gap-2 p-5 rounded-2xl border text-left group"
            style={{ backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <span className="text-xs font-semibold uppercase" style={{ color: '#f91814' }}>
              {TYPE_LABEL[d.type] ?? d.type}
            </span>
            <span className="font-semibold truncate" style={{ color: '#111827' }}>{d.title}</span>
            {d.lastCommitSha && (
              <span className="text-xs font-mono" style={{ color: '#9ca3af' }}>{d.lastCommitSha.slice(0, 7)}</span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
              <iconify-icon icon="solar:eye-linear" width="12" />
              Preview &amp; Download
            </span>
            <a
              href={apiUrl(`/api/documents/${d.id}/export?format=md`)}
              onClick={(e) => e.stopPropagation()}
              className="text-xs underline"
              style={{ color: '#2563eb' }}
            >
              Download MD
            </a>
          </button>
        ),
      )}
    </div>
  )
}

export default function DocumentsPanel({
  onOpenDocument,
  onOpenConversation,
  initialProjectId,
}: {
  onOpenDocument: (id: string) => void
  onOpenConversation?: (conversationId: string | null, docTitle: string) => void
  initialProjectId?: string | null
}) {
  const { t: tr } = useLanguage()
  const [items, setItems] = useState<DocumentListItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(initialProjectId ?? null)

  const load = useCallback(() => {
    Promise.all([listDocuments(), listProjects().catch(() => [] as Project[])])
      .then(([docs, projs]) => {
        setItems(docs)
        setProjects(projs)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openConv = onOpenConversation ?? ((_c, _t) => { /* no-op */ })
  const projectById = new Map(projects.map((p) => [p.id, p]))
  // Only show project chips that actually have documents.
  const projectIdsWithDocs = new Set(items.map((d) => d.projectId))
  const chipProjects = projects.filter((p) => projectIdsWithDocs.has(p.id))
  const visible = filter ? items.filter((d) => d.projectId === filter) : items

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl tracking-tighter mb-4" style={{ color: '#111827', fontFamily: bowlby }}>
          DOCUMENTS
        </h1>

        {chipProjects.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setFilter(null)}
              className="text-xs px-3 py-1.5 rounded-full font-medium border"
              style={filter === null
                ? { backgroundColor: '#111827', color: '#fff', borderColor: '#111827' }
                : { backgroundColor: '#fff', color: '#374151', borderColor: 'rgba(0,0,0,0.15)' }}
            >
              {tr('docs_all_projects')}
            </button>
            {chipProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => setFilter(p.id)}
                className="text-xs px-3 py-1.5 rounded-full font-medium border truncate max-w-[200px]"
                style={filter === p.id
                  ? { backgroundColor: '#111827', color: '#fff', borderColor: '#111827' }
                  : { backgroundColor: '#fff', color: '#374151', borderColor: 'rgba(0,0,0,0.15)' }}
                title={p.title}
              >
                {p.title}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: '#9ca3af' }}>Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm" style={{ color: '#9ca3af' }}>
            No documents yet. Start a chat and ask SANDWICH to generate one.
          </p>
        ) : filter ? (
          <DocGrid docs={visible} onOpenDocument={onOpenDocument} onOpenConversation={openConv} />
        ) : (
          <div className="flex flex-col gap-8">
            {[...chipProjects, { id: '__other__', title: 'Other' } as Project].map((p) => {
              const docs = items.filter((d) =>
                p.id === '__other__' ? !projectById.has(d.projectId) : d.projectId === p.id,
              )
              if (docs.length === 0) return null
              return (
                <div key={p.id}>
                  {chipProjects.length > 0 && (
                    <h2 className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>{p.title}</h2>
                  )}
                  <DocGrid docs={docs} onOpenDocument={onOpenDocument} onOpenConversation={openConv} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
