import { useState } from 'react'
import type { FormEvent } from 'react'

interface SetupFormProps {
  onSubmit: (username: string, email: string, password: string) => Promise<void>
  error: string | null
  isPending: boolean
}

export default function SetupForm({ onSubmit, error, isPending }: SetupFormProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isPending) return
    void onSubmit(username, email, password)
  }

  return (
    <div
      className="ds-bg min-h-screen flex items-center justify-center text-white antialiased relative"
      style={{
        backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)',
        backgroundSize: '4px 4px',
      }}
    >
      <div className="w-full max-w-sm mx-4 relative z-10">
        <h1 className="text-xl font-normal tracking-tight ds-text-shadow mb-1">Create your account</h1>
        <p className="text-sm text-white/50 font-light mb-6">This is the one account for this instance.</p>

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
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
              minLength={8}
              className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
          </label>

          {error && <p className="text-sm text-[#ff8a8a]">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 px-4 py-2 rounded-lg bg-gradient-to-b from-[#333] to-[#111] border border-white/10 text-white text-sm disabled:opacity-50"
          >
            {isPending ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
