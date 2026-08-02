import { useEffect, useState } from "react";

interface Ticket {
  key: string;
  summary: string;
  description: string;
  url: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function TicketList() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tickets")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
        return res.json() as Promise<Ticket[]>;
      })
      .then((data) => {
        if (!cancelled) setTickets(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="ds-bg min-h-screen text-white antialiased p-10">
      <h1 className="text-4xl font-normal tracking-tight text-white ds-text-shadow mb-8">Tickets</h1>

      {error && (
        <div className="rounded-xl border border-[#522525] bg-gradient-to-b from-[#3a1d1d] to-[#241010] px-4 py-3 text-sm text-[#ff8a8a]">
          Could not reach the server: {error}
        </div>
      )}

      {!error && tickets === null && <div className="text-white/50 text-sm">Loading…</div>}

      {tickets && tickets.length === 0 && (
        <div className="text-white/50 text-sm">No tickets queued yet.</div>
      )}

      {tickets && tickets.length > 0 && (
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
                  {tickets.map((t) => (
                    <tr key={t.key} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-white/50 font-mono text-xs">
                        {t.url ? (
                          <a href={t.url} target="_blank" rel="noreferrer" className="hover:text-white/90">
                            {t.key}
                          </a>
                        ) : (
                          t.key
                        )}
                      </td>
                      <td className="px-6 py-4 text-white/90 font-light">{t.summary}</td>
                      <td className="px-6 py-4">
                        <span
                          className="px-2.5 py-1 rounded bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] text-white/70 text-xs font-normal tracking-wide border border-white/[0.05]"
                          style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)" }}
                        >
                          Not run
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
