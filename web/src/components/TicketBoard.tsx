import type { Column, Ticket } from "../apiTypes";
import { columnOf, stageOf, STAGE_LABEL, COLUMN_LABEL } from "../apiTypes";

const COLUMNS: Column[] = ["backlog", "in_progress", "blocked", "ready_for_review"];

export default function TicketBoard({
  tickets,
  onOpenTicket,
}: {
  tickets: Ticket[];
  onOpenTicket: (key: string) => void;
}) {
  const byColumn = new Map<Column, Ticket[]>(COLUMNS.map((c) => [c, []]));
  for (const t of tickets) byColumn.get(columnOf(t))!.push(t);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
      {COLUMNS.map((column) => {
        const items = byColumn.get(column)!;
        return (
          <div key={column} className="ds-card-outer ds-shadow-elevated">
            <div className="ds-card-inner p-4">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs text-white/40 font-normal tracking-wide uppercase">
                  {COLUMN_LABEL[column]}
                </span>
                <span className="text-xs text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-md border border-white/[0.05]">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {items.length === 0 && <div className="text-white/30 text-xs px-1 py-2">Empty</div>}
                {items.map((t) => (
                  <Card key={t.key} ticket={t} onOpen={() => onOpenTicket(t.key)} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Card({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const run = ticket.latestRun;
  const column = columnOf(ticket);

  return (
    <div
      className="rounded-lg border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer p-3"
      onClick={onOpen}
    >
      <div className="text-xs text-white/40 font-mono mb-1">{ticket.key}</div>
      <div className="text-sm text-white/90 font-light mb-2">{ticket.summary}</div>
      {column === "in_progress" && run && (
        <div className="text-xs text-[#f59e0b]">{STAGE_LABEL[stageOf(run)]}</div>
      )}
      {column === "blocked" && run?.needsHumanCategory && (
        <div className="text-xs text-[#ff8a8a]">{formatCategory(run.needsHumanCategory)}</div>
      )}
      {column === "ready_for_review" && run?.prUrl && (
        <a
          href={run.prUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[#8affb1] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View PR
        </a>
      )}
    </div>
  );
}

function formatCategory(category: string): string {
  return category.replace(/_/g, " ");
}
