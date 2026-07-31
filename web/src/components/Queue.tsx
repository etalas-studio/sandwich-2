import { useState } from "react";
import { api } from "../api";
import { OUTCOME_LABEL } from "../outcomeLabels";
import type { Job, RunRecord, StateResponse, TicketInput } from "../types";

interface QueueProps {
  state: StateResponse;
  onOpenRun: (ticket: string, runId: string) => void;
  reload: () => Promise<void>;
}

function activeJob(jobs: Job[], ticket: string): Job | undefined {
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

export default function Queue({ state, onOpenRun, reload }: QueueProps) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const latest = latestByTicket(state.runs);
  const fresh = freshTickets(state).map((t) => t.key);
  const allOn = fresh.length > 0 && fresh.every((k) => sel.has(k));
  const chosen = state.tickets.filter((t) => sel.has(t.key)).length;

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
    if (!confirm(`Run the plan stage for ${keys.length} ticket(s)?\n\n${keys.join("\n")}`)) return;

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

  return (
    <>
      <div className="bar">
        <button className="act warn" onClick={() => void startSelected()} disabled={chosen === 0 || busy}>
          Run {chosen || ""} selected
        </button>
        <button className="act" onClick={toggleSelAll}>
          {allOn ? "Clear selection" : "Select unused tickets"}
        </button>
        <span className="status">
          {state.jobs.filter((j) => j.state === "running").length} running · {state.jobs.filter((j) => j.state === "queued").length} queued · runs serially
        </span>
      </div>
      <div className="hint" style={{ marginBottom: 10 }}>
        Check the tickets you want to run — each attempt spends model quota, so pick only what's needed. Row order = execution
        order; drag rows to change priority.
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 28 }}></th>
            <th style={{ width: 26 }}></th>
            <th>Ticket</th>
            <th>Title</th>
            <th>Last status</th>
            <th className="n">Files</th>
            <th className="n">Lines</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {state.tickets.map((t, i) => {
            const r = latest.get(t.key);
            const j = activeJob(state.jobs, t.key);
            const used = !!r && r.outcome !== "no_changes";
            const on = sel.has(t.key);
            return (
              <tr
                key={t.key}
                className={`row ${on ? "on" : ""}`}
                draggable
                onDragStart={() => setDragKey(t.key)}
                onDragEnd={() => setDragKey(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleDrop(t.key);
                }}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!!j}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSel(t.key)}
                  />
                </td>
                <td style={{ color: "var(--tx3)", fontSize: 11 }}>{i + 1}</td>
                <td className="key">
                  {t.url ? (
                    <a href={t.url} target="_blank" rel="noreferrer">
                      {t.key}
                    </a>
                  ) : (
                    t.key
                  )}
                </td>
                <td style={{ fontSize: 12 }}>{(t.summary || "").slice(0, 78)}</td>
                <td style={{ fontSize: 12 }}>{j ? j.step : used ? OUTCOME_LABEL[r!.outcome] : "never run"}</td>
                <td className="n">{r ? r.filesChanged : "—"}</td>
                <td className="n">{r ? r.diffLines : "—"}</td>
                <td>
                  {r ? (
                    <button className="act" onClick={() => onOpenRun(t.key, r.runId)}>
                      Open
                    </button>
                  ) : (
                    <button className="act" onClick={() => void startOne(t.key)}>
                      Start
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="hint" style={{ marginTop: 10 }}>
        {fresh.length} of {state.tickets.length} tickets have never been run. "Select unused tickets" won't select tickets that
        already have a result.
      </div>
    </>
  );
}
