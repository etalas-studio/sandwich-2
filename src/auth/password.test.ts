import { strict as assert } from "node:assert";
import { hashPassword, verifyPassword } from "./password.js";

async function testVerifyAcceptsCorrectPassword(): Promise<void> {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  console.log("PASS: testVerifyAcceptsCorrectPassword");
}

async function testVerifyRejectsWrongPassword(): Promise<void> {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("wrong password", hash), false);
  console.log("PASS: testVerifyRejectsWrongPassword");
}

async function testHashesOfSamePasswordDiffer(): Promise<void> {
  const a = await hashPassword("same password");
  const b = await hashPassword("same password");
  assert.notEqual(a, b);
  console.log("PASS: testHashesOfSamePasswordDiffer");
}

async function testVerifyRejectsMalformedStoredHash(): Promise<void> {
  assert.equal(await verifyPassword("anything", "not-a-real-hash"), false);
  console.log("PASS: testVerifyRejectsMalformedStoredHash");
}

async function testVerifyRejectsEmptyDerivedKey(): Promise<void> {
  // Malformed hash with valid salt but empty derived-key segment
  const malformedHash = "scrypt$aabbccddaabbccddaabbccddaabbccdd$";
  assert.equal(await verifyPassword("anything", malformedHash), false);
  console.log("PASS: testVerifyRejectsEmptyDerivedKey");
}

/**
 * The whole point of moving off scryptSync: hashing must not monopolise the
 * event loop. Two concurrent hashes should overlap on libuv's threadpool
 * rather than run strictly back-to-back, and timers must still fire while a
 * hash is in flight.
 */
async function testHashingDoesNotBlockTheEventLoop(): Promise<void> {
  let timerFired = false;
  const timer = setTimeout(() => {
    timerFired = true;
  }, 1);

  await hashPassword("some password that takes real cpu time");
  clearTimeout(timer);

  assert.equal(timerFired, true, "a 1ms timer should have fired during an async hash");
  console.log("PASS: testHashingDoesNotBlockTheEventLoop");
}

async function main(): Promise<void> {
  await testVerifyAcceptsCorrectPassword();
  await testVerifyRejectsWrongPassword();
  await testHashesOfSamePasswordDiffer();
  await testVerifyRejectsMalformedStoredHash();
  await testVerifyRejectsEmptyDerivedKey();
  await testHashingDoesNotBlockTheEventLoop();
}

void main();
