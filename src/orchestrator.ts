import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { countToolCalls, extractFinalText, runAgentPhase } from "./agent.js";
import { checkGuardrails, classifyLane, matchBlocklist } from "./guardrails.js";
import {
  assertCleanRepo,
  commitAll,
  createWorktree,
  removeWorktree,
  summarizeDiff,
} from "./git.js";
import {
  buildImplementPrompt,
  buildPlanPrompt,
  parsePlannedFiles,
  parseVerdict,
} from "./prompts.js";
import { deriveSpecTargets, runRspec } from "./rspec.js";
import { runDir, runStamp, writeRun } from "./record.js";
import type { RunArtifacts } from "./record.js";
import type {
  Config,
  DiffSummary,
  Outcome,
  RunRecord,
  RspecResult,
  TicketInput,
} from "./types.js";

export interface RunOptions {
  /** Simpan worktree walau percobaan gagal, untuk diperiksa manual. */
  keepOnFailure: boolean;
  /** Jangan panggil agent atau rspec. Untuk memeriksa alur dan config. */
  dryRun: boolean;
}

export const DEFAULT_RUN_OPTIONS: RunOptions = {
  keepOnFailure: true,
  dryRun: false,
};

export type Progress = (step: string, detail?: string) => void;

const noop: Progress = () => undefined;

interface RecordDraft {
  runId: string;
  ticket: TicketInput;
  startedAt: Date;
  branch: string;
  worktreePath: string | null;
  baseCommit: string | null;
  plannedFiles: string[];
  lane: RunRecord["lane"];
  outcome: Outcome;
  violations: string[];
  blockedBy: string[];
  diff: DiffSummary | null;
  rspec: RspecResult | null;
  notes: string | null;
}

function buildRecord(draft: RecordDraft, config: Config): RunRecord {
  const finishedAt = new Date();
  return {
    runId: draft.runId,
    ticket: draft.ticket.key,
    ticketUrl: draft.ticket.url ?? null,
    engine: config.engine.name,
    lane: draft.lane,
    outcome: draft.outcome,
    startedAt: draft.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationSec: (finishedAt.getTime() - draft.startedAt.getTime()) / 1000,
    branch: draft.branch,
    worktreePath: draft.worktreePath,
    baseCommit: draft.baseCommit,
    plannedFiles: draft.plannedFiles,
    filesChanged: draft.diff?.filesChanged ?? 0,
    diffLines: draft.diff?.diffLines ?? 0,
    addedTestFiles: draft.diff?.addedTestFiles.length ?? 0,
    violations: draft.violations,
    blockedBy: draft.blockedBy,
    rspec: draft.rspec,
    humanEditedLines: null,
    reviewRounds: null,
    merged: null,
    notes: draft.notes,
  };
}

// ---------------------------------------------------------------------------
// Tahap 1 — rencana. Berhenti di sini menunggu manusia.
// ---------------------------------------------------------------------------

