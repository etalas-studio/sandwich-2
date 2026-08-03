import { useState, useEffect, useRef } from 'react'
import { useProjectSettings } from '../hooks/useProjectSettings'

const DEMO_PATH = '/Users/riaenriala/Documents/etalas/runchise-agent-pipeline'

export default function ProjectSection() {
  const { repoPath, isSaving, isSyncing, save, sync } = useProjectSettings()
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const seeded = useRef(false)

  useEffect(() => {
    if (repoPath && !seeded.current) {
      setInput(repoPath)
      seeded.current = true
    }
  }, [repoPath])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(DEMO_PATH)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleCopy}
                className="text-xs text-white/20 font-mono font-light hover:text-white/40 transition-colors cursor-pointer"
              >
                {copied ? 'Copied!' : 'copy me'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  className="relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isSyncing || !repoPath}
                  onClick={sync}
                >
                  <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                  <span
                    className="relative px-4 py-2 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
                    style={{
                      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                    }}
                  >
                    {isSyncing ? 'Pulling…' : 'Sync'}
                  </span>
                </button>
                <button
                  className="relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isSaving || input.trim().length === 0}
                  onClick={() => save(input.trim())}
                >
                  <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
                  <span
                    className="relative px-5 py-2 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
                    style={{
                      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                    }}
                  >
                    {isSaving ? 'Saving…' : 'Save'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
