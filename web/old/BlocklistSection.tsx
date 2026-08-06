import { useState } from 'react'
import Modal from './Modal'

export interface BlocklistEntry {
  id: string
  pattern: string
  reason: string
  source: 'agent' | 'human'
}

interface BlocklistSectionProps {
  entries: BlocklistEntry[]
  onAdd: (pattern: string, reason: string) => void
  onDelete: (id: string) => void
}

// Mock data for UI development
export const mockBlocklist: BlocklistEntry[] = [
  { id: '1', pattern: 'db/migrate/*', reason: 'Never run migrations autonomously', source: 'agent' },
  { id: '2', pattern: 'auth/**', reason: 'Authentication logic is security-critical', source: 'human' },
  { id: '3', pattern: '.env', reason: 'Environment files may contain secrets', source: 'agent' },
  { id: '4', pattern: 'config/credentials/**', reason: 'Credential files are sensitive', source: 'human' },
]

export default function BlocklistSection({ entries, onAdd, onDelete }: BlocklistSectionProps) {
  const [showModal, setShowModal] = useState(false)
  const [pattern, setPattern] = useState('')
  const [reason, setReason] = useState('')

  const handleSave = () => {
    if (pattern.trim() && reason.trim()) {
      onAdd(pattern.trim(), reason.trim())
      setPattern('')
      setReason('')
      setShowModal(false)
    }
  }

  return (
    <div className="ds-card-outer ds-shadow-elevated">
      <div className="ds-card-inner p-6">
        <div className="absolute inset-0 ds-noise pointer-events-none" />
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-normal tracking-tight text-white ds-text-shadow">
                Blocklist
              </h3>
              <span className="text-xs text-white/40 font-light">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <button
              className="relative inline-flex group"
              onClick={() => setShowModal(true)}
            >
              <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
              <span className="relative px-4 py-1.5 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]" style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                Add entry
              </span>
            </button>
          </div>

          {/* List */}
          <div className="flex flex-col gap-2">
            {entries.length === 0 ? (
              <p className="text-sm text-white/40 font-light py-4 text-center">
                No blocklist entries yet. Add paths or patterns the agent should avoid.
              </p>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <code className="text-sm text-white/80 font-mono truncate">
                      {entry.pattern}
                    </code>
                    <span className="text-xs text-white/40 font-light truncate">
                      {entry.reason}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-normal tracking-wide border ${
                      entry.source === 'agent'
                        ? 'bg-gradient-to-b from-[#3a2e1d] to-[#241a10] text-[#f59e0b] border-[#5a4525]'
                        : 'bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] text-white/70 border-white/[0.05]'
                    }`}>
                      {entry.source === 'agent' ? 'Agent' : 'Human'}
                    </span>
                    <button
                      className="text-white/30 hover:text-[#ff8a8a] transition-colors opacity-0 group-hover:opacity-100"
                      onClick={() => onDelete(entry.id)}
                    >
                      <iconify-icon icon="solar:trash-bin-trash-linear" width="14" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Add Blocklist Entry"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 font-light block mb-1.5">
              Pattern
            </label>
            <input
              type="text"
              placeholder="e.g. db/migrate/*"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/10 transition-colors font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 font-light block mb-1.5">
              Reason
            </label>
            <input
              type="text"
              placeholder="Why should this be blocked?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/10 transition-colors font-light"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.04]">
            <button
              className="px-4 py-2 text-xs text-white/70 bg-white/[0.03] rounded-lg border border-white/[0.05] transition-colors font-light hover:bg-white/[0.06]"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
            <button
              className="relative inline-flex group"
              onClick={handleSave}
              disabled={!pattern.trim() || !reason.trim()}
            >
              <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
              <span className={`relative px-5 py-2 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] ${!pattern.trim() || !reason.trim() ? 'opacity-50' : ''}`} style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                Add entry
              </span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
