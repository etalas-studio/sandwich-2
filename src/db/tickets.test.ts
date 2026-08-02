import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { upsertTicket, getTicketByKey, listTickets } from "./tickets.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "tickets-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testInsertsAndReadsBackATicket(): void {
  const db = openTestDb();
  upsertTicket(db, {
    key: "PROJ-1",
    summary: "Fix typo",
    description: "Fix the typo in README",
    url: "https://example.com/PROJ-1",
  });

  const ticket = getTicketByKey(db, "PROJ-1");
  assert.ok(ticket);
  assert.equal(ticket!.summary, "Fix typo");
  assert.equal(ticket!.url, "https://example.com/PROJ-1");
  console.log("PASS: testInsertsAndReadsBackATicket");
}

function testUpsertUpdatesExistingTicketWithoutChangingCreatedAt(): void {
  const db = openTestDb();
  upsertTicket(db, { key: "PROJ-2", summary: "Old summary", description: "Old description" });
  const first = getTicketByKey(db, "PROJ-2")!;

  upsertTicket(db, { key: "PROJ-2", summary: "New summary", description: "New description" });
  const second = getTicketByKey(db, "PROJ-2")!;

  assert.equal(second.summary, "New summary");
  assert.equal(second.description, "New description");
  assert.equal(second.createdAt, first.createdAt);
  console.log("PASS: testUpsertUpdatesExistingTicketWithoutChangingCreatedAt");
}

function testListTicketsReturnsAllTickets(): void {
  const db = openTestDb();
  upsertTicket(db, { key: "PROJ-3", summary: "A", description: "A" });
  upsertTicket(db, { key: "PROJ-4", summary: "B", description: "B" });

  const tickets = listTickets(db);
  assert.equal(tickets.length, 2);
  console.log("PASS: testListTicketsReturnsAllTickets");
}

function testGetTicketByKeyReturnsNullWhenMissing(): void {
  const db = openTestDb();
  assert.equal(getTicketByKey(db, "MISSING"), null);
  console.log("PASS: testGetTicketByKeyReturnsNullWhenMissing");
}

function main(): void {
  testInsertsAndReadsBackATicket();
  testUpsertUpdatesExistingTicketWithoutChangingCreatedAt();
  testListTicketsReturnsAllTickets();
  testGetTicketByKeyReturnsNullWhenMissing();
}

main();
