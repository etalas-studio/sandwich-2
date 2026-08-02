import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { createUser } from "./users.js";
import { createSession, getSessionByToken, deleteSession } from "./sessions.js";

function openTestDbWithUser() {
  const dir = mkdtempSync(join(tmpdir(), "sessions-test-"));
  const db = openDb(join(dir, "db.sqlite"));
  const user = createUser(db, {
    username: "owner",
    email: "owner@example.com",
    passwordHash: "argon2id$fake-hash",
  });
  return { db, user };
}

function testCreatesAndReadsBackASession(): void {
  const { db, user } = openTestDbWithUser();
  const expiresAt = new Date(Date.now() + 86400000).toISOString();
  const session = createSession(db, user.id, expiresAt);

  const fetched = getSessionByToken(db, session.token);
  assert.ok(fetched);
  assert.equal(fetched!.userId, user.id);
  assert.equal(fetched!.expiresAt, expiresAt);
  console.log("PASS: testCreatesAndReadsBackASession");
}

function testDeletingASessionRemovesIt(): void {
  const { db, user } = openTestDbWithUser();
  const session = createSession(db, user.id, new Date(Date.now() + 86400000).toISOString());

  deleteSession(db, session.token);
  assert.equal(getSessionByToken(db, session.token), null);
  console.log("PASS: testDeletingASessionRemovesIt");
}

function testCreateSessionFailsForUnknownUser(): void {
  const dir = mkdtempSync(join(tmpdir(), "sessions-test-"));
  const db = openDb(join(dir, "db.sqlite"));

  assert.throws(() => {
    createSession(db, "no-such-user", new Date(Date.now() + 86400000).toISOString());
  });
  console.log("PASS: testCreateSessionFailsForUnknownUser");
}

function main(): void {
  testCreatesAndReadsBackASession();
  testDeletingASessionRemovesIt();
  testCreateSessionFailsForUnknownUser();
}

main();
