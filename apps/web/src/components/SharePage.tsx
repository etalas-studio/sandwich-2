import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiUrl } from '../api/base'

interface SharedConversation {
  id: string
  title: string
  prompt: string
  createdAt: string
}

interface SharedData {
  conversation: SharedConversation
  messages: Array<{ role: string; content: string; createdAt: string }>
  attachments: Array<{ id: string; filename: string; url: string; mimeType: string }>
}

const inter = "'Inter', sans-serif"

export default function SharePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<SharedData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(apiUrl(`/api/share/${encodeURIComponent(token)}`))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<SharedData>
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'failed to load'))
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F4EBE1', fontFamily: inter }}>
        <p className="text-sm" style={{ color: '#6b7280' }}>This share link is no longer available.</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F4EBE1', fontFamily: inter }}>
        <p className="text-sm" style={{ color: '#9ca3af' }}>Loading…</p>
      </div>
    )
  }

  const { conversation, messages, attachments } = data

  return (
    <div className="min-h-screen px-6 py-12" style={{ backgroundColor: '#F4EBE1', fontFamily: inter }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#f91814' }}>
              SANDWICH · shared brief
            </p>
            <h1 className="text-2xl font-semibold" style={{ color: '#111827' }}>{conversation.title}</h1>
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#9ca3af' }}>Attachments</p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-3 py-1.5 rounded-full border"
                  style={{ borderColor: 'rgba(0,0,0,0.1)', color: '#111827', backgroundColor: '#ffffff' }}
                >
                  {a.filename}
                </a>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="mt-10 border-t pt-6" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#9ca3af' }}>Transcript</p>
            <div className="flex flex-col gap-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                  <div
                    className="max-w-[85%] px-4 py-2 rounded-2xl text-sm"
                    style={
                      m.role === 'user'
                        ? { backgroundColor: '#1a1a1a', color: '#ffffff' }
                        : { backgroundColor: '#ffffff', color: '#374151', border: '1px solid rgba(0,0,0,0.08)' }
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
