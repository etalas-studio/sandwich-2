import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import { getInstanceSettings } from "../db/settings.js";
import {
  startReadinessScan,
  failReadinessScan,
  getLatestReadinessScan,
} from "../db/readiness-scans.js";
import { sendJson, readJsonBody } from "../http-utils.js";

const inFlight = new Map<string, AbortController>();

export function registerScanRoutes(
  router: Router,
  db: Database.Database,
  runScan: (scanId: string, repoPath: string, signal: AbortSignal, modelId: string | null) => Promise<void>,
): void {
  router.post("/api/scans/run", async (req, res) => {
    const settings = getInstanceSettings(db);
    if (!settings.repoPath) {
      sendJson(res, 503, { error: "No project configured. Set a repository path in Settings first." });
      return;
    }

    // Only one scan at a time
    if (inFlight.size > 0) {
      sendJson(res, 409, { error: "A scan is already in progress. Wait for it to finish or abort it first." });
      return;
    }

    // Read optional modelId from body
    let modelId: string | null = null;
    try {
      const body = await readJsonBody(req);
      if (body && typeof (body as Record<string, unknown>).modelId === "string") {
        modelId = (body as Record<string, unknown>).modelId as string;
      }
    } catch {
      // body is optional
    }

    const scanId = randomUUID();
    startReadinessScan(db, scanId);

    const controller = new AbortController();
    inFlight.set(scanId, controller);

    // Fire-and-forget the scan
    runScan(scanId, settings.repoPath, controller.signal, modelId)
      .catch((_err) => {
        failReadinessScan(db, scanId);
      })
      .finally(() => {
        inFlight.delete(scanId);
      });

    sendJson(res, 200, { scanId });
  });

  router.get("/api/scans/latest", (_req, res) => {
    const scan = getLatestReadinessScan(db);
    sendJson(res, 200, scan);
  });

  router.post("/api/scans/abort", async (req, res) => {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }
    const scanId = (body as Record<string, unknown> | null)?.["scanId"];
    if (typeof scanId !== "string") {
      sendJson(res, 400, { error: "scanId is required" });
      return;
    }

    const controller = inFlight.get(scanId);
    if (!controller) {
      sendJson(res, 404, { error: "No in-flight scan with that ID" });
      return;
    }

    controller.abort();
    sendJson(res, 200, { aborted: true });
  });
}
