import type { Ticket } from "../apiTypes";
import { columnOf, stageOf, STAGE_LABEL } from "../apiTypes";
import StatusBadge from "./StatusBadge";

export default function TicketList({
  tickets,
  onOpenTicket,
}: {
  tickets: Ticket[];
  onOpenTicket: (key: string) => void;
}) {
  return (
    <div className="ds-card-outer ds-shadow-elevated">
      <div className="ds-card-inner overflow-hidden">
        <div className="relative z-10 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-white/[0.04] bg-[#0a0a0a]/50">
                <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Key</th>
                <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Summary</th>
                <th className="px-6 py-3 text-xs text-white/40 font-normal tracking-wide uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {tickets.map((t) => {
                const column = columnOf(t);
                const label = column === "in_progress" && t.latestRun ? STAGE_LABEL[stageOf(t.latestRun)] : undefined;
                return (
                  <tr
                    key={t.key}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => onOpenTicket(t.key)}
                  >
                    <td className="px-6 py-4 text-white/50 font-mono text-xs">
                      {t.url ? (
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-white/90"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.key}
                        </a>
                      ) : (
                        t.key
                      )}
                    </td>
                    <td className="px-6 py-4 text-white/90 font-light">{t.summary}</td>
                    <td className="px-6 py-4">
                      <StatusBadge column={column} label={label} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
