import { useEffect, useState, useCallback } from "react";
import Markdown from "markdown-to-jsx";
import { api } from "../api";
import Diff from "./Diff";
import PipelineStage, { pipelineState } from "./PipelineStage";
import { OUTCOME_LABEL } from "../outcomeLabels";
import type { Job, RunDetailResponse, TicketInput, FilesSummary } from "../types";

interface RunDetailProps {
  ticketKey: string;
  runId: string | null;
  ticket?: TicketInput;
  job?: Job;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

// Lane explanations
const LANE_INFO: Record<number, { label: string; desc: string }> = {
  1: { label: "Fast path", desc: "Auto-merge" },
  2: { label: "Review", desc: "Needs approval" },
  3: { label: "Blocked", desc: "Guardrails hit" },
};

// Format relative time
function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Format duration
function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const mins = Math.floor(sec / 60);
  const secs = Math.round(sec % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

// Parse files.json
function parseFilesSummary(files: string | null): FilesSummary | null {
  if (!files) return null;
  try {
    return JSON.parse(files) as FilesSummary;
  } catch {
    return null;
  }
}

// Count diff lines
function countDiffLines(patch: string): { added: number; removed: number } {
  let added = 0, removed = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    else if (line.startsWith("-") && !line.startsWith("---")) removed++;
  }
  return { added, removed };
}

export default function RunDetail({ ticketKey, runId, ticket, job, onClose, onChanged }: RunDetailProps) {
  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!runId) return;
    api<RunDetailResponse>(`/api/runs/${ticketKey}/${runId}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [ticketKey, runId]);

  useEffect(() => {
    setData(null);
    setError(null);
    load();
  }, [ticketKey, runId]);

  useEffect(() => {
    if (runId) load();
  }, [job?.state, job?.step, job?.detail, load, runId]);

  const start = async () => {
    setStarting(true);
    try {
      await api("/api/runs", "POST", { ticket: ticketKey });
    } catch (e) {
      alert((e as Error).message);
    }
    setStarting(false);
    await onChanged();
  };

  // Keyboard: Escape to close
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  const approve = async () => {
    if (!data || !runId) return;
    try {
      await api(`/api/runs/${ticketKey}/${runId}/approve`, "POST", {});
    } catch (e) {
      alert((e as Error).message);
      return;
    }
    await onChanged();
    onClose();
  };

  const reject = async () => {
    if (!data || !runId) return;
    const reason = prompt("Why reject this plan?") ?? "";
    try {
      await api(`/api/runs/${ticketKey}/${runId}/reject`, "POST", { reason });
    } catch (e) {
      alert((e as Error).message);
      return;
    }
    await onChanged();
    onClose();
  };

  // ===== RENDER: NO RUN YET =====
  
  if (!runId) {
    return (
      <aside className="detail-panel">
        <header className="detail-header">
          <div className="detail-title-row">
            <h1 className="detail-title">{ticketKey}</h1>
            <span className="status-badge neutral">Not started</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        
        <div className="detail-body">
          <section className="detail-section">
            <div className="section-label">Description</div>
            <div className="description-content">
              {ticket?.description ? (
                <Markdown>{ticket.description}</Markdown>
              ) : (
                <span className="empty-text">No description provided</span>
              )}
            </div>
          </section>
          
          <div className="detail-actions">
            {!job ? (
              <button className="btn primary" onClick={() => void start()} disabled={starting}>
                {starting ? "Starting..." : "Start plan stage"}
              </button>
            ) : (
              <div className="running-indicator">
                <span className="pulse" />
                Running: {job.step}
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  }

  // ===== RENDER: WITH RUN DATA =====

  if (error) {
    return (
      <aside className="detail-panel">
        <header className="detail-header">
          <h1 className="detail-title">{ticketKey}</h1>
          <button className="icon-btn" onClick={onClose}>×</button>
        </header>
        <div className="detail-body"><div className="error-state">{error}</div></div>
      </aside>
    );
  }

  if (!data) {
    return (
      <aside className="detail-panel">
        <header className="detail-header">
          <h1 className="detail-title">{ticketKey}</h1>
          <button className="icon-btn" onClick={onClose}>×</button>
        </header>
        <div className="detail-body"><div className="loading-state">Loading...</div></div>
      </aside>
    );
  }

  const r = data.record;
  const { stages, note } = pipelineState(r, job);
  const laneInfo = r.lane ? LANE_INFO[r.lane] : null;
  const filesSummary = parseFilesSummary(data.files);
  const diffStats = data.diff ? countDiffLines(data.diff) : null;
  
  const awaitingApproval = r.outcome === "awaiting_plan_approval" && !job;
  const needsReview = r.outcome === "ready_for_review" && r.merged === null;
  const hasError = ["tests_failed", "guardrail_blocked", "error"].includes(r.outcome);

  // Status badge
  const statusBadge = (() => {
    if (job) return { text: job.step, tone: "progress" };
    if (awaitingApproval) return { text: "Needs approval", tone: "warn" };
    if (needsReview) return { text: "Needs review", tone: "warn" };
    if (hasError) return { text: OUTCOME_LABEL[r.outcome], tone: "bad" };
    if (r.outcome === "ready_for_review" && r.merged === true) return { text: "Merged", tone: "ok" };
    if (r.outcome === "ready_for_review" && r.merged === false) return { text: "Closed", tone: "neutral" };
    return { text: OUTCOME_LABEL[r.outcome], tone: "neutral" };
  })();

  return (
    <aside className="detail-panel">
      {/* Header */}
      <header className="detail-header">
        <div className="detail-title-row">
          <h1 className="detail-title">
            <a href={r.ticketUrl ?? ticket?.url} target="_blank" rel="noreferrer">
              {ticketKey}
            </a>
          </h1>
          <span className={`status-badge ${statusBadge.tone}`}>{statusBadge.text}</span>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close (Esc)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Progress indicator */}
      <div className="detail-progress">
        <PipelineStage stages={stages} note={note} />
      </div>

      <div className="detail-body">
        {/* Properties row */}
        <div className="properties-grid">
          {r.lane && (
            <div className="property">
              <span className="property-label">Lane</span>
              <span className={`property-value lane-${r.lane}`}>
                {laneInfo?.label}
                <span className="property-hint">{laneInfo?.desc}</span>
              </span>
            </div>
          )}
          <div className="property">
            <span className="property-label">Branch</span>
            <span className="property-value mono">{r.branch}</span>
          </div>
          <div className="property">
            <span className="property-label">Duration</span>
            <span className="property-value">{formatDuration(r.durationSec)}</span>
          </div>
          <div className="property">
            <span className="property-label">Started</span>
            <span className="property-value">{formatRelativeTime(r.startedAt)}</span>
          </div>
        </div>

        {/* Change stats */}
        {r.filesChanged > 0 && diffStats && (
          <div className="change-stats">
            <span className="stat"><strong>{r.filesChanged}</strong> files</span>
            <span className="stat add">+{diffStats.added}</span>
            <span className="stat del">−{diffStats.removed}</span>
            {r.addedTestFiles > 0 && <span className="stat spec">{r.addedTestFiles} specs</span>}
          </div>
        )}

        {/* Alerts */}
        {(r.blockedBy.length > 0 || r.violations.length > 0) && (
          <div className="alert-banner error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{r.blockedBy[0] ?? r.violations[0]}</span>
          </div>
        )}

        {/* Description */}
        <section className="detail-section">
          <div className="section-label">Description</div>
          <div className="description-content">
            {ticket?.description ? (
              <Markdown>{ticket.description}</Markdown>
            ) : (
              <span className="empty-text">No description provided</span>
            )}
          </div>
        </section>

        {/* Action buttons - approve/reject */}
        {awaitingApproval && (
          <div className="action-bar">
            <span className="action-bar-text">This plan needs your approval before implementation</span>
            <div className="action-bar-buttons">
              <button className="btn primary" onClick={() => void approve()}>Approve</button>
              <button className="btn danger" onClick={() => void reject()}>Reject</button>
            </div>
          </div>
        )}

        {/* Plan */}
        {(data.plan || r.plannedFiles.length > 0) && (
          <section className="detail-section">
            <div className="section-label">
              Plan
              {r.plannedFiles.length > 0 && <span className="section-count">{r.plannedFiles.length} files</span>}
            </div>
            {data.plan ? (
              <div className="plan-content">
                <Markdown>{data.plan}</Markdown>
              </div>
            ) : (
              <span className="empty-text">No plan available</span>
            )}
            {r.plannedFiles.length > 0 && (
              <div className="planned-files">
                {r.plannedFiles.map(f => <code key={f}>{f}</code>)}
              </div>
            )}
          </section>
        )}

        {/* Changes */}
        {data.diff && (
          <section className="detail-section">
            <div className="section-label">
              Changes
              {filesSummary && filesSummary.stats.length > 1 && (
                <span className="section-count">{filesSummary.stats.length} files</span>
              )}
            </div>
            {filesSummary && filesSummary.stats.length > 1 && (
              <div className="file-list">
                {filesSummary.stats.map(s => (
                  <div key={s.file} className="file-item" onClick={() => setActiveFile(activeFile === s.file ? null : s.file)}>
                    <span className="file-name">{s.file}</span>
                    <span className="file-stats">
                      {s.added > 0 && <span className="add">+{s.added}</span>}
                      {s.removed > 0 && <span className="del">−{s.removed}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="diff-container">
              <Diff patch={data.diff} highlightFile={activeFile} />
            </div>
          </section>
        )}

        {/* Test results */}
        {r.rspec?.ran && (
          <section className="detail-section">
            <div className="section-label">
              Tests
              <span className={`section-badge ${r.rspec.failureCount ?? 0 > 0 ? "fail" : "pass"}`}>
                {r.rspec.failureCount ?? 0 > 0 ? `${r.rspec.failureCount} failed` : "Passed"}
              </span>
            </div>
            <div className="test-stats">
              <span><strong>{r.rspec.exampleCount ?? "?"}</strong> examples</span>
              <span><strong>{r.rspec.failureCount ?? 0}</strong> failures</span>
              <span><strong>{r.rspec.durationSec?.toFixed(1) ?? "—"}</strong>s</span>
            </div>
          </section>
        )}

        {/* Review form */}
        {(needsReview || r.humanEditedLines !== null) && (
          <section className="detail-section">
            <div className="section-label">
              {needsReview ? "Review required" : "Review result"}
            </div>
            <ReviewForm
              ticket={ticketKey}
              runId={runId}
              record={r}
              onSaved={load}
              prominent={needsReview}
            />
          </section>
        )}

        {/* Debug: tool calls & agent output - collapsed by default */}
        {(data.toolCalls || data.agentOutput) && (
          <details className="debug-section">
            <summary>Debug info</summary>
            {data.toolCalls && (
              <div className="debug-block">
                <div className="debug-label">Tool calls</div>
                <pre>{data.toolCalls}</pre>
              </div>
            )}
            {data.agentOutput && (
              <div className="debug-block">
                <div className="debug-label">Agent output</div>
                <pre>{data.agentOutput.slice(-2000)}</pre>
              </div>
            )}
          </details>
        )}
      </div>
    </aside>
  );
}

// ===== REVIEW FORM =====

function ReviewForm({
  ticket,
  runId,
  record,
  onSaved,
  prominent,
}: {
  ticket: string;
  runId: string;
  record: RunDetailResponse["record"];
  onSaved: () => void;
  prominent?: boolean;
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
    <div className={`review-form ${prominent ? "prominent" : ""}`}>
      <div className="form-row">
        <div className="form-field">
          <label>Lines you changed</label>
          <input type="number" min={0} value={hel} placeholder="0" onChange={e => setHel(e.target.value)} />
          <span className="field-hint">0 = full autonomy</span>
        </div>
        <div className="form-field">
          <label>Review rounds</label>
          <input type="number" min={0} value={rr} placeholder="1" onChange={e => setRr(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Merged?</label>
          <select value={merged} onChange={e => setMerged(e.target.value)}>
            <option value="">Not yet</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
      <div className="form-field">
        <label>Notes</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observations..." />
      </div>
      <button className="btn primary" onClick={() => void save()}>Save review</button>
    </div>
  );
}
