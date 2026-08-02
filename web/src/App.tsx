import { useEffect, useState } from "react";
import Nav, { type TabId } from "./components/Nav";
import Queue, { activeJob } from "./components/Queue";
import Review, { reviewItems } from "./components/Review";
import MetricsView from "./components/Metrics";
import RunDetail from "./components/RunDetail";
import Settings from "./components/Settings";
import { useAppState } from "./state";

interface OpenRun {
  ticket: string;
  runId: string | null;
}

export default function App() {
  const { state, error, reload } = useAppState();
  const [tab, setTab] = useState<TabId>("queue");
  const [openRun, setOpenRun] = useState<OpenRun | null>(null);

  // Once the ticket being viewed gets a run (e.g. the plan stage that was
  // "not started" finishes), follow it so the panel doesn't stay frozen
  // showing "Start plan stage" for a run that already exists.
  useEffect(() => {
    if (!state || !openRun) return;
    let latestRun: (typeof state.runs)[number] | undefined;
    for (const r of state.runs) if (r.ticket === openRun.ticket) latestRun = r;
    if (latestRun && latestRun.runId !== openRun.runId) {
      setOpenRun({ ticket: openRun.ticket, runId: latestRun.runId });
    }
  }, [state, openRun]);

  if (error) {
    return (
      <div className="wrap">
        <div className="empty">
          Could not reach the server: {error}
          <br />
          Run <code>node dist/cli.js serve</code> first.
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="wrap">
        <div className="empty">Loading…</div>
      </div>
    );
  }

  const reviewCount = reviewItems(state.runs).length;

  const repoLabel = `${state.config.repoPath.split("/").slice(-1)[0]} · ${state.config.baseBranch}`;

  const goTab = (next: TabId) => {
    setTab(next);
    setOpenRun(null);
  };

  const handleOpenRun = (ticket: string, runId: string | null) => {
    setOpenRun({ ticket, runId });
  };

  const handleCloseRun = () => {
    setOpenRun(null);
  };

  return (
    <div className={"wrap" + (openRun ? " sidebar-open" : "")}>
      <header>
        <span className="brand">Agent pipeline</span>
        <span className="repo">{repoLabel}</span>
        <Nav active={tab} onChange={goTab} reviewCount={reviewCount} />
      </header>
      <div id="main">
        <>
          {tab === "queue" && <Queue state={state} onOpenRun={handleOpenRun} reload={reload} openRun={openRun} />}
          {tab === "review" && <Review state={state} onOpenRun={handleOpenRun} openRun={openRun} />}
          {tab === "metrics" && <MetricsView metrics={state.metrics} />}
          {tab === "settings" && <Settings />}
        </>
      </div>
      {openRun && (
        <div className="sidebar-overlay" onClick={handleCloseRun} />
      )}
      {openRun && (
        <RunDetail
          ticketKey={openRun.ticket}
          runId={openRun.runId}
          ticket={state.tickets.find((t) => t.key === openRun.ticket)}
          job={activeJob(state.jobs, openRun.ticket)}
          onClose={handleCloseRun}
          onChanged={reload}
        />
      )}
    </div>
  );
}
