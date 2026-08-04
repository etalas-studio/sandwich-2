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
function githubClientId(): string {
  return process.env.GITHUB_CLIENT_ID ?? "";
}
function githubClientSecret(): string {
  return process.env.GITHUB_CLIENT_SECRET ?? "";
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
    scope: "account repository pullrequest",
    state,
    redirect_uri: callbackUrl,
  });
  return `https://bitbucket.org/site/oauth2/authorize?${params.toString()}`;
}

export function startGithubAuth(returnTo: string): string {
  const state = `gh-${randomUUID()}`;
  pendingStates.set(state, { provider: "github", returnTo });

  const params = new URLSearchParams({
    client_id: githubClientId(),
    scope: "repo",
    redirect_uri: `${baseUrl()}/api/integrations/github/callback`,
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
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

export async function handleGithubCallback(code: string, state: string): Promise<TokenResult> {
  const pending = pendingStates.get(state);
  if (!pending || pending.provider !== "github") {
    return { ok: false, returnTo: "/integrations", error: "Invalid OAuth state" };
  }
  pendingStates.delete(state);

  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: githubClientId(),
        client_secret: githubClientSecret(),
        code,
        redirect_uri: `${baseUrl()}/api/integrations/github/callback`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, returnTo: pending.returnTo, error: `Token exchange failed: ${err}` };
    }

    const data = (await res.json()) as { access_token?: string; error?: string };
    if (!data.access_token) {
      return { ok: false, returnTo: pending.returnTo, error: data.error ?? "No access token in response" };
    }

    // GitHub OAuth App tokens (unlike Jira/Bitbucket) don't expire and carry
    // no refresh token — see docs/superpowers/specs/2026-08-04-project-selection-design.md
    // "Known gaps" for why only Bitbucket needs refresh handling.
    upsertCredential(
      dbRef!,
      credentialName("github"),
      JSON.stringify({
        type: "oauth",
        accessToken: data.access_token,
        refreshToken: null,
        expiresAt: null,
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

// ── Get stored OAuth token
export function getOAuthToken(provider: string): string | null {
  if (!dbRef) return null;
  try {
    const cred = dbRef.prepare("SELECT value FROM credentials WHERE name = ?").get(credentialName(provider)) as { value: string } | undefined;
    if (!cred) return null;
    const data = JSON.parse(cred.value) as { type: string; accessToken: string };
    return data.type === "oauth" ? data.accessToken : null;
  } catch {
    return null;
  }
}

interface StoredOAuthCredential {
  type: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

function getStoredOAuthCredential(provider: string): StoredOAuthCredential | null {
  if (!dbRef) return null;
  try {
    const cred = dbRef.prepare("SELECT value FROM credentials WHERE name = ?").get(credentialName(provider)) as { value: string } | undefined;
    if (!cred) return null;
    const data = JSON.parse(cred.value) as StoredOAuthCredential;
    return data.type === "oauth" ? data : null;
  } catch {
    return null;
  }
}

/**
 * Like getOAuthToken, but refreshes the Bitbucket access token first if it's
 * expired (GitHub App tokens never expire, so this is a no-op passthrough
 * for github). Fixes the "Reconnect" prompt every ~1h documented as a known
 * gap in docs/superpowers/specs/2026-08-04-project-selection-design.md.
 */
export async function getValidOAuthToken(provider: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  const cred = getStoredOAuthCredential(provider);
  if (!cred) return null;

  const isExpired = cred.expiresAt !== null && Date.now() >= cred.expiresAt;
  if (!isExpired || provider !== "bitbucket" || !cred.refreshToken) {
    return cred.accessToken;
  }

  try {
    const auth = Buffer.from(`${bitbucketClientId()}:${bitbucketClientSecret()}`).toString("base64");
    const res = await fetchFn("https://bitbucket.org/site/oauth2/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: cred.refreshToken,
      }).toString(),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { access_token?: string; refresh_token?: string };
    if (!data.access_token) return null;

    upsertCredential(
      dbRef!,
      credentialName("bitbucket"),
      JSON.stringify({
        type: "oauth",
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? cred.refreshToken,
        expiresAt: Date.now() + 3600 * 1000,
      }),
    );
    return data.access_token;
  } catch {
    return null;
  }
}

// ── ADF → plain text
export function adfToText(adf: unknown): string {
  if (!adf || typeof adf !== "object") return "";
  const doc = adf as Record<string, unknown>;
  if (doc.type !== "doc") return "";
  return extractText(doc);
}

function extractText(node: Record<string, unknown>): string {
  if (node.type === "text") return String(node.text ?? "");
  const content = node.content as Array<Record<string, unknown>> | undefined;
  if (!content) return "";
  return content.map(extractText).join(" ");
}

// ── Pull Jira issues and import as tickets
export interface PullResult {
  ok: boolean;
  imported: number;
  skipped: number;
  error?: string;
}

export async function pullJiraTickets(projectKey: string): Promise<PullResult> {
  if (!dbRef) return { ok: false, imported: 0, skipped: 0, error: "DB not initialized" };

  const token = getOAuthToken("jira");
  if (!token) return { ok: false, imported: 0, skipped: 0, error: "Jira not connected" };

  // Get cloudId
  let cloudId: string;
  try {
    const res = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sites = (await res.json()) as Array<{ id: string; url: string }> | null;
    if (!sites || !sites.length) return { ok: false, imported: 0, skipped: 0, error: "No Jira sites accessible" };
    cloudId = sites[0]!.id;
  } catch {
    return { ok: false, imported: 0, skipped: 0, error: "Failed to get cloudId" };
  }

  // Fetch issues
  let issues: Array<Record<string, unknown>>;
  try {
    const res = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql?jql=project%3D${projectKey}+ORDER+BY+created+DESC&maxResults=50&fields=*all`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = (await res.json()) as { issues?: Array<Record<string, unknown>> };
    issues = data.issues ?? [];
  } catch (err) {
    return { ok: false, imported: 0, skipped: 0, error: err instanceof Error ? err.message : "Search failed" };
  }

  const now = new Date().toISOString();
  let imported = 0;
  let skipped = 0;

  const insert = dbRef.prepare(
    `INSERT OR IGNORE INTO tickets (key, summary, description, url, status,
      issue_type, priority, sprint, story_points, team, assignee, parent_key, attachments,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, 'backlog',
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?)`,
  );

  for (const issue of issues) {
    const fields = (issue.fields ?? {}) as Record<string, unknown>;
    const key = String(issue.key ?? "");

    // Check if already imported
    const existing = dbRef.prepare("SELECT key FROM tickets WHERE key = ?").get(key);
    if (existing) { skipped++; continue; }

    const description = adfToText(fields.description);
    const summary = String(fields.summary ?? "");
    const issueUrl = `https://runchise.atlassian.net/browse/${key}`;

    const issueType = (fields.issuetype as Record<string, unknown> | null)?.name ?? null;
    const priority = (fields.priority as Record<string, unknown> | null)?.name ?? null;
    const labels = Array.isArray(fields.labels) ? JSON.stringify(fields.labels) : null;
    const components = Array.isArray(fields.components)
      ? JSON.stringify((fields.components as Array<Record<string, unknown>>).map((c) => c.name))
      : null;

    // Sprint
    const sprints = fields.customfield_10020 as Array<Record<string, unknown>> | undefined;
    const sprint = sprints?.length ? String(sprints[sprints.length - 1]!.name ?? "") : null;

    // Story points
    const storyPoints = fields.customfield_10016 != null ? Number(fields.customfield_10016) : null;

    // Team
    const team = (fields.customfield_10001 as Record<string, unknown> | null)?.name ?? null;

    // Assignee
    const assignee = (fields.assignee as Record<string, unknown> | null)?.displayName ?? null;

    // Parent
    const parent = (fields.parent as Record<string, unknown> | null)?.key ?? null;

    // Attachments
    const attachments = Array.isArray(fields.attachment)
      ? JSON.stringify(
          (fields.attachment as Array<Record<string, unknown>>).map((a) => ({
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
            url: a.content,
          })),
        )
      : null;

    insert.run(
      key, summary || null, description, issueUrl,
      issueType, priority || null, sprint, storyPoints, team, assignee, parent,
      attachments, now, now,
    );
    imported++;
  }

  return { ok: true, imported, skipped };
}
