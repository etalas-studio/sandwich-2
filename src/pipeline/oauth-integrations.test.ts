import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { upsertCredential } from "../db/credentials.js";
import { initOAuth, getValidOAuthToken } from "./oauth-integrations.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "oauth-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function storeCredential(db: ReturnType<typeof openTestDb>, provider: string, opts: {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}): void {
  upsertCredential(db, `oauth:${provider}`, JSON.stringify({ type: "oauth", ...opts }));
}

async function testReturnsAccessTokenWhenNotExpired(): Promise<void> {
  const db = openTestDb();
  initOAuth(db);
  storeCredential(db, "bitbucket", {
    accessToken: "valid-token",
    refreshToken: "refresh-abc",
    expiresAt: Date.now() + 3600 * 1000,
  });

  const token = await getValidOAuthToken("bitbucket", (async () => {
    throw new Error("should not call fetch when token is still valid");
  }) as unknown as typeof fetch);

  assert.equal(token, "valid-token");
  console.log("PASS: testReturnsAccessTokenWhenNotExpired");
}

async function testRefreshesExpiredBitbucketToken(): Promise<void> {
  const db = openTestDb();
  initOAuth(db);
  storeCredential(db, "bitbucket", {
    accessToken: "old-token",
    refreshToken: "refresh-abc",
    expiresAt: Date.now() - 1000, // already expired
  });

  let calledWithRefreshToken: string | null = null;
  const fakeFetch = (async (_url: string, init?: { body?: string }) => {
    const params = new URLSearchParams(init?.body ?? "");
    calledWithRefreshToken = params.get("refresh_token");
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "new-token", refresh_token: "refresh-xyz" }),
    } as unknown as Response;
  }) as typeof fetch;

  const token = await getValidOAuthToken("bitbucket", fakeFetch);

  assert.equal(token, "new-token");
  assert.equal(calledWithRefreshToken, "refresh-abc");

  // Refreshed token should be persisted so the next call doesn't refresh again
  const tokenAgain = await getValidOAuthToken("bitbucket", (async () => {
    throw new Error("should not call fetch again — refreshed token was persisted");
  }) as unknown as typeof fetch);
  assert.equal(tokenAgain, "new-token");
  console.log("PASS: testRefreshesExpiredBitbucketToken");
}

async function testReturnsNullWhenRefreshFails(): Promise<void> {
  const db = openTestDb();
  initOAuth(db);
  storeCredential(db, "bitbucket", {
    accessToken: "old-token",
    refreshToken: "refresh-abc",
    expiresAt: Date.now() - 1000,
  });

  const fakeFetch = (async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: "invalid_grant" }),
  } as unknown as Response)) as typeof fetch;

  const token = await getValidOAuthToken("bitbucket", fakeFetch);
  assert.equal(token, null);
  console.log("PASS: testReturnsNullWhenRefreshFails");
}

async function testGithubTokenNeverExpiresSoNeverRefreshes(): Promise<void> {
  const db = openTestDb();
  initOAuth(db);
  storeCredential(db, "github", {
    accessToken: "gh-token",
    refreshToken: null,
    expiresAt: null,
  });

  const token = await getValidOAuthToken("github", (async () => {
    throw new Error("should not call fetch for github — tokens don't expire");
  }) as unknown as typeof fetch);

  assert.equal(token, "gh-token");
  console.log("PASS: testGithubTokenNeverExpiresSoNeverRefreshes");
}

async function testReturnsNullWhenNotConnected(): Promise<void> {
  const db = openTestDb();
  initOAuth(db);
  const token = await getValidOAuthToken("bitbucket");
  assert.equal(token, null);
  console.log("PASS: testReturnsNullWhenNotConnected");
}

async function main(): Promise<void> {
  await testReturnsAccessTokenWhenNotExpired();
  await testRefreshesExpiredBitbucketToken();
  await testReturnsNullWhenRefreshFails();
  await testGithubTokenNeverExpiresSoNeverRefreshes();
  await testReturnsNullWhenNotConnected();
}

main();
