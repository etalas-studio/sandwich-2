import { strict as assert } from "node:assert";
import { hashPassword, verifyPassword } from "./password.js";

function testVerifyAcceptsCorrectPassword(): void {
  const hash = hashPassword("correct horse battery staple");
  assert.equal(verifyPassword("correct horse battery staple", hash), true);
  console.log("PASS: testVerifyAcceptsCorrectPassword");
}

function testVerifyRejectsWrongPassword(): void {
  const hash = hashPassword("correct horse battery staple");
  assert.equal(verifyPassword("wrong password", hash), false);
  console.log("PASS: testVerifyRejectsWrongPassword");
}

function testHashesOfSamePasswordDiffer(): void {
  const a = hashPassword("same password");
  const b = hashPassword("same password");
  assert.notEqual(a, b);
  console.log("PASS: testHashesOfSamePasswordDiffer");
}

function testVerifyRejectsMalformedStoredHash(): void {
  assert.equal(verifyPassword("anything", "not-a-real-hash"), false);
  console.log("PASS: testVerifyRejectsMalformedStoredHash");
}

function testVerifyRejectsEmptyDerivedKey(): void {
  // Malformed hash with valid salt but empty derived-key segment
  const malformedHash = "scrypt$aabbccddaabbccddaabbccddaabbccdd$";
  assert.equal(verifyPassword("anything", malformedHash), false);
  console.log("PASS: testVerifyRejectsEmptyDerivedKey");
}

function main(): void {
  testVerifyAcceptsCorrectPassword();
  testVerifyRejectsWrongPassword();
  testHashesOfSamePasswordDiffer();
  testVerifyRejectsMalformedStoredHash();
  testVerifyRejectsEmptyDerivedKey();
}

main();
