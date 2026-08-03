import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { startWebServer } from "./web-server.js";

/**
 * Raw http.request, because `fetch` will not let us forge a Host header and
 * the DNS-rebinding guard is specifically about the Host header.
 */
function rawRequest(
  port: number,
  options: { method: string; path: string; headers?: Record<string, string>; body?: string },
): Promise<{ status: number; body: string; contentType: string }> {
  return new Promise((resolvePromise, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        method: options.method,
        path: options.path,
        headers: options.headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += String(chunk)));
        res.on("end", () =>
          resolvePromise({
            status: res.statusCode ?? 0,
            body: data,
            contentType: String(res.headers["content-type"] ?? ""),
          }),
        );
      },
    );
    req.on("error", reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "web-server-test-"));
  return join(dir, "db.sqlite");
}

function tempWebRoot(): string {
  return mkdtempSync(join(tmpdir(), "web-server-webroot-"));
}

function tempPipelineConfigPath(): string {
  // Deliberately nonexistent — these tests never exercise the run-trigger
  // route's actual pipeline execution, and startWebServer already handles a
  // missing config gracefully (503 on POST .../run).
  return join(mkdtempSync(join(tmpdir(), "web-server-test-pipeline-")), "instance.json");
}

async function startTestServer() {
  const server = startWebServer({
    dbPath: tempDbPath(),
    port: 0,
    webRoot: tempWebRoot(),
    pipelineConfigPath: tempPipelineConfigPath(),
  });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, port, baseUrl: `http://127.0.0.1:${port}` };
}

async function registerOwner(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "owner", email: "owner@example.com", password: "hunter22" }),
  });
  assert.equal(res.status, 200);
  return res.headers.get("set-cookie")!.split(";")[0]!;
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

// --- Finding 1: CSRF / DNS-rebinding guard ---

async function testCrossOriginRegisterIsRejected(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      // text/plain is what a cross-site form/fetch would use to dodge the
      // CORS preflight; readJsonBody never checked Content-Type.
      headers: { "content-type": "text/plain", origin: "http://evil.example" },
      body: JSON.stringify({ username: "attacker", email: "a@evil.example", password: "hunter22" }),
    });
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: "forbidden" });

    // …and the account must still be claimable by the real operator.
    const meRes = await fetch(`${baseUrl}/api/auth/me`);
    assert.deepEqual(await meRes.json(), { state: "setup_required" });
  } finally {
    server.close();
  }
  console.log("PASS: testCrossOriginRegisterIsRejected");
}

async function testMatchingOriginIsAllowed(): Promise<void> {
  const { server, baseUrl, port } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: `http://127.0.0.1:${port}` },
      body: JSON.stringify({ username: "owner", email: "owner@example.com", password: "hunter22" }),
    });
    assert.equal(res.status, 200);
  } finally {
    server.close();
  }
  console.log("PASS: testMatchingOriginIsAllowed");
}

async function testSafeGetWithForeignOriginIsAllowed(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    // GET is not state-changing, so the Origin check does not apply to it.
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { origin: "http://evil.example" },
    });
    assert.equal(res.status, 200);
  } finally {
    server.close();
  }
  console.log("PASS: testSafeGetWithForeignOriginIsAllowed");
}

async function testUntrustedHostIsRejected(): Promise<void> {
  const { server, port } = await startTestServer();
  try {
    // DNS rebinding: an attacker-controlled name resolving to 127.0.0.1.
    const res = await rawRequest(port, {
      method: "GET",
      path: "/api/auth/me",
      headers: { host: "rebind.evil.example" },
    });
    assert.equal(res.status, 403);
    assert.deepEqual(JSON.parse(res.body), { error: "forbidden" });
  } finally {
    server.close();
  }
  console.log("PASS: testUntrustedHostIsRejected");
}

async function testLocalhostHostIsAllowed(): Promise<void> {
  const { server, port } = await startTestServer();
  try {
    const res = await rawRequest(port, {
      method: "GET",
      path: "/api/auth/me",
      headers: { host: `localhost:${port}` },
    });
    assert.equal(res.status, 200);
  } finally {
    server.close();
  }
  console.log("PASS: testLocalhostHostIsAllowed");
}

