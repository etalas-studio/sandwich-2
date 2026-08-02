import { openDb } from "./db/connection.js";
import { upsertTicket } from "./db/tickets.js";

/**
 * Dev-only helper to populate the tickets table with sample data, since
 * formal ticket intake (queue file vs. UI form vs. something else) is still
 * undecided. Not wired into any runtime path — run manually with
 * `node dist/seed-tickets.js` while iterating on ticket-facing UI.
 */
const SAMPLE_TICKETS = [
  {
    key: "PROJ-101",
    summary: "Fix typo in onboarding email subject line",
    description: "The subject line reads 'Welcome to Runchise!!' with a double exclamation mark.",
    url: "https://example.atlassian.net/browse/PROJ-101",
  },
  {
    key: "PROJ-102",
    summary: "Add loading spinner to the settings save button",
    description: "Clicking Save gives no feedback until the request resolves, looks broken on slow networks.",
    url: "https://example.atlassian.net/browse/PROJ-102",
  },
  {
    key: "PROJ-103",
    summary: "Rate limit the /api/login endpoint",
    description: "No rate limiting currently exists on login attempts.",
    url: null,
  },
  {
    key: "PROJ-104",
    summary: "Migrate legacy date parsing to date-fns",
    description: "Several files still use hand-rolled date parsing that mishandles timezones.",
    url: "https://example.atlassian.net/browse/PROJ-104",
  },
  {
    key: "PROJ-105",
    summary: "Update README badge links",
    description: "CI badge points at the old repo slug after the rename.",
    url: null,
  },
];

const dbPath = process.env.DB_PATH ?? "data/instance.sqlite";
const db = openDb(dbPath);
for (const ticket of SAMPLE_TICKETS) {
  upsertTicket(db, ticket);
}
console.log(`Seeded ${String(SAMPLE_TICKETS.length)} sample tickets into ${dbPath}`);
