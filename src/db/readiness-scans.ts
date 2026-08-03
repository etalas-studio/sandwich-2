import type Database from "better-sqlite3";

export interface ReadinessScan {
  id: string;
  status: "running" | "completed" | "failed" | "aborted";
  projectName: string | null;
  description: string | null;
  techStack: string | null;
  testCommand: string | null;
  areaSignals: AreaSignal[] | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AreaSignal {
  area: string;
  files: number;
  testFileCount: number;
  testToCodeRatio: number;
  churnScore: number;
  note: string;
}

export interface ScanResults {
  projectName: string | null;
  description: string | null;
  techStack: string | null;
  testCommand: string | null;
  areaSignals: AreaSignal[];
}

export function startReadinessScan(db: Database.Database, id: string): ReadinessScan {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO readiness_scans (id, status, started_at)
     VALUES (?, 'running', ?)`,
  ).run(id, now);
  return mapRow(db, id)!;
}

export function completeReadinessScan(
  db: Database.Database,
  id: string,
  results: ScanResults,
): ReadinessScan {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE readiness_scans
     SET status = 'completed',
         project_name = ?,
         project_description = ?,
         tech_stack = ?,
         test_command = ?,
         area_signals = ?,
         completed_at = ?
     WHERE id = ?`,
  ).run(
    results.projectName,
    results.description,
    results.techStack,
    results.testCommand,
    JSON.stringify(results.areaSignals),
    now,
    id,
  );
  return mapRow(db, id)!;
}

export function abortReadinessScan(db: Database.Database, id: string): ReadinessScan {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE readiness_scans
     SET status = 'aborted', completed_at = ?
     WHERE id = ?`,
  ).run(now, id);
  return mapRow(db, id)!;
}

export function failReadinessScan(db: Database.Database, id: string): ReadinessScan {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE readiness_scans
     SET status = 'failed', completed_at = ?
     WHERE id = ?`,
  ).run(now, id);
  return mapRow(db, id)!;
}

export function getLatestReadinessScan(db: Database.Database): ReadinessScan | null {
  const row = db
    .prepare(
      `SELECT * FROM readiness_scans
       ORDER BY started_at DESC, id DESC
       LIMIT 1`,
    )
    .get() as RawRow | undefined;
  return row ? toScan(row) : null;
}

// ── internal ──

interface RawRow {
  id: string;
  status: string;
  project_name: string | null;
  project_description: string | null;
  tech_stack: string | null;
  test_command: string | null;
  area_signals: string | null;
  started_at: string;
  completed_at: string | null;
}

function mapRow(db: Database.Database, id: string): ReadinessScan | null {
  const row = db.prepare("SELECT * FROM readiness_scans WHERE id = ?").get(id) as
    | RawRow
    | undefined;
  return row ? toScan(row) : null;
}

function toScan(row: RawRow): ReadinessScan {
  let areaSignals: AreaSignal[] | null = null;
  if (row.area_signals) {
    try {
      areaSignals = JSON.parse(row.area_signals) as AreaSignal[];
    } catch {
      areaSignals = null;
    }
  }
  return {
    id: row.id,
    status: row.status as ReadinessScan["status"],
    projectName: row.project_name,
    description: row.project_description,
    techStack: row.tech_stack,
    testCommand: row.test_command,
    areaSignals,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}