export async function runPlan(
  ticket: TicketInput,
  config: Config,
  options: RunOptions = DEFAULT_RUN_OPTIONS,
  onProgress: Progress = noop,
): Promise<RunRecord> {
  const startedAt = new Date();
  const stamp = runStamp(startedAt);

  const draft: RecordDraft = {
    runId: stamp,
    ticket,
    startedAt,
    branch: `${config.branchPrefix}${ticket.key}-${stamp.slice(0, 16)}`,
    worktreePath: null,
    baseCommit: null,
    plannedFiles: [],
    lane: null,
    outcome: "error",
    violations: [],
    blockedBy: [],
    diff: null,
    rspec: null,
    notes: null,
  };

  const artifacts: RunArtifacts = {};

  const done = (): RunRecord => {
    const record = buildRecord(draft, config);
    writeRun(config.runsRoot, record, artifacts);
    onProgress("selesai", record.outcome);
    return record;
  };

  try {
    artifacts.planPrompt = buildPlanPrompt(ticket, config);

    if (options.dryRun) {
      draft.outcome = "no_changes";
      draft.notes = "dry run — agent dan rspec tidak dijalankan";
      return done();
    }

    onProgress("memeriksa repo");
    await assertCleanRepo(config.repoPath);

    onProgress("membuat ruang kerja terpisah");
    const worktree = await createWorktree(
      config.repoPath,
      config.worktreeRoot,
      draft.branch,
      config.baseBranch,
    );
    draft.worktreePath = worktree.path;
    draft.baseCommit = worktree.baseCommit;

    onProgress("menyusun rencana", "agent hanya punya izin baca");
    const phase = await runAgentPhase({
      template: config.engine.plan,
      prompt: artifacts.planPrompt,
      allowedTools: config.engine.planAllowedTools,
      cwd: worktree.path,
      timeoutMs: config.limits.planTimeoutMs,
    });

    artifacts.planTranscript = phase.transcript;
    artifacts.stderr = phase.stderr;
    artifacts.toolCalls = countToolCalls(phase.transcript);

    if (phase.timedOut) {
      draft.outcome = "plan_timeout";
      draft.notes = `tahap rencana melebihi ${String(config.limits.planTimeoutMs / 1000)} detik`;
      return done();
    }

    if (phase.exitCode !== 0) {
      draft.outcome = "plan_failed";
      draft.notes = `agent keluar dengan kode ${String(phase.exitCode)}`;
      return done();
    }

    const plan = extractFinalText(phase.transcript);
    artifacts.plan = plan;

    const verdict = parseVerdict(plan);
    if (verdict === "OUT_OF_SCOPE" || verdict === "NEEDS_SPEC") {
      draft.outcome = "plan_out_of_scope";
      draft.notes = `agent menilai tiket ini ${verdict} — perlu manusia, bukan retry`;
      return done();
    }

    // Gerbang termurah: periksa rencana sebelum satu baris kode disentuh.
    onProgress("memeriksa rencana terhadap daftar cegat");
    draft.plannedFiles = parsePlannedFiles(plan);

    const plannedHits = matchBlocklist(draft.plannedFiles, config.blocklist);
    if (plannedHits.length > 0) {
      draft.outcome = "guardrail_blocked";
      draft.lane = 3;
      draft.blockedBy = plannedHits.map((h) => `${h.file} (${h.reason})`);
      draft.notes = "rencana menyentuh daftar cegat — dihentikan sebelum menulis kode";
      return done();
    }

    if (draft.plannedFiles.length > config.limits.maxFilesChanged) {
      draft.outcome = "guardrail_blocked";
      draft.violations = [
        `rencana menyebut ${String(draft.plannedFiles.length)} file, batas ${String(config.limits.maxFilesChanged)}`,
      ];
      draft.notes = "scope rencana terlalu luas — perlu dipecah jadi beberapa tiket";
      return done();
    }

    draft.outcome = "awaiting_plan_approval";
    draft.notes = "rencana siap dibaca manusia";
    return done();
  } catch (err) {
    draft.outcome = "error";
    draft.notes = (err as Error).message;
    return done();
  }
}

// ---------------------------------------------------------------------------
// Tahap 2 — implementasi. Melanjutkan worktree dan rencana dari tahap 1.
// ---------------------------------------------------------------------------

