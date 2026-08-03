import { strict as assert } from "node:assert";
import {
  SESSION_COOKIE_NAME,
  buildClearedSessionCookie,
  buildSessionCookie,
  parseCookies,
} from "./cookie.js";

function testParseCookiesReadsSessionToken(): void {
  const cookies = parseCookies("foo=bar; session=abc123; other=xyz");
  assert.equal(cookies[SESSION_COOKIE_NAME], "abc123");
  console.log("PASS: testParseCookiesReadsSessionToken");
}

function testParseCookiesHandlesMissingHeader(): void {
  assert.deepEqual(parseCookies(undefined), {});
  console.log("PASS: testParseCookiesHandlesMissingHeader");
}

function testBuildSessionCookieIncludesSecurityAttributes(): void {
  const cookie = buildSessionCookie("abc123", false);
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("SameSite=Lax"));
  assert.ok(!cookie.includes("Secure"));
  console.log("PASS: testBuildSessionCookieIncludesSecurityAttributes");
}

function testBuildSessionCookieAddsSecureWhenRequested(): void {
  const cookie = buildSessionCookie("abc123", true);
  assert.ok(cookie.includes("Secure"));
  console.log("PASS: testBuildSessionCookieAddsSecureWhenRequested");
}

function testBuildClearedSessionCookieExpiresImmediately(): void {
  const cookie = buildClearedSessionCookie(false);
  assert.ok(cookie.includes("Max-Age=0"));
  console.log("PASS: testBuildClearedSessionCookieExpiresImmediately");
}

function main(): void {
  testParseCookiesReadsSessionToken();
  testParseCookiesHandlesMissingHeader();
  testBuildSessionCookieIncludesSecurityAttributes();
  testBuildSessionCookieAddsSecureWhenRequested();
  testBuildClearedSessionCookieExpiresImmediately();
}

main();