// --- Finding 3: default-deny on /api/* ---

async function testUnknownApiPathIsNotServedBySpa(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    // Unauthenticated: default-deny wins before anything else.
    const anon = await fetch(`${baseUrl}/api/tickets-typo`);
    assert.equal(anon.status, 401);
    assert.deepEqual(await anon.json(), { error: "unauthorized" });

    const cookie = await registerOwner(baseUrl);

    // Authenticated: a JSON 404, never index.html with a 200.
    const res = await fetch(`${baseUrl}/api/tickets-typo`, { headers: { cookie } });
    assert.equal(res.status, 404);
    assert.ok(res.headers.get("content-type")?.includes("application/json"));
    assert.deepEqual(await res.json(), { error: "not found" });
  } finally {
    server.close();
  }
  console.log("PASS: testUnknownApiPathIsNotServedBySpa");
}

// --- Finding 4B: request body size cap ---

async function testOversizedBodyIsRejected(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "owner",
        email: "owner@example.com",
        password: "hunter22",
        padding: "x".repeat(200_000),
      }),
    });
    assert.equal(res.status, 413);
    assert.deepEqual(await res.json(), { error: "request body too large" });
  } finally {
    server.close();
  }
  console.log("PASS: testOversizedBodyIsRejected");
}

// --- Merge with the pipeline/settings work: those routes had no auth at
// all before this branch merged (they were built before Auth existed) —
// the default-deny guard must cover them too, not just /api/tickets. ---

async function testSettingsProjectRequiresSession(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    const getRes = await fetch(`${baseUrl}/api/settings/project`);
    assert.equal(getRes.status, 401);

    const postRes = await fetch(`${baseUrl}/api/settings/project`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repoPath: "/tmp/whatever" }),
    });
    assert.equal(postRes.status, 401);
  } finally {
    server.close();
  }
  console.log("PASS: testSettingsProjectRequiresSession");
}

async function testArtifactsRequiresSession(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/tickets/some-key/artifacts`);
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
  console.log("PASS: testArtifactsRequiresSession");
}

async function testRunTriggerRequiresSession(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/tickets/some-key/run`, { method: "POST" });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
  console.log("PASS: testRunTriggerRequiresSession");
}

async function testTicketCreateStopDuplicateDeleteRequireSession(): Promise<void> {
  const { server, baseUrl } = await startTestServer();
  try {
    const createRes = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "T-1", summary: "s", description: "d" }),
    });
    assert.equal(createRes.status, 401);

    const stopRes = await fetch(`${baseUrl}/api/tickets/some-key/stop`, { method: "POST" });
    assert.equal(stopRes.status, 401);

    const duplicateRes = await fetch(`${baseUrl}/api/tickets/some-key/duplicate`, { method: "POST" });
    assert.equal(duplicateRes.status, 401);

    const deleteRes = await fetch(`${baseUrl}/api/tickets/some-key`, { method: "DELETE" });
    assert.equal(deleteRes.status, 401);
  } finally {
    server.close();
  }
  console.log("PASS: testTicketCreateStopDuplicateDeleteRequireSession");
}

async function main(): Promise<void> {
  await testTicketsRequiresSession();
  await testRegisterLoginLogoutFlow();
  await testLoginWithWrongPasswordFails();
  await testAuthMeReflectsAllThreeStates();
  await testLoginSucceedsAndCookieAuthorizes();
  await testCrossOriginRegisterIsRejected();
  await testMatchingOriginIsAllowed();
  await testSafeGetWithForeignOriginIsAllowed();
  await testUntrustedHostIsRejected();
  await testLocalhostHostIsAllowed();
  await testUnknownApiPathIsNotServedBySpa();
  await testOversizedBodyIsRejected();
  await testSettingsProjectRequiresSession();
  await testArtifactsRequiresSession();
  await testRunTriggerRequiresSession();
  await testTicketCreateStopDuplicateDeleteRequireSession();
}

void main();