export async function runImplement(
  ticket: TicketInput,
  config: Config,
  previous: RunRecord,
  options: RunOptions = DEFAULT_RUN_OPTIONS,
  onProgress: Progress = noop,
): Promise<RunRecord> {
  const startedAt = new Date(previous.startedAt);

  const draft: RecordDraft = {
    runId: previous.runId,
    ticket,
    startedAt,
    branch: previous.branch,
    worktreePath: previous.worktreePath,
    baseCommit: previous.baseCommit,
    plannedFiles: previous.plannedFiles,
    lane: null,
    outcome: "error",
    violations: [],
    blockedBy: [],
    diff: null,
    rspec: null,
    notes: null,
  };

  const artifacts: RunArtifacts = {};

  const done = (): RunRecord => {
    const record = buildRecord(draft, config);
    writeRun(config.runsRoot, record, artifacts);

    if (draft.worktreePath !== null) {
      const keep = record.outcome === "ready_for_review" || options.keepOnFailure;
      if (!keep) {
        void removeWorktree(
          config.repoPath,
          draft.worktreePath,
          draft.branch,
          false,
        ).catch(() => undefined);
      }
    }

    onProgress("selesai", record.outcome);
    return record;
  };

  try {
    if (previous.outcome !== "awaiting_plan_approval") {
      draft.outcome = "error";
      draft.notes = `percobaan ini tidak sedang menunggu approval (status: ${previous.outcome})`;
      return done();
    }

    const worktreePath = previous.worktreePath;
    if (worktreePath === null || !existsSync(worktreePath)) {
      draft.outcome = "error";
      draft.notes = `ruang kerja sudah tidak ada: ${worktreePath ?? "null"}. Jalankan ulang dari tahap rencana.`;
      return done();
    }

    const baseCommit = previous.baseCommit;
    if (baseCommit === null) {
      draft.outcome = "error";
      draft.notes = "commit dasar tidak tercatat — jalankan ulang dari tahap rencana";
      return done();
    }

    const planPath = join(
      runDir(config.runsRoot, previous.ticket, previous.runId),
      "plan.md",
    );
    if (!existsSync(planPath)) {
      draft.outcome = "error";
      draft.notes = `rencana tidak ditemukan: ${planPath}`;
      return done();
    }
    const plan = readFileSync(planPath, "utf8");

    onProgress("mengerjakan", "izin menulis dibuka");
    const phase = await runAgentPhase({
      template: config.engine.implement,
      prompt: buildImplementPrompt(ticket, plan, config),
      allowedTools: config.engine.implementAllowedTools,
      cwd: worktreePath,
      timeoutMs: config.limits.implementTimeoutMs,
    });

    artifacts.implementTranscript = phase.transcript;
    artifacts.implementOutput = extractFinalText(phase.transcript);
    artifacts.toolCalls = countToolCalls(phase.transcript);
    artifacts.stderr = phase.stderr;

    if (phase.timedOut) {
      draft.outcome = "guardrail_blocked";
      draft.violations = [
        `tahap implementasi melebihi ${String(config.limits.implementTimeoutMs / 1000)} detik`,
      ];
      return done();
    }

    onProgress("mengukur perubahan");
    draft.diff = await summarizeDiff(worktreePath, baseCommit);
    artifacts.diff = draft.diff;

    if (draft.diff.filesChanged === 0) {
      draft.outcome = "no_changes";
      draft.notes = "agent tidak mengubah file apa pun";
      return done();
    }

    const guard = checkGuardrails(draft.diff, config);
    draft.violations = guard.violations;
    draft.blockedBy = guard.blocklistHits.map((h) => `${h.file} (${h.reason})`);

    if (!guard.ok) {
      draft.outcome = "guardrail_blocked";
      draft.lane = 3;
      draft.notes = "diff melewati batas aman — tidak di-commit, tidak di-push";
      return done();
    }

    onProgress("menjalankan spec yang relevan");
    const targets = deriveSpecTargets(draft.diff, worktreePath);
    draft.rspec = await runRspec({
      template: config.rspecCommand,
      worktreePath,
      targets,
      timeoutMs: config.limits.rspecTimeoutMs,
    });

    draft.lane = classifyLane(draft.diff, guard.blocklistHits, draft.rspec, config);

    if (draft.rspec.ran && (draft.rspec.timedOut || draft.rspec.exitCode !== 0)) {
      draft.outcome = "tests_failed";
      draft.notes = draft.rspec.timedOut ? "rspec timeout" : "ada spec yang merah";
      return done();
    }

    if (!draft.rspec.ran) {
      draft.notes =
        "tidak ada spec yang cocok dengan file yang diubah — CI penuh di Bitbucket jadi gerbang satu-satunya";
    }

    onProgress("commit ke branch");
    await commitAll(
      worktreePath,
      `[${ticket.key}] ${ticket.summary}\n\nDikerjakan agent (${config.engine.name}). Perlu review manusia.`,
    );

    draft.outcome = "ready_for_review";
    return done();
  } catch (err) {
    draft.outcome = "error";
    draft.notes = (err as Error).message;
    return done();
  }
}

/** Tolak rencana. Worktree dibuang, branch dihapus. */
export async function rejectPlan(
  config: Config,
  previous: RunRecord,
  reason: string,
): Promise<RunRecord> {
  const record: RunRecord = {
    ...previous,
    outcome: "plan_rejected",
    finishedAt: new Date().toISOString(),
    notes: reason.trim().length > 0 ? reason : "rencana ditolak manusia",
  };

  writeRun(config.runsRoot, record, {});

  if (previous.worktreePath !== null && existsSync(previous.worktreePath)) {
    await removeWorktree(
      config.repoPath,
      previous.worktreePath,
      previous.branch,
      false,
    ).catch(() => undefined);
  }

  return record;
}

// ---------------------------------------------------------------------------
// Jalur CLI: rencana lalu langsung implementasi tanpa jeda manusia.
// ---------------------------------------------------------------------------

export interface RunTicketOptions extends RunOptions {
  /** Berhenti setelah rencana. Dipakai CLI --plan-only dan alur UI. */
  planOnly: boolean;
}

export async function runTicket(
  ticket: TicketInput,
  config: Config,
  options: RunTicketOptions,
  onProgress: Progress = noop,
): Promise<RunRecord> {
  const planned = await runPlan(ticket, config, options, onProgress);

  if (options.planOnly) return planned;
  if (planned.outcome !== "awaiting_plan_approval") return planned;

  return runImplement(ticket, config, planned, options, onProgress);
}
