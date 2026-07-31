export type Lane = 1 | 2 | 3;

export interface TicketInput {
  key: string;
  summary: string;
  description: string;
  url?: string;
}

export type Outcome =
  | "plan_failed"
  | "plan_timeout"
  | "plan_out_of_scope"
  | "awaiting_plan_approval"
  | "plan_rejected"
  | "implementing"
  | "no_changes"
  | "guardrail_blocked"
  | "tests_failed"
  | "ready_for_review"
  | "error";

export interface RspecResult {
  ran: boolean;
  exitCode: number | null;
  timedOut: boolean;
  targets: string[];
  exampleCount: number | null;
  failureCount: number | null;
  pendingCount: number | null;
  durationSec: number | null;
}

export interface RunRecord {
  runId: string;
  ticket: string;
  ticketUrl: string | null;
  engine: string;
  lane: Lane | null;
  outcome: Outcome;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  branch: string;
  worktreePath: string | null;
  baseCommit: string | null;
  plannedFiles: string[];
  filesChanged: number;
  diffLines: number;
  addedTestFiles: number;
  violations: string[];
  blockedBy: string[];
  rspec: RspecResult | null;
  humanEditedLines: number | null;
  reviewRounds: number | null;
  merged: boolean | null;
  notes: string | null;
}

export type JobKind = "plan" | "implement";
export type JobState = "queued" | "running" | "done" | "failed";

export interface Job {
  id: string;
  kind: JobKind;
  ticket: string;
  runId: string | null;
  state: JobState;
  step: string;
  detail: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export interface Metrics {
  total: number;
  readyForReview: number;
  attemptSuccessRate: number | null;
  autonomyRate: number | null;
  autonomyDenominator: number;
  medianDurationSec: number | null;
  byOutcome: Array<[string, number]>;
  byLane: Array<[string, number]>;
}

export interface Limits {
  maxFilesChanged: number;
  maxDiffLines: number;
  planTimeoutMs: number;
  implementTimeoutMs: number;
  rspecTimeoutMs: number;
  maxCiRetries: number;
}

export interface LaneRules {
  lane1Enabled: boolean;
  lane1MaxDiffLines: number;
  lane1RequiresNewTests: boolean;
  coveredPathPrefixes: string[];
}

export interface BlocklistEntry {
  pattern: string;
  reason: string;
}

export interface StateConfigSummary {
  engine: string;
  repoPath: string;
  baseBranch: string;
  limits: Limits;
  laneRules: LaneRules;
  blocklistCount: number;
}

export interface StateResponse {
  tickets: TicketInput[];
  runs: RunRecord[];
  jobs: Job[];
  metrics: Metrics;
  config: StateConfigSummary;
}

export interface LaneInfo {
  lane: Lane;
  label: string;
}

export interface ConfigResponse {
  limits: Limits;
  laneRules: LaneRules;
  blocklist: BlocklistEntry[];
  engine: string;
  lanes: LaneInfo[];
}

export interface RunDetailResponse {
  record: RunRecord;
  plan: string | null;
  diff: string | null;
  agentOutput: string | null;
  files: string | null;
  toolCalls: string | null;
}
