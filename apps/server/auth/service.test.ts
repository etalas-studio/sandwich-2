import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { createSession } from "../db/sessions.js";
import { getUserByUsername } from "../db/users.js";
import { AuthError, login, logout, register, validateSession } from "./service.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "auth-service-test-"));
  return openDb(join(dir, "db.sqlite"));
}

async function testRegisterAllowsMultipleAccounts(): Promise<void> {
  const db = openTestDb();

  const owner = await register(db, {
    username: "owner",
    email: "owner@example.com",
    password: "hunter22",
  });
  assert.equal(owner.user.username, "owner");

  const second = await register(db, {
    username: "someone-else",
    email: "other@example.com",
    password: "whatever1",
  });
  assert.equal(second.user.username, "someone-else");
  console.log("PASS: testRegisterAllowsMultipleAccounts");
}

async function testRegisterRejectsDuplicateUsername(): Promise<void> {
  const db = openTestDb();
  await register(db, { username: "owner", email: "owner@example.com", password: "hunter22" });

  await assert.rejects(
    register(db, { username: "owner", email: "different@example.com", password: "whatever1" }),
    (err: unknown) => err instanceof AuthError && err.status === 409,
  );
  console.log("PASS: testRegisterRejectsDuplicateUsername");
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
  await testRegisterAllowsMultipleAccounts();
  await testRegisterRejectsDuplicateUsername();
  await testLoginSucceedsWithCorrectCredentials();
  await testLoginFailsWithWrongPassword();
  await testLoginFailsWithUnknownUsername();
  await testLogoutInvalidatesSession();
  await testExpiredSessionIsRejected();
}

void main();
