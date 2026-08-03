import { openDb } from "./db/connection.js";
import { upsertTicket } from "./db/tickets.js";
import { insertRun, updateRun } from "./db/runs.js";

/**
 * Dev-only helper to populate tickets + a spread of run states, since
 * formal ticket intake doesn't exist yet. Not wired into any runtime
 * path — run manually with `node dist/seed-demo-data.js` while iterating
 * on ticket-facing UI. The outcome strings used here ("running",
 * "agent_ready", "changes_committed", "needs_human", "ready_for_pr") are
 * the real, finalized vocabulary the pipeline actually produces (see
 * src/pipeline/types.ts and src/pipeline/run.ts) — not placeholders — so
 * seeded rows render exactly like real runs do in the web UI.
 *
 * `prUrl`/`prSummary` on the ready_for_pr row are valid `Run` fields the
 * current pipeline never sets (Open PR is out of scope for now); they're
 * seeded purely so the "PR opened" UI has something to show.
 */
const dbPath = process.env.DB_PATH ?? "data/instance.sqlite";
const db = openDb(dbPath);

function seedTicket(input: {
  key: string;
  summary: string;
  description: string;
  url?: string | null;
}): void {
  upsertTicket(db, input);
}

seedTicket({
  key: "PROJ-101",
  summary: "Fix typo in onboarding email subject line",
  description: "The subject line reads 'Welcome to Runchise!!' with a double exclamation mark.",
  url: "https://example.atlassian.net/browse/PROJ-101",
});

seedTicket({
  key: "PROJ-102",
  summary: "Add loading spinner to the settings save button",
  description: "Clicking Save gives no feedback until the request resolves, looks broken on slow networks.",
  url: "https://example.atlassian.net/browse/PROJ-102",
});
{
  const run = insertRun(db, {
    ticketKey: "PROJ-102",
    engine: "claude-code-headless",
    outcome: "running",
    startedAt: "2026-08-03T09:00:00.000Z",
  });
  updateRun(db, run.id, { outcome: "agent_ready", branch: "agent/proj-102" });
}

seedTicket({
  key: "PROJ-106",
  summary: "Add rate-limit tests for the /api/login endpoint",
  description: "PROJ-103 added rate limiting but there's no test coverage for it yet.",
  url: null,
});
{
  const run = insertRun(db, {
    ticketKey: "PROJ-106",
    engine: "claude-code-headless",
    outcome: "running",
    startedAt: "2026-08-03T08:00:00.000Z",
  });
  updateRun(db, run.id, {
    outcome: "changes_committed",
    branch: "agent/proj-106",
  });
}

seedTicket({
  key: "PROJ-103",
  summary: "Rate limit the /api/login endpoint",
  description: "No rate limiting currently exists on login attempts.",
  url: null,
});
{
  const run = insertRun(db, {
    ticketKey: "PROJ-103",
    engine: "claude-code-headless",
    outcome: "running",
    startedAt: "2026-08-02T14:00:00.000Z",
  });
  updateRun(db, run.id, {
    outcome: "needs_human",
    needsHumanCategory: "forbidden_path_or_action",
    needsHumanReason: "Touches src/auth/middleware.ts, which the blocklist marks as never-touch.",
    finishedAt: "2026-08-02T14:03:00.000Z",
  });
}

seedTicket({
  key: "PROJ-104",
  summary: "Migrate legacy date parsing to date-fns",
  description: "Several files still use hand-rolled date parsing that mishandles timezones.",
  url: "https://example.atlassian.net/browse/PROJ-104",
});
{
  const run = insertRun(db, {
    ticketKey: "PROJ-104",
    engine: "claude-code-headless",
    outcome: "running",
    startedAt: "2026-08-02T11:00:00.000Z",
  });
  updateRun(db, run.id, {
    outcome: "needs_human",
    needsHumanCategory: "weak_verification",
    needsHumanReason: "No tests exist for src/legacy/date-parser.js; a passing exit code wouldn't mean much here.",
    finishedAt: "2026-08-02T11:02:00.000Z",
  });
}

seedTicket({
  key: "PROJ-105",
  summary: "Update README badge links",
  description: "CI badge points at the old repo slug after the rename.",
  url: null,
});
{
  const run = insertRun(db, {
    ticketKey: "PROJ-105",
    engine: "claude-code-headless",
    outcome: "running",
    startedAt: "2026-08-01T10:00:00.000Z",
  });
  updateRun(db, run.id, {
    outcome: "ready_for_pr",
    branch: "agent/proj-105",
    prUrl: "https://github.com/example/runchise/pull/42",
    prSummary: "Updated the two CI badge URLs in README.md to point at the renamed repo.",
    finishedAt: "2026-08-01T10:04:00.000Z",
  });
}

console.log("Seeded 6 sample tickets with a spread of run states into " + dbPath);
