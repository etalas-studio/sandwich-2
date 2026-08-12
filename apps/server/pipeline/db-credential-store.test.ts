import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { createDbCredentialStore } from "./db-credential-store.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "credential-store-test-"));
  return openDb(join(dir, "db.sqlite"));
}

async function testReadIsUndefinedWhenNoRow(): Promise<void> {
  const store = createDbCredentialStore(openTestDb());
  assert.equal(await store.read("opencode-go"), undefined);
  console.log("PASS: testReadIsUndefinedWhenNoRow");
}

async function testModifyPersistsAndReadRoundtrips(): Promise<void> {
  const store = createDbCredentialStore(openTestDb());
  await store.modify("opencode-go", async () => ({ type: "api_key", key: "sk-abc" }));

  const read = await store.read("opencode-go");
  assert.deepEqual(read, { type: "api_key", key: "sk-abc" });
  console.log("PASS: testModifyPersistsAndReadRoundtrips");
}

async function testDeleteRemovesCredential(): Promise<void> {
  const store = createDbCredentialStore(openTestDb());
  await store.modify("opencode-go", async () => ({ type: "api_key", key: "sk-abc" }));
  await store.delete("opencode-go");

  assert.equal(await store.read("opencode-go"), undefined);
  console.log("PASS: testDeleteRemovesCredential");
}

async function testListReturnsProviderIdAndType(): Promise<void> {
  const store = createDbCredentialStore(openTestDb());
  await store.modify("opencode-go", async () => ({ type: "api_key", key: "sk-abc" }));

  const list = await store.list();
  assert.deepEqual(list, [{ providerId: "opencode-go", type: "api_key" }]);
  console.log("PASS: testListReturnsProviderIdAndType");
}

async function main(): Promise<void> {
  await testReadIsUndefinedWhenNoRow();
  await testModifyPersistsAndReadRoundtrips();
  await testDeleteRemovesCredential();
  await testListReturnsProviderIdAndType();
}

main();
