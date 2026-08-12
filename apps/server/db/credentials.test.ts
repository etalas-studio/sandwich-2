import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { upsertCredential, getCredential, listCredentialNames } from "./credentials.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "credentials-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testInsertsAndReadsBackACredential(): void {
  const db = openTestDb();
  upsertCredential(db, "STRIPE_API_KEY", "sk_test_123");

  const credential = getCredential(db, "STRIPE_API_KEY");
  assert.ok(credential);
  assert.equal(credential!.value, "sk_test_123");
  console.log("PASS: testInsertsAndReadsBackACredential");
}

function testUpsertOverwritesValueButKeepsCreatedAt(): void {
  const db = openTestDb();
  upsertCredential(db, "STRIPE_API_KEY", "sk_test_123");
  const first = getCredential(db, "STRIPE_API_KEY")!;

  upsertCredential(db, "STRIPE_API_KEY", "sk_test_456");
  const second = getCredential(db, "STRIPE_API_KEY")!;

  assert.equal(second.value, "sk_test_456");
  assert.equal(second.createdAt, first.createdAt);
  console.log("PASS: testUpsertOverwritesValueButKeepsCreatedAt");
}

function testListCredentialNamesReturnsNamesOnly(): void {
  const db = openTestDb();
  upsertCredential(db, "STRIPE_API_KEY", "sk_test_123");
  upsertCredential(db, "SENDGRID_KEY", "sg_abc");

  const names = listCredentialNames(db);
  assert.deepEqual(names, ["SENDGRID_KEY", "STRIPE_API_KEY"]);
  console.log("PASS: testListCredentialNamesReturnsNamesOnly");
}

function main(): void {
  testInsertsAndReadsBackACredential();
  testUpsertOverwritesValueButKeepsCreatedAt();
  testListCredentialNamesReturnsNamesOnly();
}

main();
