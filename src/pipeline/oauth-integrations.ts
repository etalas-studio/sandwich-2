import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { upsertCredential, deleteCredential } from "../db/credentials.js";

// ── In-memory OAuth state store (survives server restart? no — just for the redirect roundtrip)
const pendingStates = new Map<string, { provider: string; returnTo: string }>();

// ── Config from env
function jiraClientId(): string {
  return process.env.JIRA_CLIENT_ID ?? "";
}
function jiraClientSecret(): string {
  return process.env.JIRA_CLIENT_SECRET ?? "";
}
function bitbucketClientId(): string {
  return process.env.BITBUCKET_CLIENT_ID ?? "";
}
function bitbucketClientSecret(): string {
  return process.env.BITBUCKET_CLIENT_SECRET ?? "";
}

// ── Helpers
function baseUrl(): string {
  // Derive redirect URI base from env or default to localhost
  const host = process.env.HOST ?? "localhost";
  const port = process.env.PORT ?? "4319";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${proto}://${host}:${port}`;
}

function credentialName(provider: string): string {
  return `oauth:${provider}`;
}

// ── OAuth authorize URLs (step 1)
export function startJiraAuth(returnTo: string): string {
  const state = `jira-${randomUUID()}`;
  pendingStates.set(state, { provider: "jira", returnTo });

  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: jiraClientId(),
    scope: "read:jira-work read:jira-user",
    redirect_uri: `${baseUrl()}/api/integrations/jira/callback`,
    state,
    response_type: "code",
    prompt: "consent",
  });
  return `https://auth.atlassian.com/authorize?${params.toString()}`;
}

export function startBitbucketAuth(returnTo: string): string {
  const state = `bb-${randomUUID()}`;
  pendingStates.set(state, { provider: "bitbucket", returnTo });

  const callbackUrl = `${baseUrl()}/api/integrations/bitbucket/callback`;
  const params = new URLSearchParams({
    client_id: bitbucketClientId(),
    response_type: "code",
    state,
    redirect_uri: callbackUrl,
  });
  console.log(`Bitbucket OAuth authorize URL: https://bitbucket.org/site/oauth2/authorize?${params.toString()}`);
  return `https://bitbucket.org/site/oauth2/authorize?${params.toString()}`;
}

// ── OAuth callback (step 2) — exchange code for token

interface TokenResult {
  ok: boolean;
  returnTo: string;
  error?: string;
}

export async function handleJiraCallback(code: string, state: string): Promise<TokenResult> {
  const pending = pendingStates.get(state);
  if (!pending || pending.provider !== "jira") {
    return { ok: false, returnTo: "/integrations", error: "Invalid OAuth state" };
  }
  pendingStates.delete(state);

  try {
    const res = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: jiraClientId(),
        client_secret: jiraClientSecret(),
        code,
        redirect_uri: `${baseUrl()}/api/integrations/jira/callback`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, returnTo: pending.returnTo, error: `Token exchange failed: ${err}` };
    }

    const data = (await res.json()) as { access_token?: string; refresh_token?: string };
    if (!data.access_token) {
      return { ok: false, returnTo: pending.returnTo, error: "No access token in response" };
    }

    // Store tokens in DB
    upsertCredential(
      dbRef!,
      credentialName("jira"),
      JSON.stringify({
        type: "oauth",
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt: Date.now() + 3600 * 1000, // 1 hour
      }),
    );

    return { ok: true, returnTo: pending.returnTo };
  } catch (err) {
    return {
      ok: false,
      returnTo: pending.returnTo,
      error: err instanceof Error ? err.message : "Token exchange failed",
    };
  }
}

export async function handleBitbucketCallback(code: string, state: string): Promise<TokenResult> {
  const pending = pendingStates.get(state);
  if (!pending || pending.provider !== "bitbucket") {
    return { ok: false, returnTo: "/integrations", error: "Invalid OAuth state" };
  }
  pendingStates.delete(state);

  try {
    const auth = Buffer.from(`${bitbucketClientId()}:${bitbucketClientSecret()}`).toString("base64");
    const callbackUrl = `${baseUrl()}/api/integrations/bitbucket/callback`;
    const res = await fetch("https://bitbucket.org/site/oauth2/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
      }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, returnTo: pending.returnTo, error: `Token exchange failed: ${err}` };
    }

    const data = (await res.json()) as { access_token?: string; refresh_token?: string };
    if (!data.access_token) {
      return { ok: false, returnTo: pending.returnTo, error: "No access token in response" };
    }

    upsertCredential(
      dbRef!,
      credentialName("bitbucket"),
      JSON.stringify({
        type: "oauth",
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt: Date.now() + 3600 * 1000,
      }),
    );

    return { ok: true, returnTo: pending.returnTo };
  } catch (err) {
    return {
      ok: false,
      returnTo: pending.returnTo,
      error: err instanceof Error ? err.message : "Token exchange failed",
    };
  }
}

// ── DB reference (set by init)
let dbRef: Database.Database | null = null;

export function initOAuth(db: Database.Database): void {
  dbRef = db;
}

// ── Status check
export function isOAuthConnected(provider: string): boolean {
  if (!dbRef) return false;
  try {
    const cred = dbRef.prepare("SELECT value FROM credentials WHERE name = ?").get(credentialName(provider)) as { value: string } | undefined;
    if (!cred) return false;
    const data = JSON.parse(cred.value) as { type: string; accessToken: string };
    return data.type === "oauth" && !!data.accessToken;
  } catch {
    return false;
  }
}

// ── Disconnect
export function disconnectOAuth(provider: string): void {
  if (dbRef) {
    deleteCredential(dbRef, credentialName(provider));
  }
}
