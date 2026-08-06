import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import { createTicket, listTickets, updateTicket, deleteTicket, getTicket } from "../db/tickets.js";
import type { CreateTicketInput, UpdateTicketInput } from "../db/tickets.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";
import { pullJiraTickets, previewJiraTickets, pullJiraTicketsFiltered, getOAuthToken } from "../pipeline/oauth-integrations.js";
import { executePr } from "../pipeline/ticket-runner.js";
import { getProjectRepoPath } from "../db/project.js";

export function registerTicketRoutes(router: Router, db: Database.Database): void {
  router.post("/api/tickets", async (req, res) => {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendCaughtError(res, err, "ticket creation");
      return;
    }

    const candidate = body as Record<string, unknown> | null;
    if (!candidate || typeof candidate !== "object") {
      sendJson(res, 400, { error: "body must be a JSON object" });
      return;
    }

    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const summary =
      typeof candidate.summary === "string" && candidate.summary.trim() !== ""
        ? candidate.summary.trim()
        : undefined;
    const description =
      typeof candidate.description === "string" ? candidate.description.trim() : "";
    const url =
      typeof candidate.url === "string" && candidate.url.trim() !== ""
        ? candidate.url.trim()
        : null;

    if (!description) {
      sendJson(res, 400, { error: "description is required" });
      return;
    }

    const input: CreateTicketInput = { id, summary, description, url };

    try {
      const ticket = createTicket(db, input);
      sendJson(res, 201, ticket);
    } catch (err) {
      sendCaughtError(res, err, "ticket creation");
    }
  });

  router.get("/api/tickets", (_req, res) => {
    sendJson(res, 200, listTickets(db));
  });

  router.put("/api/tickets/:key", async (req, res, params) => {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendCaughtError(res, err, "ticket update");
      return;
    }

    const candidate = body as Record<string, unknown> | null;
    if (!candidate || typeof candidate !== "object") {
      sendJson(res, 400, { error: "body must be a JSON object" });
      return;
    }

    const input: UpdateTicketInput = {};
    if (typeof candidate.summary === "string") input.summary = candidate.summary.trim() || null;
    if (typeof candidate.description === "string") input.description = candidate.description.trim();
    if (typeof candidate.url === "string") input.url = candidate.url.trim() || null;
    if (typeof candidate.status === "string") input.status = candidate.status;

    const ticket = updateTicket(db, params.key!, input);
    if (!ticket) {
      sendJson(res, 404, { error: "ticket not found" });
      return;
    }
    sendJson(res, 200, ticket);
  });

  router.delete("/api/tickets/:key", (_req, res, params) => {
    const deleted = deleteTicket(db, params.key!);
    if (!deleted) {
      sendJson(res, 404, { error: "ticket not found" });
      return;
    }
    sendJson(res, 200, { deleted: true });
  });

  // Proxy Jira attachment content through the server's OAuth token.
  // Attachments are stored with Jira API content URLs that require auth;
  // browsers don't have the token, so we fetch on their behalf.
  router.get("/api/tickets/:key/attachments/:index", async (req, res, params) => {
    try {
      const ticket = getTicket(db, params.key!);
      if (!ticket) {
        sendJson(res, 404, { error: "ticket not found" });
        return;
      }

      const index = Number(params.index);
      if (!Number.isFinite(index) || index < 0) {
        sendJson(res, 400, { error: "invalid attachment index" });
        return;
      }

      let attachments: Array<{ filename: string; mimeType: string; size: number; url: string }>;
      try {
        attachments = JSON.parse(ticket.attachments ?? "[]");
      } catch {
        sendJson(res, 400, { error: "invalid attachments data" });
        return;
      }

      if (!Array.isArray(attachments) || index >= attachments.length) {
        sendJson(res, 404, { error: "attachment not found" });
        return;
      }

      const attachment = attachments[index]!;
      const contentUrl = attachment.url;

      // Get Jira OAuth token
      const token = getOAuthToken("jira");
      if (!token) {
        sendJson(res, 502, { error: "Jira not connected" });
        return;
      }

      // Build the Jira URL. If the stored content URL already uses the OAuth
      // gateway (api.atlassian.com), use it directly. Otherwise extract the
      // attachment ID and route through the gateway.
      let jiraUrl: string;
      if (contentUrl.includes("api.atlassian.com")) {
        // Already a gateway URL — use as-is (without redirect to get content directly)
        jiraUrl = contentUrl.includes("?") ? `${contentUrl}&redirect=false` : `${contentUrl}?redirect=false`;
      } else {
        // Instance URL (e.g. runchise.atlassian.net) — extract ID and go through gateway
        let attachmentId: string;
        try {
          const pathname = new URL(contentUrl).pathname;
          const segments = pathname.split("/").filter(Boolean);
          attachmentId = segments[segments.length - 1]!;
        } catch {
          sendJson(res, 400, { error: "invalid attachment URL" });
          return;
        }

        // Get cloudId
        let cloudId: string;
        try {
          const arRes = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const sites = (await arRes.json()) as Array<{ id: string }> | null;
          if (!sites?.length) {
            sendJson(res, 502, { error: "no Jira sites accessible" });
            return;
          }
          cloudId = sites[0]!.id;
        } catch {
          sendJson(res, 502, { error: "failed to reach Jira" });
          return;
        }

        jiraUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/attachment/content/${attachmentId}?redirect=false`;
      }

      let jiraRes: Response;
      try {
        jiraRes = await fetch(jiraUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        sendJson(res, 502, { error: "failed to fetch attachment from Jira" });
        return;
      }

      if (!jiraRes.ok) {
        const errBody = await jiraRes.text().catch(() => "<unreadable>");
        console.error(`Jira attachment proxy error: ${jiraRes.status} for ${jiraUrl}`);
        console.error(`Jira response body: ${errBody}`);
        sendJson(res, 502, { error: `Jira returned ${jiraRes.status}: ${errBody.slice(0, 200)}` });
        return;
      }

      // Stream the binary content back to the browser
      const contentType = jiraRes.headers.get("content-type") ?? attachment.mimeType ?? "application/octet-stream";
      const contentLength = jiraRes.headers.get("content-length");
      const headers: Record<string, string> = {
        "content-type": contentType,
        "cache-control": "private, max-age=300",
        "content-disposition": `inline; filename="${attachment.filename.replace(/"/g, "\\\"")}"`,
      };
      if (contentLength) {
        headers["content-length"] = contentLength;
      }

      res.writeHead(200, headers);

      // Stream the body
      if (jiraRes.body) {
        const reader = jiraRes.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } finally {
          reader.releaseLock();
        }
      }

      res.end();
    } catch (err) {
      sendCaughtError(res, err, "attachment proxy");
    }
  });

  router.get("/api/tickets/pull/preview", async (req, res) => {
    try {
      const url = new URL(req.url!, `http://${req.headers.host ?? "localhost"}`);
      const result = await previewJiraTickets({
        projectKey: "RR",
        search: url.searchParams.get("search") || undefined,
        status: url.searchParams.get("status") || undefined,
        issueType: url.searchParams.get("issueType") || undefined,
        priority: url.searchParams.get("priority") || undefined,
        assignee: url.searchParams.get("assignee") || undefined,
        sprint: url.searchParams.get("sprint") || undefined,
        startAt: url.searchParams.has("startAt") ? Number(url.searchParams.get("startAt")) : undefined,
        maxResults: url.searchParams.has("maxResults") ? Number(url.searchParams.get("maxResults")) : undefined,
      });
      if (!result.ok) {
        sendJson(res, 400, { error: result.error });
        return;
      }
      sendJson(res, 200, { issues: result.issues, total: result.total, startAt: result.startAt });
    } catch (err) {
      sendCaughtError(res, err, "preview tickets");
    }
  });

  router.post("/api/tickets/pull", async (_req, res) => {
    try {
      let body: { keys?: string[] } | null = null;
      try {
        body = await readJsonBody(_req) as { keys?: string[] } | null;
      } catch { /* no body */ }

      let result: { ok: boolean; imported: number; skipped: number; error?: string };
      if (body?.keys && body.keys.length > 0) {
        result = await pullJiraTicketsFiltered("RR", body.keys);
      } else {
        result = await pullJiraTickets("RR");
      }
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (err) {
      sendCaughtError(res, err, "pull tickets");
    }
  });

  router.post("/api/tickets/:key/open-pr", async (req, res, params) => {
    const ticketKey = params.key!;
    const ticket = getTicket(db, ticketKey);
    if (!ticket) {
      sendJson(res, 404, { error: "ticket not found" });
      return;
    }
    if (ticket.status !== "done") {
      sendJson(res, 400, { error: "ticket must be in done status to open a PR" });
      return;
    }
    if (!ticket.prTitle || !ticket.prDescription) {
      sendJson(res, 400, { error: "PR content not available — re-run the ticket with auto-PR enabled" });
      return;
    }

    const reposDir = process.env.REPOS_DIR || "/tmp/runchise-repos";
    const repoPath = getProjectRepoPath(db, reposDir);
    if (!repoPath) {
      sendJson(res, 400, { error: "No project configured or clone not ready" });
      return;
    }

    try {
      const prUrl = await executePr(db, ticketKey, repoPath, ticket.prTitle, ticket.prDescription);
      const updated = getTicket(db, ticketKey);
      sendJson(res, 200, { prUrl, ticket: updated });
    } catch (err) {
      sendCaughtError(res, err, "open-pr");
    }
  });
}
