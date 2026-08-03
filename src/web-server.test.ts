import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { startWebServer } from "./web-server.js";

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "web-server-test-"));
  return join(dir, "db.sqlite");
}

function tempWebRoot(): string {
  return mkdtempSync(join(tmpdir(), "web-server-webroot-"));
}

async function startTestServer() {
  const server = startWebServer({ dbPath: tempDbPath(), port: 0, webRoot: tempWebRoot() });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function testTicketsRequiresSession(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/tickets`);
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
  console.log("PASS: testTicketsRequiresSession");
}

async function testRegisterLoginLogoutFlow(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "owner", email: "owner@example.com", password: "hunter22" }),
    });
    assert.equal(registerRes.status, 200);
    const cookie = registerRes.headers.get("set-cookie");
    assert.ok(cookie && cookie.includes("session="));
    const sessionCookie = cookie!.split(";")[0]!;

    const ticketsRes = await fetch(`${baseUrl}/api/tickets`, { headers: { cookie: sessionCookie } });
    assert.equal(ticketsRes.status, 200);

    const secondRegisterRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "someone-else", email: "x@example.com", password: "whatever1" }),
    });
    assert.equal(secondRegisterRes.status, 409);

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { cookie: sessionCookie },
    });
    assert.equal(logoutRes.status, 204);

    const afterLogoutRes = await fetch(`${baseUrl}/api/tickets`, { headers: { cookie: sessionCookie } });
    assert.equal(afterLogoutRes.status, 401);
  } finally {
    server.close();
  }
  console.log("PASS: testRegisterLoginLogoutFlow");
}

async function testLoginWithWrongPasswordFails(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "owner", email: "owner@example.com", password: "hunter22" }),
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "owner", password: "wrong" }),
    });
    assert.equal(loginRes.status, 401);
  } finally {
    server.close();
  }
  console.log("PASS: testLoginWithWrongPasswordFails");
}

async function testAuthMeReflectsAllThreeStates(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    const beforeSetupRes = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(beforeSetupRes.status, 200);
    assert.deepEqual(await beforeSetupRes.json(), { state: "setup_required" });

    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "owner", email: "owner@example.com", password: "hunter22" }),
    });
    assert.equal(registerRes.status, 200);
    const cookie = registerRes.headers.get("set-cookie");
    assert.ok(cookie && cookie.includes("session="));
    const sessionCookie = cookie!.split(";")[0]!;

    const unauthenticatedRes = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(unauthenticatedRes.status, 200);
    assert.deepEqual(await unauthenticatedRes.json(), { state: "unauthenticated" });

    const authenticatedRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: sessionCookie },
    });
    assert.equal(authenticatedRes.status, 200);
    assert.deepEqual(await authenticatedRes.json(), {
      state: "authenticated",
      user: { username: "owner" },
    });
  } finally {
    server.close();
  }
  console.log("PASS: testAuthMeReflectsAllThreeStates");
}

async function testLoginSucceedsAndCookieAuthorizes(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "owner", email: "owner@example.com", password: "hunter22" }),
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "owner", password: "hunter22" }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get("set-cookie");
    assert.ok(cookie && cookie.includes("session="));
    const sessionCookie = cookie!.split(";")[0]!;

    const ticketsRes = await fetch(`${baseUrl}/api/tickets`, { headers: { cookie: sessionCookie } });
    assert.equal(ticketsRes.status, 200);
  } finally {
    server.close();
  }
  console.log("PASS: testLoginSucceedsAndCookieAuthorizes");
}

async function main(): Promise<void> {
  await testTicketsRequiresSession();
  await testRegisterLoginLogoutFlow();
  await testLoginWithWrongPasswordFails();
  await testAuthMeReflectsAllThreeStates();
  await testLoginSucceedsAndCookieAuthorizes();
}

void main();
