import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface BlocklistEntry {
  id: string;
  pattern: string;
  reason: string;
  source: "human" | "agent";
  proposedByScanId: string | null;
  createdAt: string;
}

export interface BlocklistInsert {
  pattern: string;
  reason: string;
  source: "human" | "agent";
  proposedByScanId: string | null;
}

export function insertBlocklistEntry(
  db: Database.Database,
  input: BlocklistInsert,
): BlocklistEntry {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO blocklist (id, pattern, reason, source, proposed_by_scan_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.pattern, input.reason, input.source, input.proposedByScanId, now);
  const row = db.prepare("SELECT * FROM blocklist WHERE id = ?").get(id) as RawRow;
  return toEntry(row);
}

export function getBlocklistEntries(db: Database.Database): BlocklistEntry[] {
  const rows = db.prepare("SELECT * FROM blocklist ORDER BY pattern").all() as RawRow[];
  return rows.map(toEntry);
}

export function deleteBlocklistEntry(db: Database.Database, id: string): void {
  db.prepare("DELETE FROM blocklist WHERE id = ?").run(id);
}

// ── internal ──

interface RawRow {
  id: string;
  pattern: string;
  reason: string;
  source: string;
  proposed_by_scan_id: string | null;
  created_at: string;
}

function toEntry(row: RawRow): BlocklistEntry {
  return {
    id: row.id,
    pattern: row.pattern,
    reason: row.reason,
    source: row.source as BlocklistEntry["source"],
    proposedByScanId: row.proposed_by_scan_id,
    createdAt: row.created_at,
  };
}
