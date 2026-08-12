import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { createUser, getUserById, getUserByUsername } from "./users.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "users-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testCreatesAndReadsBackAUser(): void {
  const db = openTestDb();
  const user = createUser(db, {
    username: "owner",
    email: "owner@example.com",
    passwordHash: "argon2id$fake-hash",
  });

  assert.equal(getUserById(db, user.id)!.username, "owner");
  assert.equal(getUserByUsername(db, "owner")!.id, user.id);
  console.log("PASS: testCreatesAndReadsBackAUser");
}

function testDuplicateUsernameIsRejected(): void {
  const db = openTestDb();
  createUser(db, { username: "owner", email: "owner@example.com", passwordHash: "hash1" });

  assert.throws(() => {
    createUser(db, { username: "owner", email: "someone-else@example.com", passwordHash: "hash2" });
  });
  console.log("PASS: testDuplicateUsernameIsRejected");
}

function testDuplicateEmailIsRejected(): void {
  const db = openTestDb();
  createUser(db, { username: "owner", email: "owner@example.com", passwordHash: "hash1" });

  assert.throws(() => {
    createUser(db, { username: "someone-else", email: "owner@example.com", passwordHash: "hash2" });
  });
  console.log("PASS: testDuplicateEmailIsRejected");
}

function main(): void {
  testCreatesAndReadsBackAUser();
  testDuplicateUsernameIsRejected();
  testDuplicateEmailIsRejected();
}

main();
