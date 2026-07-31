import { api } from "../api";
import { OUTCOME_LABEL } from "../outcomeLabels";
import type { Job, RunRecord, StateResponse, TicketInput } from "../types";

interface BoardProps {
  state: StateResponse;
  onOpenRun: (ticket: string, runId: string) => void;
  reload: () => Promise<void>;
}

interface BoardItem {
  ticket: TicketInput;
  run: RunRecord | undefined;
  job: Job | undefined;
}

function activeJob(jobs: Job[], ticket: string): Job | undefined {
  return jobs.find((j) => j.ticket === ticket && (j.state === "running" || j.state === "queued"));
}

function latestByTicket(runs: RunRecord[]): Map<string, RunRecord> {
  const map = new Map<string, RunRecord>();
  for (const r of runs) map.set(r.ticket, r);
  return map;
}

export default function Board({ state, onOpenRun, reload }: BoardProps) {
  const latest = latestByTicket(state.runs);
  const columns: Array<[string, BoardItem[]]> = [
    ["Queue", []],
    ["Waiting on you", []],
    ["Running", []],
    ["Ready for review", []],
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

  const running = state.jobs.filter((j) => j.state === "running").length;
  const queued = state.jobs.filter((j) => j.state === "queued").length;

  const startOne = async (key: string) => {
    try {
      await api("/api/runs", "POST", { ticket: key });
    } catch (e) {
      alert((e as Error).message);
    }
    await reload();
  };

  return (
    <>
      <div className="bar">
        <span className="hint">
          Pick which tickets to run from the <b>Queue</b> tab — there's deliberately no "run all" button here.
        </span>
        <span className="status">
          {running} running · {queued} queued · runs serially
        </span>
      </div>
      <div className="cols">
        {columns.map(([name, items]) => (
          <div className="col" key={name}>
            <h3>
              {name} · {items.length}
            </h3>
            {items.length === 0 ? (
              <div className="hint">empty</div>
            ) : (
              items.map((item) => <Card key={item.ticket.key} item={item} onOpenRun={onOpenRun} onStart={startOne} />)
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function Card({
  item,
  onOpenRun,
  onStart,
}: {
  item: BoardItem;
  onOpenRun: (ticket: string, runId: string) => void;
  onStart: (key: string) => void;
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
    if (run) onOpenRun(ticket.key, run.runId);
    else onStart(ticket.key);
  };

  return (
    <div className={`card ${cls}`} onClick={handleClick}>
      <div className="key">{ticket.key}</div>
      <div className="ttl">{(ticket.summary || "").slice(0, 78)}</div>
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
        <div className="hint">click to start</div>
      )}
    </div>
  );
}
