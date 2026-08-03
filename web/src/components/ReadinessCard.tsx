import type { ReadinessScan } from '../types'

interface ReadinessCardProps {
  scan: ReadinessScan | null
  loading: boolean
  repoConfigured: boolean
  scanning: boolean
  onScan: () => void
}

const SEVERITY_STYLES: Record<string, { icon: string; text: string; border: string }> = {
  high: { icon: 'solar:danger-triangle-bold', text: 'text-[#ff8a8a]', border: 'border-[#ff8a8a]/20' },
  medium: { icon: 'solar:danger-circle-linear', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]/20' },
  low: { icon: 'solar:info-circle-linear', text: 'text-white/60', border: 'border-white/[0.08]' },
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function ReadinessCard({ scan, loading, repoConfigured, scanning, onScan }: ReadinessCardProps) {
  const buttonLabel = scanning ? 'Scanning…' : scan ? 'Re-scan' : 'First scan'
  const buttonDisabled = scanning || !repoConfigured

  return (
    <div className="ds-card-outer ds-shadow-elevated mb-8">
      <div className="ds-card-inner p-6">
        <div className="absolute inset-0 ds-noise pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-normal tracking-tight text-white ds-text-shadow">
              Readiness
            </h3>
            <button
              type="button"
              onClick={onScan}
              disabled={buttonDisabled}
              className="relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
              <span
                className="relative px-4 py-1.5 rounded-lg text-xs font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]"
                style={{
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {buttonLabel}
              </span>
            </button>
          </div>

          {loading && (
            <p className="text-xs text-white/40 font-light">Loading…</p>
          )}

          {!loading && !repoConfigured && (
            <p className="text-xs text-white/40 font-light">
              Not configured yet — set a project folder in Settings before running a scan.
            </p>
          )}

          {!loading && repoConfigured && !scan && !scanning && (
            <p className="text-xs text-white/40 font-light">
              No scan has run yet. Run one to see how AI-ready this project is.
            </p>
          )}

          {scanning && <p className="text-xs text-white/40 font-light">Scanning the project…</p>}

          {scan && scan.status === 'failed' && !scanning && (
            <p className="text-xs text-[#ff8a8a] font-light">Last scan attempt failed — try again.</p>
          )}

          {scan && scan.status === 'completed' && !scanning && (
            <>
              {scan.codebaseSummary && (
                <div className="mb-4">
                  <p className="text-[11px] text-white/40 font-normal tracking-wide uppercase mb-1.5">
                    What this is
                  </p>
                  <p className="text-xs text-white/70 font-light leading-relaxed">{scan.codebaseSummary}</p>
                </div>
              )}

              {scan.agenticFlowSummary && (
                <div className="mb-4">
                  <p className="text-[11px] text-white/40 font-normal tracking-wide uppercase mb-1.5">
                    Existing agentic workflow
                  </p>
                  <p className="text-xs text-white/70 font-light leading-relaxed">{scan.agenticFlowSummary}</p>
                </div>
              )}

              <div className="mb-4">
                <p className="text-[11px] text-white/40 font-normal tracking-wide uppercase mb-1.5">
                  Recommendations
                </p>
                {scan.recommendations && scan.recommendations.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {scan.recommendations.map((rec) => {
                      const style = SEVERITY_STYLES[rec.severity] ?? SEVERITY_STYLES.low
                      return (
                        <div
                          key={rec.id}
                          className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${style.border} bg-white/[0.02]`}
                        >
                          <iconify-icon icon={style.icon} width="14" className={`mt-0.5 shrink-0 ${style.text}`} />
                          <p className="text-xs text-white/70 font-light leading-relaxed">{rec.message}</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-white/40 font-light">Nothing stood out as risky in this scan.</p>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-sm text-white/50 font-light">Tech stack</span>
                <span className="text-sm text-white/80 font-light">{scan.techStack ?? 'unknown'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-sm text-white/50 font-light">Test command</span>
                <span className="text-sm text-white/80 font-light font-mono">
                  {scan.testCommand ?? 'none recorded'}
                </span>
              </div>
              {scan.finishedAt && (
                <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                  <span className="text-sm text-white/50 font-light">Scanned</span>
                  <span className="text-sm text-white/80 font-light">{relativeTime(scan.finishedAt)}</span>
                </div>
              )}

              {scan.areaSignals && scan.areaSignals.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.04]">
                  <p className="text-[11px] text-white/40 font-normal tracking-wide uppercase mb-2">
                    Per-area signals
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-white/40 font-normal tracking-wide uppercase">
                        <th className="pb-2">Area</th>
                        <th className="pb-2">Test-to-code ratio</th>
                        <th className="pb-2">Churn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scan.areaSignals.map((area) => (
                        <tr key={area.pathPrefix}>
                          <td className="py-1.5 text-white/80 font-mono">{area.pathPrefix}</td>
                          <td className="py-1.5 text-white/60">{area.testToCodeRatio.toFixed(2)}</td>
                          <td className="py-1.5">
                            <div className="w-24 h-1 bg-[#0a0a0a] rounded-full overflow-hidden border border-white/[0.05]">
                              <div
                                className="h-full bg-gradient-to-r from-white/50 to-white/90 rounded-full"
                                style={{ width: `${area.churnScore * 100}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
