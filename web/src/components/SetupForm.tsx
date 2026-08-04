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
    <div className="ds-bg min-h-screen flex items-center justify-center text-white antialiased relative">
      <div className="ds-noise" />
      <div className="w-full max-w-sm mx-4 relative z-10 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <iconify-icon icon="solar:hand-shake-linear" width="40" className="text-white/70" />
        </div>

        <h1 className="text-xl font-normal tracking-tight ds-text-shadow mb-1">Create your account</h1>
        <p className="text-sm text-white/40 font-light mb-8">This is the one account for this instance.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-xs text-white/50 font-light">
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              placeholder="Enter your username"
              className="px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-white/[0.06] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/15 transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-white/50 font-light">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              className="px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-white/[0.06] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/15 transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-white/50 font-light">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Create a password (min. 8 characters)"
              className="px-4 py-2.5 rounded-lg bg-[#0a0a0a] border border-white/[0.06] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/15 transition-colors"
            />
          </label>

          {error && (
            <p className="text-xs text-[#ff8a8a] bg-[#ff8a8a]/5 border border-[#ff8a8a]/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="relative inline-flex group disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
            <span
              className="relative flex items-center justify-center gap-2 w-full px-6 py-3 rounded-lg text-sm font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
              style={{
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6), 0 4px 8px -2px rgba(0,0,0,0.6)',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              {isPending ? 'Creating account…' : 'Create account'}
            </span>
          </button>
        </form>
      </div>
    </div>
  )
}
