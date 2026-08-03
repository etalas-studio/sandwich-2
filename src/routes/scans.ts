import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Router } from "../router.js";
import { getInstanceSettings } from "../db/settings.js";
import {
  startReadinessScan,
  getLatestReadinessScan,
} from "../db/readiness-scans.js";
import { sendJson, readJsonBody } from "../http-utils.js";

const inFlight = new Map<string, AbortController>();

export function registerScanRoutes(
  router: Router,
  db: Database.Database,
  runScan: (scanId: string, repoPath: string, signal: AbortSignal) => Promise<void>,
): void {
  router.post("/api/scans/run", async (_req, res) => {
    const settings = getInstanceSettings(db);
    if (!settings.repoPath) {
      sendJson(res, 503, { error: "No project configured. Set a repository path in Settings first." });
      return;
    }

    const scanId = randomUUID();
    startReadinessScan(db, scanId);

    const controller = new AbortController();
    inFlight.set(scanId, controller);

    // Fire-and-forget the scan
    runScan(scanId, settings.repoPath, controller.signal)
      .catch((err) => {
        console.error("Scan failed:", err);
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
