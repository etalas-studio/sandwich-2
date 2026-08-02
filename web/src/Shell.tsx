import { useState } from "react";
import { useTickets } from "./useTickets";
import TicketList from "./components/TicketList";
import TicketBoard from "./components/TicketBoard";
import TicketDetail from "./components/TicketDetail";

type View = "list" | "board";

export default function Shell() {
  const { tickets, error } = useTickets();
  const [view, setView] = useState<View>("board");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedTicket = tickets?.find((t) => t.key === selectedKey) ?? null;

  return (
    <div className="ds-bg min-h-screen text-white antialiased p-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-normal tracking-tight text-white ds-text-shadow">Tickets</h1>
        <div className="flex gap-1 p-1 rounded-lg border border-white/[0.05] bg-white/[0.02]">
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-light transition-colors ${
              view === "list" ? "bg-white/[0.08] text-white" : "text-white/50 hover:text-white"
            }`}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-light transition-colors ${
              view === "board" ? "bg-white/[0.08] text-white" : "text-white/50 hover:text-white"
            }`}
            onClick={() => setView("board")}
          >
            Board
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#522525] bg-gradient-to-b from-[#3a1d1d] to-[#241010] px-4 py-3 text-sm text-[#ff8a8a]">
          Could not reach the server: {error}
        </div>
      )}

      {!error && tickets === null && <div className="text-white/50 text-sm">Loading…</div>}

      {tickets && tickets.length === 0 && (
        <div className="text-white/50 text-sm">No tickets queued yet.</div>
      )}

      {tickets && tickets.length > 0 && view === "list" && (
        <TicketList tickets={tickets} onOpenTicket={setSelectedKey} />
      )}

      {tickets && tickets.length > 0 && view === "board" && (
        <TicketBoard tickets={tickets} onOpenTicket={setSelectedKey} />
      )}

      {selectedTicket && <TicketDetail ticket={selectedTicket} onClose={() => setSelectedKey(null)} />}
    </div>
  );
}
