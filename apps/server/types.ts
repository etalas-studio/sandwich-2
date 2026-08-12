/** Jalur gerbang. Ditentukan dari diff, bukan dari tiket. */
export type Lane = 1 | 2 | 3;

export interface TicketInput {
  key: string;
  summary: string;
  description: string;
  url?: string;
}

export interface Limits {
  maxFilesChanged: number;
  maxDiffLines: number;
  planTimeoutMs: number;
  implementTimeoutMs: number;
  rspecTimeoutMs: number;
  maxCiRetries: number;
}

/**
 * Command dibuat sebagai template supaya ganti engine (Claude Code -> Pi, atau
 * subscription -> Bedrock) cukup ubah config, tanpa sentuh kode.
 * Placeholder yang didukung: {{prompt}} {{allowedTools}} {{outFile}} {{targets}}
 */
export interface CommandTemplate {
  bin: string;
  args: string[];
}

export interface EngineConfig {
  name: string;
  planAllowedTools: string;
  implementAllowedTools: string;
  plan: CommandTemplate;
  implement: CommandTemplate;
}

export interface LaneRules {
  /** Jalur 1 (tanpa review sebelum merge) sengaja mati sampai ada data. */
  lane1Enabled: boolean;
  lane1MaxDiffLines: number;
  lane1RequiresNewTests: boolean;
  /** Area yang tesnya dianggap cukup untuk dipercaya. */
  coveredPathPrefixes: string[];
}

export interface BlocklistEntry {
  pattern: string;
  reason: string;
}

export interface Config {
  repoPath: string;
  worktreeRoot: string;
  runsRoot: string;
  baseBranch: string;
  branchPrefix: string;
  limits: Limits;
  engine: EngineConfig;
  rspecCommand: CommandTemplate;
  laneRules: LaneRules;
  blocklist: BlocklistEntry[];
}

export interface DiffStat {
  file: string;
  added: number;
  removed: number;
}

export interface DiffSummary {
  stats: DiffStat[];
  filesChanged: number;
  diffLines: number;
  /** File spec baru yang ditambahkan agent. */
  addedTestFiles: string[];
  patch: string;
}

export interface BlocklistHit {
  file: string;
  pattern: string;
  reason: string;
}

export interface GuardrailVerdict {
  ok: boolean;
  violations: string[];
  blocklistHits: BlocklistHit[];
}

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

export type Outcome =
  | "plan_failed"
  | "plan_timeout"
  | "plan_out_of_scope"
  /** Rencana siap, berhenti menunggu manusia. Worktree dibiarkan hidup. */
  | "awaiting_plan_approval"
  | "plan_rejected"
  | "implementing"
  | "no_changes"
  | "guardrail_blocked"
  | "tests_failed"
  | "ready_for_review"
  | "error";

/** Outcome yang berarti percobaan masih bisa dilanjutkan. */
export const RESUMABLE_OUTCOMES: Outcome[] = ["awaiting_plan_approval"];

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
  /** Disimpan supaya tahap implementasi bisa melanjutkan worktree yang sama. */
  worktreePath: string | null;
  baseCommit: string | null;
  /** Ringkasan rencana untuk ditampilkan di UI tanpa membuka file. */
  plannedFiles: string[];
  filesChanged: number;
  diffLines: number;
  addedTestFiles: number;
  violations: string[];
  blockedBy: string[];
  rspec: RspecResult | null;
  /** Diisi manusia setelah review. Ini sumber metrik autonomy rate. */
  humanEditedLines: number | null;
  reviewRounds: number | null;
  merged: boolean | null;
  notes: string | null;
}

export interface PhaseResult {
  exitCode: number | null;
  timedOut: boolean;
  transcript: string[];
  stderr: string;
  durationSec: number;
}
