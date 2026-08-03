import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { createTicket, listTickets } from "./tickets.js";

describe("tickets repository", () => {
  let db: ReturnType<typeof openDb>;
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tickets-repo-test-"));
    db = openDb(join(tmpDir, "db.sqlite"));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a ticket and reads it back", () => {
    const ticket = createTicket(db, {
      key: "RR-1234",
      summary: "Fix login redirect loop",
      description: "Users get stuck in a redirect loop when logging in via SSO.",
      url: "https://runchise.atlassian.net/browse/RR-1234",
    });

    assert.equal(ticket.key, "RR-1234");
    assert.equal(ticket.summary, "Fix login redirect loop");
    assert.equal(ticket.description, "Users get stuck in a redirect loop when logging in via SSO.");
    assert.equal(ticket.url, "https://runchise.atlassian.net/browse/RR-1234");
    assert.equal(ticket.status, "backlog");
    assert.equal(ticket.stage, null);
    assert.equal(ticket.needsHumanCategory, null);
    assert.equal(ticket.needsHumanReason, null);
    assert.equal(ticket.prUrl, null);
    assert.equal(ticket.prSummary, null);
    assert.equal(ticket.startedAt, null);
    assert.equal(ticket.finishedAt, null);
    assert.equal(typeof ticket.createdAt, "string");
    assert.equal(typeof ticket.updatedAt, "string");
  });

  it("lists tickets ordered by created_at descending", () => {
    createTicket(db, {
      key: "RR-AAAA",
      summary: "First ticket",
      description: "A",
      url: null,
    });
    createTicket(db, {
      key: "RR-BBBB",
      summary: "Second ticket",
      description: "B",
      url: "https://linear.app/runchise/RR-BBBB",
    });

    const tickets = listTickets(db);
    assert.ok(tickets.length >= 2);
    // Most recently created should be first
    assert.equal(tickets[0]!.key, "RR-BBBB");
    assert.equal(tickets[1]!.key, "RR-AAAA");
  });

  it("rejects duplicate ticket key", () => {
    createTicket(db, {
      key: "RR-DUP",
      summary: "Some ticket",
      description: "First",
      url: null,
    });

    assert.throws(
      () =>
        createTicket(db, {
          key: "RR-DUP",
          summary: "Duplicate",
          description: "Second",
          url: null,
        }),
      /UNIQUE constraint failed: tickets.key/,
    );
  });

  it("rejects missing required fields", () => {
    assert.throws(
      () =>
        createTicket(db, {
          key: "",
          summary: "Test",
          description: "Test",
          url: null,
        }),
      /key must not be empty/,
    );

    assert.throws(
      () =>
        createTicket(db, {
          key: "RR-EMPTY-SUMMARY",
          summary: "",
          description: "Test",
          url: null,
        }),
      /summary must not be empty/,
    );

    assert.throws(
      () =>
        createTicket(db, {
          key: "RR-EMPTY-DESC",
          summary: "Test",
          description: "",
          url: null,
        }),
      /description must not be empty/,
    );
  });
});
