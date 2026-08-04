import { useState } from 'react'
import type { FormEvent } from 'react'

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<void>
  error: string | null
  isPending: boolean
}

export default function LoginForm({ onSubmit, error, isPending }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isPending) return
    void onSubmit(username, password)
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
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div
            className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#333] to-[#111] flex items-center justify-center border border-[#333]"
            style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -2px 6px rgba(0,0,0,0.8)' }}
          >
            <iconify-icon icon="solar:cat-linear" width="20" className="text-white/90" />
          </div>
        </div>

        <h1 className="text-xl font-normal tracking-tight ds-text-shadow mb-1">Welcome back</h1>
        <p className="text-sm text-white/40 font-light mb-8">Log in to continue to Runchise</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
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
              className="relative flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
              style={{
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6), 0 4px 8px -2px rgba(0,0,0,0.6)',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              {isPending ? 'Logging in…' : 'Log in'}
            </span>
          </button>
        </form>
      </div>
    </div>
  )
}
