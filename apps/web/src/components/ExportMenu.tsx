import { useState } from 'react'

export type ExportFormat = 'pdf' | 'md' | 'doc'

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'md', label: 'Markdown (.md)' },
  { value: 'doc', label: 'Word (.docx)' },
]

export function ExportMenu({
  url,
  onDownloaded,
}: {
  url: (format: ExportFormat) => string
  onDownloaded?: (format: ExportFormat) => void
}) {
  const [open, setOpen] = useState(false)

  const download = (format: ExportFormat) => {
    setOpen(false)
    const a = document.createElement('a')
    a.href = url(format)
    a.rel = 'noopener'
    a.click()
    onDownloaded?.(format)
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => download('pdf')}
        className="flex items-center gap-1.5 rounded-l-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#111827' }}
        title="Download PDF"
      >
        <iconify-icon icon="solar:download-minimalistic-linear" width="13" style={{ color: '#ffffff' }} />
        Download
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-r-lg px-1.5 py-1.5 text-xs transition-colors"
        style={{ backgroundColor: '#111827', color: 'rgba(255,255,255,0.7)', borderLeft: '1px solid rgba(255,255,255,0.15)' }}
        title="Choose format"
      >
        <iconify-icon icon="solar:alt-arrow-down-linear" width="12" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl overflow-hidden"
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 12px 24px -6px rgba(0,0,0,0.5)',
            }}
          >
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => download(f.value)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
                style={{ color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
