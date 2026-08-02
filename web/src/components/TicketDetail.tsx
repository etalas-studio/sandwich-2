import type { Stage, Ticket } from "../apiTypes";
import { columnOf, stageOf, STAGE_LABEL } from "../apiTypes";

const STAGES: Stage[] = ["judge", "implement", "verify", "open_pr"];

type StepStatus = "done" | "active" | "blocked" | "pending";

const STEP_STYLE: Record<StepStatus, string> = {
  done: "border-[#2b5936] bg-[#102415] text-[#8affb1]",
  active: "border-[#5a4525] bg-[#241a10] text-[#f59e0b]",
  blocked: "border-[#522525] bg-[#241010] text-[#ff8a8a]",
  pending: "border-white/[0.08] bg-transparent text-white/30",
};

function stepStatus(ticket: Ticket, step: Stage): StepStatus {
  const column = columnOf(ticket);
  if (column === "backlog") return "pending";
  if (column === "ready_for_review") return "done";
  if (column === "blocked") return step === "judge" ? "blocked" : "pending";

  const current = ticket.latestRun ? stageOf(ticket.latestRun) : "judge";
  const currentIndex = STAGES.indexOf(current);
  const stepIndex = STAGES.indexOf(step);
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

export default function TicketDetail({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const run = ticket.latestRun;
  const column = columnOf(ticket);

  return (
    <>
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md ds-bg border-l border-white/[0.05] p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-white/40 font-mono mb-1">{ticket.key}</div>
            <h2 className="text-xl font-normal text-white ds-text-shadow">{ticket.summary}</h2>
          </div>
          <button className="text-white/40 hover:text-white text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {ticket.url && (
          <a
            href={ticket.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-white/40 hover:text-white/70 hover:underline"
          >
            {ticket.url}
          </a>
        )}

        <p className="text-sm text-white/60 font-light mt-4 mb-8">{ticket.description}</p>

        <span className="text-[10px] text-white/30 uppercase tracking-wider block mb-3">Pipeline progress</span>
        <div className="flex flex-col gap-2 mb-8">
          {STAGES.map((step) => {
            const status = stepStatus(ticket, step);
            return (
              <div
                key={step}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm font-light ${STEP_STYLE[status]}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                {STAGE_LABEL[step]}
                {status === "active" && <span className="ml-auto text-xs">running</span>}
                {status === "blocked" && <span className="ml-auto text-xs">stopped here</span>}
              </div>
            );
          })}
        </div>

        {column === "blocked" && run?.needsHumanCategory && (
          <div className="rounded-xl border border-[#522525] bg-gradient-to-b from-[#3a1d1d] to-[#241010] p-4 mb-6">
            <h4 className="text-sm font-normal text-white ds-text-shadow mb-1">
              Needs human — {run.needsHumanCategory.replace(/_/g, " ")}
            </h4>
            <p className="text-xs text-white/60 font-light">{run.needsHumanReason}</p>
          </div>
        )}

        {column === "ready_for_review" && run?.prUrl && (
          <div className="rounded-xl border border-[#2b5936] bg-gradient-to-b from-[#1d3a24] to-[#102415] p-4 mb-6">
            <h4 className="text-sm font-normal text-white ds-text-shadow mb-1">Ready for review</h4>
            <p className="text-xs text-white/60 font-light mb-2">{run.prSummary}</p>
            <a href={run.prUrl} target="_blank" rel="noreferrer" className="text-xs text-[#8affb1] hover:underline">
              {run.prUrl}
            </a>
          </div>
        )}

        {column === "backlog" && <div className="text-xs text-white/40">Not run yet.</div>}
      </div>
    </>
  );
}
