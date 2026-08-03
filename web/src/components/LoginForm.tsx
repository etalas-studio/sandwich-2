import { useState } from 'react'
import type { FormEvent } from 'react'

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<void>
}

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    if (submitting) return
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="ds-bg min-h-screen flex items-center justify-center text-white antialiased">
      <div className="ds-card-outer w-full max-w-sm mx-4">
        <div className="ds-card-inner p-8">
          <h1 className="text-xl font-normal tracking-tight ds-text-shadow mb-6">Log in</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm text-white/70">
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/70">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
              />
            </label>

            {error && <p className="text-sm text-[#ff8a8a]">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 px-4 py-2 rounded-lg bg-gradient-to-b from-[#333] to-[#111] border border-white/10 text-white text-sm disabled:opacity-50"
            >
              {submitting ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
