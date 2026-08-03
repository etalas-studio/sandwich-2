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

  it("creates a ticket with explicit id and reads it back", () => {
    const ticket = createTicket(db, {
      id: "RR-1234",
      description: "Users get stuck in a redirect loop when logging in via SSO.",
      url: "https://runchise.atlassian.net/browse/RR-1234",
    });

    assert.equal(ticket.key, "RR-1234");
    assert.equal(ticket.description, "Users get stuck in a redirect loop when logging in via SSO.");
    assert.equal(ticket.url, "https://runchise.atlassian.net/browse/RR-1234");
    assert.equal(ticket.status, "backlog");
    assert.equal(ticket.stage, null);
    assert.equal(typeof ticket.createdAt, "string");
  });

  it("auto-generates id when empty", () => {
    const ticket = createTicket(db, {
      id: "",
      description: "A description-only ticket.",
      url: null,
    });

    assert.ok(ticket.key.startsWith("T-"));
    assert.equal(ticket.key.length, 10); // "T-" + 8 chars
    assert.equal(ticket.description, "A description-only ticket.");
    assert.equal(ticket.url, null);
  });

  it("lists tickets ordered by created_at descending", () => {
    createTicket(db, { id: "RR-AAAA", description: "First ticket", url: null });
    createTicket(db, { id: "RR-BBBB", description: "Second ticket", url: null });

    const tickets = listTickets(db);
    assert.ok(tickets.length >= 2);
    assert.equal(tickets[0]!.key, "RR-BBBB");
    assert.equal(tickets[1]!.key, "RR-AAAA");
  });

  it("rejects duplicate ticket key", () => {
    createTicket(db, { id: "RR-DUP", description: "First", url: null });

    assert.throws(
      () => createTicket(db, { id: "RR-DUP", description: "Second", url: null }),
      /UNIQUE constraint failed/,
    );
  });

  it("rejects empty description", () => {
    assert.throws(
      () => createTicket(db, { id: "RR-EMPTY", description: "", url: null }),
      /description must not be empty/,
    );

    assert.throws(
      () => createTicket(db, { id: "RR-WHITESPACE", description: "   ", url: null }),
      /description must not be empty/,
    );
  });
});
