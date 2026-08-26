'use client'

import { DeliverableTypeSelect } from '../DeliverableTypeSelect'
import { ACCENT, TEXT_PRIMARY, TEXT_MUTED } from './tokens'

export interface PromptPanelProps {
  prompt: string
  setPrompt: (v: string) => void
  pendingType: string
  setPendingType: (v: string) => void
  isSubmitting: boolean
  error: string | null
  onSubmit: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  placeholder: string
  sendLabel: string
  className?: string
}

export function PromptPanel({
  prompt,
  setPrompt,
  pendingType,
  setPendingType,
  isSubmitting,
  error,
  onSubmit,
  onKeyDown,
  placeholder,
  sendLabel,
  className = '',
}: PromptPanelProps) {
  return (
    <div className={`relative w-full max-w-md ${className}`}>
      <div
        className="relative rounded-xl overflow-hidden border border-white/10 backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(11,15,19,0.8)',
          boxShadow: '0 25.7px 20.5px rgba(0,0,0,0.12), 0 85.8px 68.5px rgba(0,0,0,0.18)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}60, transparent)` }} />
        <div className="flex items-center gap-2 px-5 pt-4">
          <img src="/sandwich.webp" alt="" className="w-6 h-6 object-contain shrink-0" />
          <span className="text-xs font-medium" style={{ color: TEXT_MUTED }}>sandwich.new</span>
        </div>
        <div className="flex items-center gap-2 px-5 pt-3 pb-2">
          <DeliverableTypeSelect value={pendingType} onChange={setPendingType} />
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={4}
          className="w-full resize-none bg-transparent text-sm outline-none px-5 pt-3 pb-2 leading-relaxed placeholder:text-white/25"
          style={{ color: TEXT_PRIMARY }}
        />

        <div className="flex items-center justify-between px-4 pb-4 pt-1">
          <div className="flex items-center gap-1">
            <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.25)' }}>⌘↵</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSubmit}
              disabled={isSubmitting || !prompt.trim()}
              aria-label={sendLabel}
              className="flex items-center justify-center w-11 h-11 rounded-full transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50 active:scale-95"
              style={{ backgroundColor: ACCENT }}
            >
              {isSubmitting
                ? <iconify-icon icon="solar:refresh-linear" width="15" style={{ color: '#ffffff' }} className="animate-spin" />
                : <iconify-icon icon="solar:arrow-up-linear" width="15" style={{ color: '#ffffff' }} />}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-center" style={{ color: '#ff6b6b' }}>{error}</p>}
    </div>
  )
}
