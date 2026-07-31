import { useEffect, useState } from "react";
import { api } from "../api";
import Diff from "./Diff";
import { OUTCOME_LABEL } from "../outcomeLabels";
import type { RunDetailResponse } from "../types";

interface RunDetailProps {
  ticket: string;
  runId: string;
  onBack: () => void;
  onChanged: () => Promise<void>;
}

export default function RunDetail({ ticket, runId, onBack, onChanged }: RunDetailProps) {
  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api<RunDetailResponse>(`/api/runs/${ticket}/${runId}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(load, [ticket, runId]);

  if (error) {
    return (
      <>
        <span className="back" onClick={onBack}>
          ← back
        </span>
        <div className="empty">{error}</div>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <span className="back" onClick={onBack}>
          ← back
        </span>
        <div className="empty">Loading…</div>
      </>
    );
  }

  const r = data.record;
  const awaiting = r.outcome === "awaiting_plan_approval";
  const reviewable = r.outcome === "ready_for_review";

  const approve = async () => {
    try {
      await api(`/api/runs/${ticket}/${runId}/approve`, "POST", {});
    } catch (e) {
      alert((e as Error).message);
      return;
    }
    onBack();
    await onChanged();
  };

  const reject = async () => {
    const reason = prompt("Why reject this plan?") ?? "";
    try {
      await api(`/api/runs/${ticket}/${runId}/reject`, "POST", { reason });
    } catch (e) {
      alert((e as Error).message);
      return;
    }
    onBack();
    await onChanged();
  };

  return (
    <>
      <span className="back" onClick={onBack}>
        ← back
      </span>
      <div className="panel">
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <span className="key">
            {r.ticketUrl ? (
              <a href={r.ticketUrl} target="_blank" rel="noreferrer">
                {r.ticket}
              </a>
            ) : (
              r.ticket
            )}
          </span>
          <span className={`tag ${reviewable ? "g" : awaiting ? "w" : ""}`}>{OUTCOME_LABEL[r.outcome]}</span>
          {r.lane ? <span className={`tag ${r.lane === 3 ? "r" : r.lane === 1 ? "g" : ""}`}>Lane {r.lane}</span> : null}
          <span className="meta">
            {r.filesChanged} files · {r.diffLines} lines · {r.addedTestFiles} new specs ·{" "}
            {r.durationSec ? `${(r.durationSec / 60).toFixed(1)} min` : "—"}
          </span>
        </div>
        <div className="meta">branch {r.branch}</div>
        {r.notes ? <div className="hint">{r.notes}</div> : null}
        {r.blockedBy.length > 0 ? (
          <div className="hint" style={{ color: "var(--bad-tx)" }}>
            Blocked: {r.blockedBy.join("; ")}
          </div>
        ) : null}
        {r.violations.length > 0 ? (
          <div className="hint" style={{ color: "var(--bad-tx)" }}>
            Violations: {r.violations.join("; ")}
          </div>
        ) : null}
        {awaiting ? (
          <div className="bar">
            <button className="act warn" onClick={() => void approve()}>
              Approve plan → start coding
            </button>
            <button className="act bad" onClick={() => void reject()}>
              Reject plan
            </button>
          </div>
        ) : null}
      </div>

      <div className="two">
        <div className="panel">
          <h4>Plan</h4>
          {data.plan ? <pre>{data.plan}</pre> : <div className="hint">none yet</div>}
        </div>
        <div className="panel">
          <h4>Diff</h4>
          {data.diff ? <Diff patch={data.diff} /> : <div className="hint">no changes yet</div>}
        </div>
      </div>

      {r.rspec && r.rspec.ran ? (
        <div className="panel">
          <h4>rspec result</h4>
          <table>
            <tbody>
              <tr>
                <td>Examples run</td>
                <td className="n">{r.rspec.exampleCount ?? "?"}</td>
              </tr>
              <tr>
                <td>Failures</td>
                <td className="n">{r.rspec.failureCount ?? "?"}</td>
              </tr>
              <tr>
                <td>Duration</td>
                <td className="n">{r.rspec.durationSec ? `${r.rspec.durationSec.toFixed(1)} s` : "—"}</td>
              </tr>
              <tr>
                <td>Specs run</td>
                <td style={{ font: "11px var(--mono)" }}>{r.rspec.targets.join(", ") || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {data.toolCalls ? (
        <div className="panel">
          <h4>Tool calls used by the agent</h4>
          <pre>{data.toolCalls}</pre>
        </div>
      ) : null}
      {data.agentOutput ? (
        <div className="panel">
          <h4>Agent notes</h4>
          <pre>{data.agentOutput.slice(-3000)}</pre>
        </div>
      ) : null}

      {reviewable || r.humanEditedLines !== null ? <ReviewForm ticket={ticket} runId={runId} record={r} onSaved={load} /> : null}
    </>
  );
}

function ReviewForm({
  ticket,
  runId,
  record,
  onSaved,
}: {
  ticket: string;
  runId: string;
  record: RunDetailResponse["record"];
  onSaved: () => void;
}) {
  const [hel, setHel] = useState(record.humanEditedLines?.toString() ?? "");
  const [rr, setRr] = useState(record.reviewRounds?.toString() ?? "");
  const [merged, setMerged] = useState(record.merged === true ? "yes" : record.merged === false ? "no" : "");
  const [notes, setNotes] = useState(record.notes ?? "");

  const save = async () => {
    try {
      await api(`/api/runs/${ticket}/${runId}/review`, "POST", {
        humanEditedLines: hel === "" ? null : Number(hel),
        reviewRounds: rr === "" ? null : Number(rr),
        merged: merged === "" ? null : merged === "yes",
        notes,
      });
    } catch (e) {
      alert((e as Error).message);
      return;
    }
    onSaved();
  };

  return (
    <div className="panel">
      <h4>Review result — only fillable by a human</h4>
      <div className="grid3">
        <div>
          <label>Lines of code you changed after the PR was opened</label>
          <input type="number" min={0} value={hel} placeholder="0" onChange={(e) => setHel(e.target.value)} />
        </div>
        <div>
          <label>Review rounds</label>
          <input type="number" min={0} value={rr} placeholder="1" onChange={(e) => setRr(e.target.value)} />
        </div>
        <div>
          <label>Merged?</label>
          <select value={merged} onChange={(e) => setMerged(e.target.value)}>
            <option value="">not yet</option>
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <label>Notes</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="bar">
        <button className="act" onClick={() => void save()}>
          Save review
        </button>
      </div>
      <div className="hint">
        Zero in the first column means the agent's work was truly taken as-is — that's what counts toward autonomy rate.
      </div>
    </div>
  );
}
