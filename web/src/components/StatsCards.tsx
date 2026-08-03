import type { Stats } from '../types'

interface StatsCardsProps {
  stats: Stats
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const statItems = [
    {
      label: 'Agent Success Rate',
      value: `${Math.round(stats.agentSuccessRate * 100)}%`,
      progress: stats.agentSuccessRate,
    },
    {
      label: 'Avg Duration',
      value: formatDuration(stats.avgDurationSec),
      hint: 'per run',
      progress: null,
    },
    {
      label: 'Autonomy Rate',
      value: `${Math.round(stats.autonomyRate * 100)}%`,
      hint: 'no human edits',
      progress: stats.autonomyRate,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {statItems.map((stat) => (
        <div key={stat.label} className="ds-card-outer ds-shadow-elevated">
          <div className="ds-card-inner p-4">
            {/* Content */}
            <div className="relative z-10">
              <div className="text-[11px] text-white/40 font-normal tracking-wide uppercase mb-2">
                {stat.label}
              </div>
              <div className="flex items-end gap-2 mb-2">
                <div className="text-2xl text-white tracking-tight font-light">{stat.value}</div>
                {stat.hint && <span className="text-xs text-white/30 font-light mb-1">{stat.hint}</span>}
              </div>
              {stat.progress !== null && (
                <div className="w-full h-1 bg-[#0a0a0a] rounded-full overflow-hidden border border-white/[0.05]" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)' }}>
                  <div
                    className="h-full bg-gradient-to-r from-white/50 to-white/90 rounded-full"
                    style={{ width: `${stat.progress * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
