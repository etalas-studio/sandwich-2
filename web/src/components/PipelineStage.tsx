import type { Job, RunRecord } from "../types";

export type StageStatus = "done" | "active" | "blocked" | "neutral" | "pending";

export interface StageInfo {
  key: string;
  label: string;
  status: StageStatus;
}

export interface PipelineState {
  stages: StageInfo[];
  note: string;
}

const ORDER: Array<{ key: string; label: string }> = [
  { key: "plan", label: "Plan" },
  { key: "approval", label: "Approval" },
  { key: "implement", label: "Implement" },
  { key: "review", label: "Review" },
];

function buildStages(currentIndex: number, currentStatus: StageStatus): StageInfo[] {
  return ORDER.map((stage, i) => ({
    ...stage,
    status: i < currentIndex ? "done" : i === currentIndex ? currentStatus : "pending",
  }));
}

function jobNote(job: Job): string {
  return job.detail ? `${job.step} · ${job.detail}` : job.step;
}

/**
 * Maps a run + any in-flight job onto the 4 fixed pipeline stages. A job
 * always wins over `record.outcome` because runImplement only writes the
 * record once at the very end — mid-implementation, outcome still reads
 * "awaiting_plan_approval" on disk.
 */
export function pipelineState(record: RunRecord | undefined, job: Job | undefined): PipelineState {
  if (job) {
    const index = job.kind === "plan" ? 0 : 2;
    return { stages: buildStages(index, "active"), note: jobNote(job) };
  }

  if (!record) {
    return { stages: buildStages(0, "pending"), note: "Not started yet." };
  }

  switch (record.outcome) {
    case "plan_failed":
      return { stages: buildStages(0, "blocked"), note: "Plan stage failed to complete." };
    case "plan_timeout":
      return { stages: buildStages(0, "blocked"), note: "Plan stage timed out." };
    case "plan_out_of_scope":
      return { stages: buildStages(0, "blocked"), note: "Agent judged this out of scope — needs a human spec." };
    case "awaiting_plan_approval":
      return { stages: buildStages(1, "active"), note: "Plan ready — waiting on your approve/reject decision." };
    case "plan_rejected":
      return { stages: buildStages(1, "blocked"), note: "Plan was rejected." };
    case "implementing":
      return { stages: buildStages(2, "active"), note: "Implementing the approved plan…" };
    case "no_changes":
      return { stages: buildStages(2, "neutral"), note: "Agent made no changes." };
    case "guardrail_blocked": {
      const duringPlan = record.filesChanged === 0 && record.diffLines === 0;
      return {
        stages: buildStages(duringPlan ? 0 : 2, "blocked"),
        note: duringPlan
          ? "Plan blocked by a guardrail before any code was touched."
          : "Implementation blocked by a guardrail.",
      };
    }
    case "tests_failed":
      return { stages: buildStages(2, "blocked"), note: "rspec failed." };
    case "ready_for_review":
      if (record.merged === true) return { stages: buildStages(3, "done"), note: "Merged." };
      if (record.merged === false) return { stages: buildStages(3, "blocked"), note: "Marked as not merged." };
      return { stages: buildStages(3, "active"), note: "Ready for your review." };
    default: {
      const reachedImplement = record.diffLines > 0 || record.filesChanged > 0;
      return {
        stages: buildStages(reachedImplement ? 2 : 0, "blocked"),
        note: reachedImplement ? "Something went wrong during implementation." : "Something went wrong during the plan stage.",
      };
    }
  }
}

export default function PipelineStage({ stages, note }: PipelineState) {
  return (
    <div className="stage-block">
      <div className="stage-stepper">
        <div className="stage-line" />
        {stages.map((s) => (
          <div key={s.key} className={`stage-step ${s.status}`}>
            <div className="stage-dot" />
            <div className="stage-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="stage-note">{note}</div>
    </div>
  );
}
