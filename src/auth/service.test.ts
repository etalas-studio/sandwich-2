import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { createSession } from "../db/sessions.js";
import { getUserByUsername } from "../db/users.js";
import { AuthError, login, logout, register, setupRequired, validateSession } from "./service.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "auth-service-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testRegisterSucceedsOnce(): void {
  const db = openTestDb();
  assert.equal(setupRequired(db), true);

  const result = register(db, { username: "owner", email: "owner@example.com", password: "hunter22" });
  assert.equal(result.user.username, "owner");
  assert.equal(setupRequired(db), false);

  assert.throws(
    () => register(db, { username: "someone-else", email: "other@example.com", password: "whatever1" }),
    (err: unknown) => err instanceof AuthError && err.status === 409,
  );
  console.log("PASS: testRegisterSucceedsOnce");
}

function testLoginSucceedsWithCorrectCredentials(): void {
  const db = openTestDb();
  register(db, { username: "owner", email: "owner@example.com", password: "hunter22" });

  const result = login(db, { username: "owner", password: "hunter22" });
  assert.equal(result.user.username, "owner");
  console.log("PASS: testLoginSucceedsWithCorrectCredentials");
}

function testLoginFailsWithWrongPassword(): void {
  const db = openTestDb();
  register(db, { username: "owner", email: "owner@example.com", password: "hunter22" });

  assert.throws(
    () => login(db, { username: "owner", password: "wrong" }),
    (err: unknown) => err instanceof AuthError && err.status === 401,
  );
  console.log("PASS: testLoginFailsWithWrongPassword");
}

function testLoginFailsWithUnknownUsername(): void {
  const db = openTestDb();
  register(db, { username: "owner", email: "owner@example.com", password: "hunter22" });

  assert.throws(
    () => login(db, { username: "nobody", password: "whatever1" }),
    (err: unknown) => err instanceof AuthError && err.status === 401,
  );
  console.log("PASS: testLoginFailsWithUnknownUsername");
}

function testLogoutInvalidatesSession(): void {
  const db = openTestDb();
  const { session } = register(db, { username: "owner", email: "owner@example.com", password: "hunter22" });

  assert.ok(validateSession(db, session.token) !== null);
  logout(db, session.token);
  assert.equal(validateSession(db, session.token), null);
  console.log("PASS: testLogoutInvalidatesSession");
}

function testExpiredSessionIsRejected(): void {
  const db = openTestDb();
  register(db, { username: "owner", email: "owner@example.com", password: "hunter22" });
  const owner = getUserByUsername(db, "owner")!;
  const expired = createSession(db, owner.id, new Date(Date.now() - 1000).toISOString());

  assert.equal(validateSession(db, expired.token), null);
  console.log("PASS: testExpiredSessionIsRejected");
}

function main(): void {
  testRegisterSucceedsOnce();
  testLoginSucceedsWithCorrectCredentials();
  testLoginFailsWithWrongPassword();
  testLoginFailsWithUnknownUsername();
  testLogoutInvalidatesSession();
  testExpiredSessionIsRejected();
}

main();
