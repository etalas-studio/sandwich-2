import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type RunArtifactKind =
  | "judge_prompt"
  | "judge_transcript"
  | "implement_transcript"
  | "diff_patch"
  | "verify_output";

export interface RunArtifact {
  id: string;
  runId: string;
  kind: RunArtifactKind;
  content: string;
  createdAt: string;
}

export interface NewRunArtifact {
  runId: string;
  kind: RunArtifactKind;
  content: string;
}

/**
 * Large, opaque per-run text blobs (transcripts, diffs, raw test output).
 * Split from `runs` because they're write-once and never queried, only
 * displayed — see docs/superpowers/specs/2026-08-03-pipeline-shape-design.md
 * "Artifacts".
 */
export function insertRunArtifact(db: Database.Database, input: NewRunArtifact): RunArtifact {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO run_artifacts (id, run_id, kind, content, created_at)
     VALUES (@id, @runId, @kind, @content, @createdAt)`,
  ).run({ id, runId: input.runId, kind: input.kind, content: input.content, createdAt });
  return { id, runId: input.runId, kind: input.kind, content: input.content, createdAt };
}

/**
 * Insert-or-update a single evolving artifact (currently: the in-progress
 * implement transcript) so the UI can show real progress while a stage is
 * still running, instead of only after `insertRunArtifact` writes the final
 * content once the stage resolves. One row per (run_id, kind) — later calls
 * with the same pair replace the content in place rather than adding rows.
 */
export function upsertLiveArtifact(db: Database.Database, input: NewRunArtifact): RunArtifact {
  const existing = db
    .prepare("SELECT id FROM run_artifacts WHERE run_id = ? AND kind = ?")
    .get(input.runId, input.kind) as { id: string } | undefined;

  if (existing) {
    db.prepare("UPDATE run_artifacts SET content = ? WHERE id = ?").run(input.content, existing.id);
    const row = db.prepare("SELECT * FROM run_artifacts WHERE id = ?").get(existing.id) as RawRow;
    return mapRow(row);
  }

  return insertRunArtifact(db, input);
}

export function listArtifactsForRun(db: Database.Database, runId: string): RunArtifact[] {
  const rows = db
    .prepare("SELECT * FROM run_artifacts WHERE run_id = ? ORDER BY created_at")
    .all(runId) as RawRow[];
  return rows.map(mapRow);
}

interface RawRow {
  id: string;
  run_id: string;
  kind: string;
  content: string;
  created_at: string;
}

function mapRow(row: RawRow): RunArtifact {
  return {
    id: row.id,
    runId: row.run_id,
    kind: row.kind as RunArtifactKind,
    content: row.content,
    createdAt: row.created_at,
  };
}
