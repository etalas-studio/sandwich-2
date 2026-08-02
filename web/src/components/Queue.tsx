import { useState } from "react";
import { api } from "../api";
import { OUTCOME_LABEL } from "../outcomeLabels";
import type { Job, RunRecord, StateResponse, TicketInput } from "../types";

function DragIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ opacity: 0.35 }}>
      <circle cx="4" cy="3" r="1.5" />
      <circle cx="10" cy="3" r="1.5" />
      <circle cx="4" cy="7" r="1.5" />
      <circle cx="10" cy="7" r="1.5" />
      <circle cx="4" cy="11" r="1.5" />
      <circle cx="10" cy="11" r="1.5" />
    </svg>
  );
}

interface QueueProps {
  state: StateResponse;
  onOpenRun: (ticket: string, runId: string | null) => void;
  reload: () => Promise<void>;
  openRun: { ticket: string; runId: string | null } | null;
}

interface BoardItem {
  ticket: TicketInput;
  run: RunRecord | undefined;
  job: Job | undefined;
}

export function activeJob(jobs: Job[], ticket: string): Job | undefined {
  return jobs.find((j) => j.ticket === ticket && (j.state === "running" || j.state === "queued"));
}

function latestByTicket(runs: RunRecord[]): Map<string, RunRecord> {
  const map = new Map<string, RunRecord>();
  for (const r of runs) map.set(r.ticket, r);
  return map;
}

function freshTickets(state: StateResponse): TicketInput[] {
  const latest = latestByTicket(state.runs);
  return state.tickets.filter((t) => {
    if (activeJob(state.jobs, t.key)) return false;
    const r = latest.get(t.key);
    return !r || r.outcome === "no_changes";
  });
}

export type ViewMode = "board" | "list";

