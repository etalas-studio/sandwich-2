import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type BlocklistSource = "agent" | "human";

export interface BlocklistEntry {
  id: string;
  pattern: string;
  reason: string;
  source: BlocklistSource;
  proposedByScanId: string | null;
  createdAt: string;
}

export interface NewBlocklistEntry {
  pattern: string;
  reason: string;
  source: BlocklistSource;
  proposedByScanId?: string | null;
}

/** Current mutable blocklist state — agent proposes via a scan, human adds/removes. */
export function insertBlocklistEntry(
  db: Database.Database,
  input: NewBlocklistEntry,
): BlocklistEntry {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO blocklist_entries (id, pattern, reason, source, proposed_by_scan_id, created_at)
     VALUES (@id, @pattern, @reason, @source, @proposedByScanId, @createdAt)`,
  ).run({
    id,
    pattern: input.pattern,
    reason: input.reason,
    source: input.source,
    proposedByScanId: input.proposedByScanId ?? null,
    createdAt,
  });
  return getBlocklistEntryById(db, id)!;
}

export function getBlocklistEntryById(db: Database.Database, id: string): BlocklistEntry | null {
  const row = db.prepare("SELECT * FROM blocklist_entries WHERE id = ?").get(id) as
    | RawRow
    | undefined;
  return row ? mapRow(row) : null;
}

export function listBlocklistEntries(db: Database.Database): BlocklistEntry[] {
  const rows = db
    .prepare("SELECT * FROM blocklist_entries ORDER BY created_at")
    .all() as RawRow[];
  return rows.map(mapRow);
}

export function deleteBlocklistEntry(db: Database.Database, id: string): void {
  db.prepare("DELETE FROM blocklist_entries WHERE id = ?").run(id);
}

interface RawRow {
  id: string;
  pattern: string;
  reason: string;
  source: string;
  proposed_by_scan_id: string | null;
  created_at: string;
}

function mapRow(row: RawRow): BlocklistEntry {
  return {
    id: row.id,
    pattern: row.pattern,
    reason: row.reason,
    source: row.source as BlocklistSource,
    proposedByScanId: row.proposed_by_scan_id,
    createdAt: row.created_at,
  };
}
