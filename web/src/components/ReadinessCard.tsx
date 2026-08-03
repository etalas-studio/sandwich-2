import { useState } from "react";
import type { ScanResult } from "../api/scans";

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

interface Props {
  scan: ScanResult;
}

function RiskCell({ note }: { note: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!note) return <span className="text-white/30 text-xs">—</span>;

  const long = note.length > 120;
  return (
    <div className="text-white/40 font-light text-xs leading-relaxed">
      <span className={!expanded && long ? "line-clamp-2" : ""}>
        {note}
      </span>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-white/50 hover:text-white/80 transition-colors mt-0.5 block"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export default function ReadinessCard({ scan }: Props) {
  return (
    <>
      {/* Tech stack + test command */}
      <div className="ds-card-outer ds-shadow-elevated mb-6" style={{ height: "auto" }}>
        <div className="ds-card-inner p-6" style={{ height: "auto" }}>
          <div className="absolute inset-0 ds-noise pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#333] to-[#111] flex items-center justify-center border border-[#333] ds-shadow-card">
                  <iconify-icon icon="solar:radar-linear" width="16" className="text-white/80" />
                </div>
                <h3 className="text-sm font-normal text-white ds-text-shadow">
                  Project Scan
                </h3>
              </div>
              <span className="text-[11px] text-white/30 font-light">
                Scanned {relativeTime(scan.startedAt)}
              </span>
            </div>

            {scan.projectName && (
              <h2 className="text-lg font-normal tracking-tight text-white ds-text-shadow mb-2">
                {scan.projectName}
              </h2>
            )}
            {scan.description && (
              <p className="text-sm text-white/60 font-light leading-relaxed mb-4">
                {scan.description}
              </p>
            )}
            {scan.techStack && (
              <div className="mb-4">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
                  Tech Stack
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {scan.techStack.split(", ").map((tech) => (
                    <span
                      key={tech}
                      className="px-2 py-0.5 rounded bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] text-white/60 text-[10px] font-normal tracking-wide border border-white/[0.05]"
                      style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)" }}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {scan.testCommand && (
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">
                  Test Command
                </div>
                <code className="px-2.5 py-1.5 rounded bg-[#0a0a0a] border border-white/[0.05] text-xs text-white/60 font-mono">
                  {scan.testCommand}
                </code>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Area signals table */}
      {scan.areaSignals && scan.areaSignals.length > 0 && (
        <div>
          <div className="section-label">Area Signals</div>
          <div className="ds-card-outer ds-shadow-elevated mb-8" style={{ height: "auto" }}>
            <div className="ds-card-inner overflow-hidden" style={{ height: "auto" }}>
              <div className="absolute inset-0 ds-noise pointer-events-none" />
              <div className="relative z-10 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-[#0a0a0a]/50">
                      <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase w-[35%]">Area</th>
                      <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Test-to-Code</th>
                      <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Churn</th>
                      <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase w-[30%]">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {scan.areaSignals.map((area) => {
                      const coveragePct = Math.round(area.testToCodeRatio * 100);
                      const coverageColor =
                        area.testToCodeRatio >= 0.7
                          ? "text-[#8affb1]"
                          : area.testToCodeRatio >= 0.4
                            ? "text-[#f59e0b]"
                            : "text-[#ff8a8a]";

                      const churn = area.churnScore;
                      const churnLabel = churn >= 0.7 ? "High" : churn >= 0.3 ? "Medium" : churn > 0 ? "Low" : "None";
                      const churnColor =
                        churn >= 0.7
                          ? "text-[#ff8a8a]"
                          : churn >= 0.3
                            ? "text-[#f59e0b]"
                            : churn > 0
                              ? "text-white/50"
                              : "text-white/25";

                      return (
                        <tr key={area.area} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-3">
                            <div className="text-white/80 font-mono text-xs">{area.area}</div>
                            <div className="text-[10px] text-white/30 font-light mt-0.5">
                              {area.files} file{area.files !== 1 ? 's' : ''}
                            </div>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`text-xs font-mono font-light ${coverageColor}`}>
                              {coveragePct}%
                            </span>
                            {area.testFileCount > 0 && (
                              <span className="text-[10px] text-white/30 font-light ml-1">
                                ({area.testFileCount} test{area.testFileCount !== 1 ? 's' : ''})
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`text-xs font-light ${churnColor}`}>
                              {churnLabel}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <RiskCell note={area.note} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