export default function Queue({ state, onOpenRun, reload, openRun }: QueueProps) {
  const [view, setView] = useState<ViewMode>("list");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const latest = latestByTicket(state.runs);
  const fresh = freshTickets(state).map((t) => t.key);
  const allOn = fresh.length > 0 && fresh.every((k) => sel.has(k));
  const chosen = state.tickets.filter((t) => sel.has(t.key)).length;
  const running = state.jobs.filter((j) => j.state === "running").length;
  const queued = state.jobs.filter((j) => j.state === "queued").length;

  const toggleSel = (key: string) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelAll = () => {
    setSel((prev) => {
      if (allOn) {
        const next = new Set(prev);
        fresh.forEach((k) => next.delete(k));
        return next;
      }
      return new Set([...prev, ...fresh]);
    });
  };

  const startOne = async (key: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api("/api/runs", "POST", { ticket: key });
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy(false);
    await reload();
  };

  const startSelected = async () => {
    const keys = state.tickets.map((t) => t.key).filter((k) => sel.has(k));
    if (keys.length === 0) return;
    if (!confirm(`Run the plan stage for ${keys.length} ticket(s)?\n\n${keys.join("\\n")}`)) return;

    setBusy(true);
    for (const key of keys) {
      try {
        await api("/api/runs", "POST", { ticket: key });
      } catch (e) {
        alert(`${key}: ${(e as Error).message}`);
        break;
      }
    }
    setSel(new Set());
    setBusy(false);
    await reload();
  };

  const handleDrop = async (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) return;
    const order = state.tickets.map((t) => t.key).filter((k) => k !== dragKey);
    const targetIndex = order.indexOf(targetKey);
    order.splice(targetIndex, 0, dragKey);
    await api("/api/queue/reorder", "POST", { order });
    await reload();
  };

  // Build kanban columns
  const columns: Array<[string, BoardItem[]]> = [
    ["Not started", []],
    ["Awaiting approval", []],
    ["Running", []],
    ["Awaiting preview", []],
    ["Done / stopped", []],
  ];

  for (const ticket of state.tickets) {
    const job = activeJob(state.jobs, ticket.key);
    const run = latest.get(ticket.key);
    const item: BoardItem = { ticket, run, job };
    if (job) {
      columns[2]![1].push(item);
      continue;
    }
    if (run && run.outcome === "awaiting_plan_approval") {
      columns[1]![1].push(item);
      continue;
    }
    if (run && run.outcome === "ready_for_review" && run.merged === null) {
      columns[3]![1].push(item);
      continue;
    }
    if (run && run.outcome !== "no_changes") {
      columns[4]![1].push(item);
      continue;
    }
    columns[0]![1].push(item);
  }

  const runsWithoutTicket = state.runs.filter((r) => !state.tickets.some((t) => t.key === r.ticket));
  for (const run of runsWithoutTicket) {
    columns[4]![1].push({ ticket: { key: run.ticket, summary: "(no longer queued)", description: "" }, run, job: undefined });
  }

  return (
    <>
      <div className="bar">
        <button className="act warn" onClick={() => void startSelected()} disabled={chosen === 0 || busy}>
          Run {chosen || ""} selected
        </button>
        <button className="act" onClick={toggleSelAll}>
          {allOn ? "Clear selection" : "Select unused"}
        </button>
        <span style={{ flex: 1 }} />
        <span className="status">
          {running} running · {queued} queued · runs serially
        </span>
        <span className="view-toggle">
          <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
            List
          </button>
          <button className={view === "board" ? "on" : ""} onClick={() => setView("board")}>
            Board
          </button>
        </span>
      </div>

      {view === "list" ? (
        <>
          <div className="hint" style={{ marginBottom: 10 }}>
            Check tickets to run — each attempt spends model quota. Drag rows to reorder priority.
          </div>
          <div className="ticket-list">
            {state.tickets.map((t, i) => {
              const r = latest.get(t.key);
              const j = activeJob(state.jobs, t.key);
              const used = !!r && r.outcome !== "no_changes";
              const on = sel.has(t.key);
              const isOpen = !!openRun && openRun.ticket === t.key && (r?.runId ?? null) === openRun.runId;
              const statusCls =
                j ? "running" :
                !used ? "fresh" :
                r?.outcome === "ready_for_review" ? "ok" :
                r?.outcome === "awaiting_plan_approval" ? "warn" :
                r?.outcome === "guardrail_blocked" || r?.outcome === "tests_failed" || r?.outcome === "error" ? "bad" :
                "done";
              return (
                <div
                  key={t.key}
                  className={`ticket-row ${on ? "selected" : ""} ${isOpen ? "open" : ""} ${j ? "running" : ""}`}
                  draggable={!j}
                  onClick={() => onOpenRun(t.key, r ? r.runId : null)}
                  onDragStart={() => setDragKey(t.key)}
                  onDragEnd={() => setDragKey(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void handleDrop(t.key);
                  }}
                >
                  <div className="t-drag" onClick={(e) => e.stopPropagation()}> {!j && <DragIcon />}</div>
                  <div className="t-check">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!!j}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSel(t.key)}
                    />
                  </div>
                  <div className="t-idx">{i + 1}</div>
                  <div className="t-key">
                    {t.url ? (
                      <a href={t.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        {t.key}
                      </a>
                    ) : (
                      t.key
                    )}
                  </div>
                  <div className="t-title">{t.summary || "—"}</div>
                  <div className={`t-status ${statusCls}`}>
                    {j ? (
                      <>
                        <span className="prog-dot" />
                        {j.step}
                      </>
                    ) : used ? (
                      OUTCOME_LABEL[r!.outcome]
                    ) : (
                      "Not run"
                    )}
                  </div>
                  <div className="t-stats">
                    {r ? (
                      <>
                        {r.filesChanged ? <span>{r.filesChanged} files</span> : null}
                        {r.diffLines ? <span>{r.diffLines} lines</span> : null}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
                  <div className="t-act">
                    {r ? (
                      <button className="act sm" onClick={(e) => { e.stopPropagation(); onOpenRun(t.key, r.runId); }}>
                        Open
                      </button>
                    ) : (
                      <button className="act sm" onClick={(e) => { e.stopPropagation(); void startOne(t.key); }}>
                        Start
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hint" style={{ marginTop: 10 }}>
            {fresh.length} of {state.tickets.length} tickets not yet run.
          </div>
        </>
      ) : (
        <div className="cols">
          {columns.map(([name, items]) => (
            <div className="col" key={name}>
              <h3>
                {name} · {items.length}
              </h3>
              {items.length === 0 ? (
                <div className="hint">empty</div>
              ) : (
                items.map((item) => (
                  <Card
                    key={item.run?.runId ?? item.ticket.key}
                    item={item}
                    onOpenRun={onOpenRun}
                    onStart={startOne}
                    selected={sel.has(item.ticket.key)}
                    onToggleSelect={() => toggleSel(item.ticket.key)}
                    isOpen={!!openRun && openRun.ticket === item.ticket.key && (item.run?.runId ?? null) === openRun.runId}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Card({
  item,
  onOpenRun,
  onStart,
  selected,
  onToggleSelect,
  isOpen,
}: {
  item: BoardItem;
  onOpenRun: (ticket: string, runId: string | null) => void;
  onStart: (key: string) => void;
  selected: boolean;
  onToggleSelect: () => void;
  isOpen: boolean;
}) {
  const { ticket, run, job } = item;
  const cls = job
    ? ""
    : run && run.outcome === "awaiting_plan_approval"
      ? "w"
      : run && (run.outcome === "guardrail_blocked" || run.outcome === "tests_failed" || run.outcome === "error")
        ? "b"
        : "";

  const handleClick = () => {
    onOpenRun(ticket.key, run ? run.runId : null);
  };

  return (
    <div className={`card ${cls} ${selected ? "selected" : ""} ${isOpen ? "open" : ""}`} onClick={handleClick}>
      {!job && <span className="card-drag"><DragIcon /></span>}
      <div className="card-header">
        <input
          type="checkbox"
          checked={selected}
          disabled={!!job}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          onChange={() => {}}
        />
        <div className="key">{ticket.key}</div>
      </div>
      <div className="ttl">{ticket.summary || ""}</div>
      {job ? (
        <>
          <div className="meta">
            {job.step}
            {job.detail ? ` · ${job.detail}` : ""}
          </div>
          <div className="prog">
            <i></i>
          </div>
        </>
      ) : run ? (
        <>
          {run.lane ? (
            <span className={`tag ${run.lane === 3 ? "r" : run.lane === 1 ? "g" : ""}`}>{`Lane ${run.lane}`}</span>
          ) : null}
          <span className={`tag ${run.outcome === "ready_for_review" ? "g" : run.outcome === "awaiting_plan_approval" ? "w" : ""}`}>
            {OUTCOME_LABEL[run.outcome]}
          </span>
          {run.filesChanged ? (
            <div className="meta">
              {run.filesChanged} files · {run.diffLines} lines
              {run.addedTestFiles ? ` · ${run.addedTestFiles} new specs` : ""}
            </div>
          ) : null}
          {run.blockedBy.length > 0 ? <div className="meta" style={{ color: "var(--bad-tx)" }}>{run.blockedBy[0]}</div> : null}
        </>
      ) : (
        <button className="act sm" style={{ marginTop: 6 }} onClick={(e) => { e.stopPropagation(); onStart(ticket.key); }}>
          Start
        </button>
      )}
    </div>
  );
}
