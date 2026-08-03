import { useEffect, useRef } from 'react'
import type { RunArtifact, RunArtifactKind } from '../types'

interface TranscriptViewProps {
  artifacts: RunArtifact[]
}

const KIND_LABELS: Record<RunArtifactKind, string> = {
  judge_prompt: 'Judge — prompt',
  judge_transcript: 'Judge — transcript',
  implement_transcript: 'Implement — transcript',
  diff_patch: 'Implement — diff',
  verify_output: 'Verify — output',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false })
}

function DiffLine({ line }: { line: string }) {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return <div className="text-[#8affb1]">{line}</div>
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return <div className="text-[#ff8a8a]">{line}</div>
  }
  return <div className="text-white/40">{line}</div>
}

function TranscriptWindow({ artifact }: { artifact: RunArtifact }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const isDiff = artifact.kind === 'diff_patch'
  const lines = artifact.content.split('\n')

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [artifact.content])

  return (
    <div className="ds-card-outer ds-shadow-elevated mb-3">
      <div className="ds-card-inner">
        {/* Title bar */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.04] bg-[#0a0a0a]/50">
          <div
            className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"
            style={{ boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3)' }}
          />
          <div
            className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"
            style={{ boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3)' }}
          />
          <div
            className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"
            style={{ boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3)' }}
          />
          <span className="ml-2 text-[10px] text-white/50 font-light">{KIND_LABELS[artifact.kind]}</span>
          <span className="ml-auto text-[10px] text-white/20 font-mono">{formatTime(artifact.createdAt)}</span>
        </div>
        {/* Body */}
        <div
          ref={bodyRef}
          className="p-4 font-mono text-xs leading-relaxed space-y-0.5 hide-scrollbar overflow-auto max-h-56"
        >
          {lines.map((line, i) =>
            isDiff ? (
              <DiffLine key={i} line={line} />
            ) : (
              <div key={i} className="text-white/40 whitespace-pre-wrap break-all">
                {line}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

export default function TranscriptView({ artifacts }: TranscriptViewProps) {
  if (artifacts.length === 0) {
    return <div className="text-xs text-white/40">No transcript yet.</div>
  }

  return (
    <div>
      {artifacts.map((artifact) => (
        <TranscriptWindow key={artifact.id} artifact={artifact} />
      ))}
    </div>
  )
}
