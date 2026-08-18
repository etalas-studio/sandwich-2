import { useEffect, useState } from 'react'
import { getDocument, type DocumentDetail } from '../api/documents'

export interface DocumentRefMeta {
  id: string
  type: string
  title: string
  versionNo: number
}

const TYPE_META: Record<string, { label: string; color: string; ic: string; icon: string }> = {
  prd: { label: 'PRD', color: '#fef3c7', ic: '#f97316', icon: 'solar:document-add-linear' },
  quotation: { label: 'Quotation', color: '#dcfce7', ic: '#16a34a', icon: 'solar:dollar-minimalistic-linear' },
  specs: { label: 'Specs', color: '#fce7f3', ic: '#db2777', icon: 'solar:checklist-linear' },
  prototype: { label: 'Prototype', color: '#ede9fe', ic: '#7c3aed', icon: 'solar:widget-linear' },
}

export default function DocumentCard({
  documentId,
  initial,
  onClick,
}: {
  documentId: string
  initial?: Partial<DocumentRefMeta>
  onClick: () => void
}) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getDocument(documentId)
      .then((d) => { if (!cancelled) setDoc(d) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [documentId])

  if (error) {
    return (
      <div className="text-sm" style={{ color: 'rgba(0,0,0,0.45)' }}>
        Document unavailable
      </div>
    )
  }

  const meta = TYPE_META[doc?.type ?? initial?.type ?? ''] ?? {
    label: (doc?.type ?? initial?.type ?? 'Document').toUpperCase(),
    color: 'rgba(0,0,0,0.06)',
    ic: 'rgba(0,0,0,0.4)',
    icon: 'solar:notes-linear',
  }
  const title = doc?.title ?? initial?.title ?? 'Document'
  const versionNo = doc?.latestVersion?.versionNo ?? initial?.versionNo ?? null

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full max-w-md text-left rounded-2xl border p-4 transition-transform active:scale-[0.99] group"
      style={{ backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.1)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color }}>
          <iconify-icon icon={meta.icon} width="17" style={{ color: meta.ic }} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#f91814' }}>
            {meta.label}
          </span>
          <p className="text-sm font-semibold truncate mt-0.5" style={{ color: '#111827' }}>{title}</p>
        </div>
        {versionNo != null && (
          <span className="text-xs shrink-0 px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: '#6b7280' }}>
            v{versionNo}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <iconify-icon icon="solar:eye-linear" width="14" style={{ color: 'rgba(0,0,0,0.4)' }} />
        <span className="text-xs font-medium" style={{ color: 'rgba(0,0,0,0.55)' }}>Preview &amp; Download</span>
        <iconify-icon icon="solar:arrow-right-linear" width="14" className="ml-auto transition-transform group-hover:translate-x-0.5" style={{ color: 'rgba(0,0,0,0.4)' }} />
      </div>
    </button>
  )
}
