import { existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, isAbsolute } from "node:path";
import { AuthError } from "./auth/service.js";

export const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

/** Request bodies here are all small JSON payloads; anything larger is an unbounded-memory vector. */
export const MAX_BODY_BYTES = 64 * 1024;

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(payload);
}

/** Sends the right status for a caught error: AuthError's own status, or a logged 500. */
export function sendCaughtError(res: ServerResponse, err: unknown, context: string): void {
  if (err instanceof AuthError) {
    sendJson(res, err.status, { error: err.message });
    return;
  }
  console.error(`${context} failed:`, err);
  sendJson(res, 500, { error: "internal error" });
}

/**
 * `decodeURIComponent` throws `URIError` on malformed percent-encoding
 * (e.g. `/api/tickets/%E0%A4%A/artifacts`). Inside the request listener an
 * uncaught throw kills the whole process — including any in-flight
 * runPipeline call, orphaning a real agent subprocess — so every call site
 * goes through this and answers 400 instead.
 */
export function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const onData = (chunk: Buffer): void => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        // Drop what we buffered and switch to flowing-drain mode: memory stays
        // bounded, but the socket stays readable so the 413 actually reaches
        // the client instead of being lost to an abrupt destroy().
        chunks.length = 0;
        req.removeListener("data", onData);
        req.resume();
        reject(new AuthError(413, "request body too large"));
        return;
      }
      chunks.push(chunk);
    };

    req.on("data", onData);
    req.on("end", () => {
      if (settled) return;
      settled = true;
      // Concat then decode once — decoding per chunk can split a multi-byte
      // UTF-8 sequence across a chunk boundary and corrupt the JSON.
      const body = Buffer.concat(chunks).toString("utf8");
      if (!body) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(body));
      } catch {
        reject(new AuthError(400, "invalid JSON body"));
      }
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

/**
 * Validates a human-supplied project folder before storing it as the
 * first-run repo path: must be an absolute path, must exist, must be a
 * directory, and must actually be a git repo (has a .git entry) — a
 * pipeline run against a non-repo directory would fail confusingly deep
 * inside git.ts instead of here, at the point the human chose it.
 */
export function validateRepoPath(
  candidate: unknown,
): { ok: true; repoPath: string } | { ok: false; error: string } {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return { ok: false, error: "repoPath is required" };
  }
  const repoPath = candidate.trim();
  if (!isAbsolute(repoPath)) {
    return { ok: false, error: "repoPath must be an absolute path" };
  }
  if (!existsSync(repoPath)) {
    return { ok: false, error: `no such directory: ${repoPath}` };
  }
  if (!statSync(repoPath).isDirectory()) {
    return { ok: false, error: `not a directory: ${repoPath}` };
  }
  if (!existsSync(join(repoPath, ".git"))) {
    return { ok: false, error: `not a git repository (no .git found in ${repoPath})` };
  }
  return { ok: true, repoPath };
}
