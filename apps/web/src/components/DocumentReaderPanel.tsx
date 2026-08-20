import { useEffect, useState } from 'react'
import { marked } from 'marked'
import { getDocument, documentExportUrl, type DocumentDetail } from '../api/documents'

const TYPE_LABEL: Record<string, string> = {
  prd: 'PRD',
  quotation: 'Quotation',
  prototype: 'Prototype',
  specs: 'Specs',
}

export default function DocumentReaderPanel({
  documentId,
  onClose,
}: {
  documentId: string | null
  onClose: () => void
}) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [versionNo, setVersionNo] = useState<number | null>(null)

  useEffect(() => {
    if (!documentId) return
    let cancelled = false
    setLoading(true)
    setError(false)
    getDocument(documentId)
      .then((d) => {
        if (cancelled) return
        setDoc(d)
        const current = d.versions.find((v) => v.id === d.currentVersionId)
        setVersionNo(
          current?.versionNo ??
            d.latestVersion?.versionNo ??
            d.versions[0]?.versionNo ??
            null,
        )
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [documentId])

  if (!documentId) return null

  const isPrototype = doc?.type === 'prototype'
  const label = TYPE_LABEL[doc?.type ?? ''] ?? (doc?.type ?? 'Document')
  const selectedVersion =
    doc?.versions.find((v) => v.versionNo === versionNo) ?? null
  const content = selectedVersion?.content ?? doc?.latestVersion?.content ?? ''
  const base = (doc?.previewUrl ?? '').replace(/\/$/, '')
  const previewSrc = versionNo ? `${base}/v/${versionNo}/` : base

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <aside
        className="absolute inset-y-0 right-0 w-full max-w-2xl flex flex-col shadow-2xl"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#f91814' }}>
              {label}
            </span>
            <h2 className="text-base font-semibold truncate" style={{ color: '#111827' }}>{doc?.title ?? 'Document'}</h2>
          </div>

          {doc && (
            <div className="flex items-center gap-1.5">
              <a
                href={documentExportUrl(doc.id, 'md')}
                className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ backgroundColor: '#f91814', color: '#ffffff' }}
              >
                Download MD
              </a>
              <a
                href={documentExportUrl(doc.id, 'pdf')}
                className="text-xs px-3 py-1.5 rounded-full font-medium border"
                style={{ borderColor: 'rgba(0,0,0,0.15)', color: '#111827' }}
              >
                PDF
              </a>
              <a
                href={documentExportUrl(doc.id, 'doc')}
                className="text-xs px-3 py-1.5 rounded-full font-medium border"
                style={{ borderColor: 'rgba(0,0,0,0.15)', color: '#111827' }}
              >
                DOCX
              </a>
            </div>
          )}

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'rgba(0,0,0,0.45)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
          >
            <iconify-icon icon="solar:close-circle-bold" width="20" />
          </button>
        </div>

        {/* Version selector */}
        {doc && doc.versions.length > 1 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b shrink-0" style={{ borderColor: 'rgba(0,0,0,0.06)', backgroundColor: '#fafafa' }}>
            <span className="text-xs" style={{ color: '#6b7280' }}>Version</span>
            <select
              value={versionNo ?? undefined}
              onChange={(e) => setVersionNo(Number(e.target.value))}
              className="text-xs px-2 py-1 rounded border bg-white"
              style={{ borderColor: 'rgba(0,0,0,0.15)', color: '#111827' }}
            >
              {doc.versions.map((v) => (
                <option key={v.id} value={v.versionNo}>v{v.versionNo}</option>
              ))}
            </select>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-6 text-sm" style={{ color: '#9ca3af' }}>Loading…</p>
          ) : error ? (
            <p className="p-6 text-sm" style={{ color: '#f87171' }}>Failed to load document.</p>
          ) : isPrototype ? (
            <iframe
              src={previewSrc}
              title={doc?.title ?? 'Prototype preview'}
              className="w-full h-full border-0"
            />
          ) : (
            <div
              className="text-sm px-6 py-6 sandwich-output"
              style={{ color: 'rgba(0,0,0,0.8)', lineHeight: '1.85' }}
              dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }}
            />
          )}
        </div>
      </aside>
    </div>
  )
}
