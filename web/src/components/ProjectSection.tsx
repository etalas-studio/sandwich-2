import { useEffect, useState } from 'react'
import { fetchProjectSettings, saveProjectSettings } from '../types'

export default function ProjectSection() {
  const [repoPath, setRepoPath] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjectSettings()
      .then((settings) => {
        setRepoPath(settings.repoPath)
        setInput(settings.repoPath ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const handleSave = () => {
    setSaving(true)
    setError(null)
    saveProjectSettings(input)
      .then((result) => {
        if (result.ok) {
          setRepoPath(result.settings?.repoPath ?? input)
        } else {
          setError(result.message)
        }
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="ds-card-outer ds-shadow-elevated">
      <div className="ds-card-inner p-6">
        <div className="absolute inset-0 ds-noise pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-normal tracking-tight text-white ds-text-shadow">
              Project
            </h3>
          </div>

          <p className="text-xs text-white/50 font-light mb-4">
            The local folder this instance runs the agent against. Must be an existing git repository.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
              <span className="text-sm text-white/50 font-light">Current</span>
              <span className="text-sm text-white/80 font-light font-mono">
                {repoPath ?? 'Not configured yet'}
              </span>
            </div>

            <div>
              <label className="text-xs text-white/50 font-light block mb-1.5">
                Repository path
              </label>
              <input
                type="text"
                placeholder="/absolute/path/to/your/project"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/10 transition-colors font-light font-mono"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#3a1d1d] border border-[#522525]">
                <span className="text-xs text-[#ff8a8a] font-light">{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                className="relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={saving || input.trim().length === 0}
                onClick={handleSave}
              >
                <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                <span
                  className="relative px-5 py-2 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
                  style={{
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
