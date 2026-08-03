import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type ReadinessScanStatus = "running" | "completed" | "failed";

export interface AreaSignal {
  pathPrefix: string;
  testToCodeRatio: number;
  churnScore: number;
}

export type RecommendationSeverity = "high" | "medium" | "low";

export interface ReadinessRecommendation {
  id: string;
  severity: RecommendationSeverity;
  message: string;
}

export interface ReadinessScan {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  techStack: string | null;
  testCommand: string | null;
  areaSignals: AreaSignal[] | null;
  recommendations: ReadinessRecommendation[] | null;
  /** Agent-written 2-3 sentence description of what the codebase actually is/does. */
  codebaseSummary: string | null;
  /** Agent-written assessment of whether the repo already has an established, agent-friendly workflow (docs, conventions, CI, testing discipline) or lacks one. */
  agenticFlowSummary: string | null;
  status: ReadinessScanStatus;
}

/**
 * area_signals/recommendations are stored as JSON blobs per scan rather
 * than normalized child tables — the product spec doesn't call for
 * querying signal trends across scans, so a table with no relational query
 * against it yet would be normalization nobody uses.
 */
export function startReadinessScan(db: Database.Database, startedAt: string): ReadinessScan {
  const id = randomUUID();
  db.prepare(`INSERT INTO readiness_scans (id, started_at, status) VALUES (?, ?, 'running')`).run(
    id,
    startedAt,
  );
  return getReadinessScanById(db, id)!;
}

export interface CompleteReadinessScanInput {
  finishedAt: string;
  techStack: string | null;
  testCommand: string | null;
  areaSignals: AreaSignal[] | null;
  recommendations: ReadinessRecommendation[] | null;
  codebaseSummary: string | null;
  agenticFlowSummary: string | null;
  status: "completed" | "failed";
}

export function completeReadinessScan(
  db: Database.Database,
  id: string,
  input: CompleteReadinessScanInput,
): ReadinessScan {
  if (!getReadinessScanById(db, id)) {
    throw new Error(`No readiness scan found with id ${id}`);
  }

  db.prepare(
    `UPDATE readiness_scans SET
       finished_at = @finishedAt,
       tech_stack = @techStack,
       test_command = @testCommand,
       area_signals = @areaSignals,
       recommendations = @recommendations,
       codebase_summary = @codebaseSummary,
       agentic_flow_summary = @agenticFlowSummary,
       status = @status
     WHERE id = @id`,
  ).run({
    id,
    finishedAt: input.finishedAt,
    techStack: input.techStack,
    testCommand: input.testCommand,
    areaSignals: input.areaSignals ? JSON.stringify(input.areaSignals) : null,
    recommendations: input.recommendations ? JSON.stringify(input.recommendations) : null,
    codebaseSummary: input.codebaseSummary,
    agenticFlowSummary: input.agenticFlowSummary,
    status: input.status,
  });
  return getReadinessScanById(db, id)!;
}

export function getReadinessScanById(db: Database.Database, id: string): ReadinessScan | null {
  const row = db.prepare("SELECT * FROM readiness_scans WHERE id = ?").get(id) as
    | RawRow
    | undefined;
  return row ? mapRow(row) : null;
}

export function getLatestReadinessScan(db: Database.Database): ReadinessScan | null {
  const row = db
    .prepare("SELECT * FROM readiness_scans ORDER BY started_at DESC LIMIT 1")
    .get() as RawRow | undefined;
  return row ? mapRow(row) : null;
}

interface RawRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  tech_stack: string | null;
  test_command: string | null;
  area_signals: string | null;
  recommendations: string | null;
  codebase_summary: string | null;
  agentic_flow_summary: string | null;
  status: string;
}

function mapRow(row: RawRow): ReadinessScan {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    techStack: row.tech_stack,
    testCommand: row.test_command,
    areaSignals: row.area_signals ? (JSON.parse(row.area_signals) as AreaSignal[]) : null,
    recommendations: row.recommendations
      ? (JSON.parse(row.recommendations) as ReadinessRecommendation[])
      : null,
    codebaseSummary: row.codebase_summary,
    agenticFlowSummary: row.agentic_flow_summary,
    status: row.status as ReadinessScanStatus,
  };
}
