import { readIndex, readRun, saveReview } from "./record.js";
import {
  DEFAULT_RUN_OPTIONS,
  rejectPlan,
  runImplement,
  runPlan,
} from "./orchestrator.js";
import type { Config, RunRecord, TicketInput } from "./types.js";

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

export type Listener = (event: string, payload: unknown) => void;

/**
 * Antrean pekerjaan yang dijalankan SATU PER SATU.
 *
 * Bukan karena worktree-nya bentrok — itu sudah terpisah — tapi karena rspec
 * berebut satu database test yang sama. Dua run bersamaan akan saling merusak
 * data test dan menghasilkan merah palsu. Bisa diparalelkan nanti memakai
 * parallel_tests yang sudah ada di repo, tapi jangan sekarang.
 */
export class JobQueue {
  private readonly jobs: Job[] = [];
  private readonly listeners = new Set<Listener>();
  private processing = false;
  private counter = 0;

  constructor(
    private readonly config: Config,
    private readonly getTicket: (key: string) => TicketInput | null,
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: string, payload: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(event, payload);
      } catch {
        // Listener yang error tidak boleh menjatuhkan antrean.
      }
    }
  }

  list(): Job[] {
    return [...this.jobs];
  }

  activeCount(): number {
    return this.jobs.filter((j) => j.state === "running" || j.state === "queued").length;
  }

  enqueue(kind: JobKind, ticket: string, runId: string | null): Job {
    this.counter += 1;
    const job: Job = {
      id: `job-${String(this.counter)}`,
      kind,
      ticket,
      runId,
      state: "queued",
      step: "menunggu antrean",
      detail: null,
      queuedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      error: null,
    };
    this.jobs.push(job);
    this.emit("job", job);
    void this.drain();
    return job;
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      for (;;) {
        const job = this.jobs.find((j) => j.state === "queued");
        if (!job) break;
        await this.execute(job);
      }
    } finally {
      this.processing = false;
    }
  }

  private async execute(job: Job): Promise<void> {
    job.state = "running";
    job.startedAt = new Date().toISOString();
    job.step = "mulai";
    this.emit("job", job);

    const progress = (step: string, detail?: string): void => {
      job.step = step;
      job.detail = detail ?? null;
      this.emit("job", job);
    };

    try {
      const ticket = this.getTicket(job.ticket);
      if (ticket === null) {
        throw new Error(`Tiket ${job.ticket} tidak ada di antrean`);
      }

      let record: RunRecord;

      if (job.kind === "plan") {
        record = await runPlan(ticket, this.config, DEFAULT_RUN_OPTIONS, progress);
      } else {
        if (job.runId === null) throw new Error("runId wajib untuk tahap implementasi");
        const previous = readRun(this.config.runsRoot, job.ticket, job.runId);
        if (previous === null) {
          throw new Error(`Percobaan ${job.ticket}/${job.runId} tidak ditemukan`);
        }
        record = await runImplement(
          ticket,
          this.config,
          previous,
          DEFAULT_RUN_OPTIONS,
          progress,
        );
      }

      job.runId = record.runId;
      job.state = "done";
      job.step = record.outcome;
      job.finishedAt = new Date().toISOString();
      this.emit("job", job);
      this.emit("run", record);
    } catch (err) {
      job.state = "failed";
      job.step = "gagal";
      job.error = (err as Error).message;
      job.finishedAt = new Date().toISOString();
      this.emit("job", job);
    }
  }

  // -- aksi yang tidak perlu masuk antrean karena instan -------------------

  async reject(ticket: string, runId: string, reason: string): Promise<RunRecord> {
    const previous = readRun(this.config.runsRoot, ticket, runId);
    if (previous === null) throw new Error("Percobaan tidak ditemukan");
    const record = await rejectPlan(this.config, previous, reason);
    this.emit("run", record);
    return record;
  }

  saveReview(
    ticket: string,
    runId: string,
    review: {
      humanEditedLines: number | null;
      reviewRounds: number | null;
      merged: boolean | null;
      notes: string | null;
    },
  ): RunRecord {
    const previous = readRun(this.config.runsRoot, ticket, runId);
    if (previous === null) throw new Error("Percobaan tidak ditemukan");

    const record: RunRecord = {
      ...previous,
      humanEditedLines: review.humanEditedLines,
      reviewRounds: review.reviewRounds,
      merged: review.merged,
      notes: review.notes ?? previous.notes,
    };

    saveReview(this.config.runsRoot, record);
    this.emit("run", record);
    return record;
  }

  runs(): RunRecord[] {
    return readIndex(this.config.runsRoot);
  }
}
