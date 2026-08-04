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

async function testRegisterSucceedsOnce(): Promise<void> {
  const db = openTestDb();
  assert.equal(setupRequired(db), true);

  const result = await register(db, {
    username: "owner",
    email: "owner@example.com",
    password: "hunter22",
  });
  assert.equal(result.user.username, "owner");
  assert.equal(setupRequired(db), false);

  await assert.rejects(
    register(db, { username: "someone-else", email: "other@example.com", password: "whatever1" }),
    (err: unknown) => err instanceof AuthError && err.status === 409,
  );
  console.log("PASS: testRegisterSucceedsOnce");
}

/**
 * Regression guard for the coupling bug introduced by making hashPassword
 * async: register() must hash BEFORE checking anyUserExists, so that the
 * check and the insert stay in one synchronous, uninterruptible stretch.
 * If an `await` sat between them, both of these concurrent calls would
 * observe an empty users table and both would attempt to insert.
 */
async function testConcurrentRegistrationsCannotBothSucceed(): Promise<void> {
  const db = openTestDb();

  const results = await Promise.allSettled([
    register(db, { username: "first", email: "first@example.com", password: "hunter22" }),
    register(db, { username: "second", email: "second@example.com", password: "hunter22" }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1, "exactly one concurrent register() should succeed");
  assert.equal(rejected.length, 1, "the loser should be rejected, not inserted");

  const reason = (rejected[0] as PromiseRejectedResult).reason as unknown;
  assert.ok(
    reason instanceof AuthError && reason.status === 409,
    "the losing registration should fail with a clean 409, not a raw DB constraint error",
  );

  const userCount = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  assert.equal(userCount, 1, "only one account may ever exist");
  console.log("PASS: testConcurrentRegistrationsCannotBothSucceed");
}

async function testLoginSucceedsWithCorrectCredentials(): Promise<void> {
  const db = openTestDb();
  await register(db, { username: "owner", email: "owner@example.com", password: "hunter22" });

  const result = await login(db, { username: "owner", password: "hunter22" });
  assert.equal(result.user.username, "owner");
  console.log("PASS: testLoginSucceedsWithCorrectCredentials");
}

async function testLoginFailsWithWrongPassword(): Promise<void> {
  const db = openTestDb();
  await register(db, { username: "owner", email: "owner@example.com", password: "hunter22" });

  await assert.rejects(
    login(db, { username: "owner", password: "wrong" }),
    (err: unknown) => err instanceof AuthError && err.status === 401,
  );
  console.log("PASS: testLoginFailsWithWrongPassword");
}

async function testLoginFailsWithUnknownUsername(): Promise<void> {
  const db = openTestDb();
  await register(db, { username: "owner", email: "owner@example.com", password: "hunter22" });

  await assert.rejects(
    login(db, { username: "nobody", password: "whatever1" }),
    (err: unknown) => err instanceof AuthError && err.status === 401,
  );
  console.log("PASS: testLoginFailsWithUnknownUsername");
}

async function testLogoutInvalidatesSession(): Promise<void> {
  const db = openTestDb();
  const { session } = await register(db, {
    username: "owner",
    email: "owner@example.com",
    password: "hunter22",
  });

  assert.ok(validateSession(db, session.token) !== null);
  logout(db, session.token);
  assert.equal(validateSession(db, session.token), null);
  console.log("PASS: testLogoutInvalidatesSession");
}

async function testExpiredSessionIsRejected(): Promise<void> {
  const db = openTestDb();
  await register(db, { username: "owner", email: "owner@example.com", password: "hunter22" });
  const owner = getUserByUsername(db, "owner")!;
  const expired = createSession(db, owner.id, new Date(Date.now() - 1000).toISOString());

  assert.equal(validateSession(db, expired.token), null);
  console.log("PASS: testExpiredSessionIsRejected");
}

async function main(): Promise<void> {
  await testRegisterSucceedsOnce();
  await testConcurrentRegistrationsCannotBothSucceed();
  await testLoginSucceedsWithCorrectCredentials();
  await testLoginFailsWithWrongPassword();
  await testLoginFailsWithUnknownUsername();
  await testLogoutInvalidatesSession();
  await testExpiredSessionIsRejected();
}

void main();
