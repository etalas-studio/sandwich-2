import { useState } from "react";
import Board from "./components/Board";
import Nav, { type TabId } from "./components/Nav";
import Queue from "./components/Queue";
import Review, { reviewItems } from "./components/Review";
import MetricsView from "./components/Metrics";
import { useAppState } from "./state";

interface OpenRun {
  ticket: string;
  runId: string;
}

export default function App() {
  const { state, error, reload } = useAppState();
  const [tab, setTab] = useState<TabId>("board");
  const [openRun, setOpenRun] = useState<OpenRun | null>(null);

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

  return (
    <div className="wrap">
      <header>
        <span className="brand">Agent pipeline</span>
        <span className="repo">{repoLabel}</span>
        <Nav active={tab} onChange={goTab} reviewCount={reviewCount} />
      </header>
      <div id="main">
        {openRun ? (
          <div className="empty">Run detail placeholder — added in Task 11.</div>
        ) : (
          <>
            {tab === "board" && <Board state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} reload={reload} />}
            {tab === "queue" && <Queue state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} reload={reload} />}
            {tab === "review" && <Review state={state} onOpenRun={(ticket, runId) => setOpenRun({ ticket, runId })} />}
            {tab === "metrics" && <MetricsView metrics={state.metrics} />}
            {tab !== "board" && tab !== "queue" && tab !== "review" && tab !== "metrics" && (
              <div className="empty">Tab "{tab}" placeholder — added in Task 10.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
