import { OUTCOME_LABEL } from "../outcomeLabels";
import type { RunRecord, StateResponse } from "../types";

export function reviewItems(runs: RunRecord[]): RunRecord[] {
  return runs.filter(
    (r) => r.outcome === "awaiting_plan_approval" || (r.outcome === "ready_for_review" && r.humanEditedLines === null),
  );
}

interface ReviewProps {
  state: StateResponse;
  onOpenRun: (ticket: string, runId: string) => void;
}

export default function Review({ state, onOpenRun }: ReviewProps) {
  const items = reviewItems(state.runs);

  if (items.length === 0) {
    return <div className="empty">Nothing waiting on you.</div>;
  }

  return (
    <>
      <div className="hint" style={{ marginBottom: 10 }}>
        Without filling in the review result, autonomy rate can't be computed — and that's the pilot's headline metric.
      </div>
      {items.map((r) => (
        <div className="panel" key={r.runId}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="key">{r.ticket}</span>
            <span className={`tag ${r.outcome === "awaiting_plan_approval" ? "w" : "g"}`}>{OUTCOME_LABEL[r.outcome]}</span>
            {r.lane ? <span className={`tag ${r.lane === 3 ? "r" : ""}`}>Lane {r.lane}</span> : null}
            <button className="act" style={{ marginLeft: "auto" }} onClick={() => onOpenRun(r.ticket, r.runId)}>
              {r.outcome === "awaiting_plan_approval" ? "Read plan" : "Fill in review"}
            </button>
          </div>
          {r.notes ? <div className="hint">{r.notes}</div> : null}
        </div>
      ))}
    </>
  );
}
