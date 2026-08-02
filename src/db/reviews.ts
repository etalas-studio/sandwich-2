import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Review {
  id: string;
  runId: string;
  mergeOutcome: string;
  editEffort: string;
  reviewRounds: number;
  reviewedAt: string;
}

export interface NewReview {
  runId: string;
  mergeOutcome: string;
  editEffort: string;
  reviewRounds: number;
  reviewedAt: string;
}

/**
 * Split from `runs` because it's filled in later by a human reviewing the
 * PR, independently of the run's own lifecycle. `run_id` is UNIQUE in the
 * schema — phase 1 captures exactly one review per run.
 */
export function insertReview(db: Database.Database, input: NewReview): Review {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO reviews (id, run_id, merge_outcome, edit_effort, review_rounds, reviewed_at)
     VALUES (@id, @runId, @mergeOutcome, @editEffort, @reviewRounds, @reviewedAt)`,
  ).run({ id, ...input });
  return getReviewForRun(db, input.runId)!;
}

export function getReviewForRun(db: Database.Database, runId: string): Review | null {
  const row = db.prepare("SELECT * FROM reviews WHERE run_id = ?").get(runId) as
    | RawReviewRow
    | undefined;
  return row ? mapRow(row) : null;
}

interface RawReviewRow {
  id: string;
  run_id: string;
  merge_outcome: string;
  edit_effort: string;
  review_rounds: number;
  reviewed_at: string;
}

function mapRow(row: RawReviewRow): Review {
  return {
    id: row.id,
    runId: row.run_id,
    mergeOutcome: row.merge_outcome,
    editEffort: row.edit_effort,
    reviewRounds: row.review_rounds,
    reviewedAt: row.reviewed_at,
  };
}
