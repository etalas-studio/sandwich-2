import type { Router } from "../router.js";
import { startJiraAuth, startBitbucketAuth, startGithubAuth, handleJiraCallback, handleBitbucketCallback, handleGithubCallback } from "../pipeline/oauth-integrations.js";

export function registerOAuthRoutes(router: Router): void {
  // ── Jira OAuth ──
  router.get("/api/integrations/jira/authorize", (_req, res) => {
    const returnTo = "/integrations";
    const url = startJiraAuth(returnTo);
    res.writeHead(302, { Location: url });
    res.end();
  });

  router.get("/api/integrations/jira/callback", async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost`);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      res.writeHead(302, { Location: "/integrations?error=missing_code_or_state" });
      res.end();
      return;
    }

    const result = await handleJiraCallback(code, state);

    const redirect = new URL(result.returnTo, `http://localhost`);
    if (!result.ok) {
      redirect.searchParams.set("error", result.error ?? "oauth_failed");
    } else {
      redirect.searchParams.set("connected", "jira");
    }

    res.writeHead(302, { Location: redirect.pathname + redirect.search });
    res.end();
  });

  // ── Bitbucket OAuth ──
  router.get("/api/integrations/bitbucket/authorize", (_req, res) => {
    const returnTo = "/integrations";
    const url = startBitbucketAuth(returnTo);
    res.writeHead(302, { Location: url });
    res.end();
  });

  router.get("/api/integrations/bitbucket/callback", async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost`);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      res.writeHead(302, { Location: "/integrations?error=missing_code_or_state" });
      res.end();
      return;
    }

    const result = await handleBitbucketCallback(code, state);

    const redirect = new URL(result.returnTo, `http://localhost`);
    if (!result.ok) {
      redirect.searchParams.set("error", result.error ?? "oauth_failed");
    } else {
      redirect.searchParams.set("connected", "bitbucket");
    }

    res.writeHead(302, { Location: redirect.pathname + redirect.search });
    res.end();
  });

  // ── GitHub OAuth ──
  router.get("/api/integrations/github/authorize", (_req, res) => {
    const returnTo = "/integrations";
    const url = startGithubAuth(returnTo);
    res.writeHead(302, { Location: url });
    res.end();
  });

  router.get("/api/integrations/github/callback", async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost`);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      res.writeHead(302, { Location: "/integrations?error=missing_code_or_state" });
      res.end();
      return;
    }

    const result = await handleGithubCallback(code, state);

    const redirect = new URL(result.returnTo, `http://localhost`);
    if (!result.ok) {
      redirect.searchParams.set("error", result.error ?? "oauth_failed");
    } else {
      redirect.searchParams.set("connected", "github");
    }

    res.writeHead(302, { Location: redirect.pathname + redirect.search });
    res.end();
  });
}
