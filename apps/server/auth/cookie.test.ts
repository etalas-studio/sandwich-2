import { strict as assert } from "node:assert";
import {
  SESSION_COOKIE_NAME,
  buildClearedSessionCookie,
  buildSessionCookie,
  parseCookies,
  sessionExpiryIso,
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

function testParseCookiesSkipsOnMalformedPercent(): void {
  // Malformed percent-encoding should not throw; the entry should be skipped.
  const cookies = parseCookies("session=100%");
  assert.equal(cookies[SESSION_COOKIE_NAME], undefined);
  console.log("PASS: testParseCookiesSkipsOnMalformedPercent");
}

function testParseCookiesHandlesMultipleMalformedEntries(): void {
  // Mix of valid and invalid entries; valid ones should be parsed.
  const cookies = parseCookies("foo=bar; session=%E0%A4%A; other=xyz");
  assert.equal(cookies["foo"], "bar");
  assert.equal(cookies[SESSION_COOKIE_NAME], undefined);
  assert.equal(cookies["other"], "xyz");
  console.log("PASS: testParseCookiesHandlesMultipleMalformedEntries");
}

function testParseCookiesHandlesCookieWithEquals(): void {
  // Cookie value containing "=" should be preserved.
  const cookies = parseCookies("token=abc%3Ddef");
  assert.equal(cookies["token"], "abc=def");
  console.log("PASS: testParseCookiesHandlesCookieWithEquals");
}

function testSessionExpiryIsoReturnsValidDate(): void {
  const expiry = sessionExpiryIso();
  // Should be a valid ISO string parseable as a date.
  const expiryDate = new Date(expiry);
  assert.ok(!isNaN(expiryDate.getTime()));
  // Should be approximately 7 days (604800 seconds) in the future.
  const now = Date.now();
  const futureTime = expiryDate.getTime();
  const diffSeconds = (futureTime - now) / 1000;
  // Allow 1-second margin for test execution time.
  assert.ok(diffSeconds >= 604799 && diffSeconds <= 604800);
  console.log("PASS: testSessionExpiryIsoReturnsValidDate");
}

function main(): void {
  testParseCookiesReadsSessionToken();
  testParseCookiesHandlesMissingHeader();
  testBuildSessionCookieIncludesSecurityAttributes();
  testBuildSessionCookieAddsSecureWhenRequested();
  testBuildClearedSessionCookieExpiresImmediately();
  testParseCookiesSkipsOnMalformedPercent();
  testParseCookiesHandlesMultipleMalformedEntries();
  testParseCookiesHandlesCookieWithEquals();
  testSessionExpiryIsoReturnsValidDate();
}

main();
