import type { Router } from "../router.js";
import {
  getIntegrationStatus,
  connectWithApiKey,
  disconnectApiKey,
} from "../pipeline/integrations.js";
import {
  sendJson,
  sendCaughtError,
  readJsonBody,
} from "../http-utils.js";

export function registerIntegrationRoutes(router: Router): void {
  router.get("/api/integrations", async (_req, res) => {
    try {
      const status = await getIntegrationStatus();
      sendJson(res, 200, status);
    } catch (err) {
      sendCaughtError(res, err, "integrations list");
    }
  });

  router.post("/api/integrations/:providerId/connect", async (req, res, params) => {
    const providerId = params.providerId!;
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendCaughtError(res, err, "integration connect");
      return;
    }
    const apiKey = (body as Record<string, unknown> | null)?.["apiKey"];
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      sendJson(res, 400, { error: "apiKey is required" });
      return;
    }
    try {
      const result = await connectWithApiKey(providerId, apiKey.trim());
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (err) {
      sendCaughtError(res, err, "integration connect");
    }
  });

  router.post("/api/integrations/:providerId/disconnect", async (_req, res, params) => {
    const providerId = params.providerId!;
    try {
      const result = await disconnectApiKey(providerId);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (err) {
      sendCaughtError(res, err, "integration disconnect");
    }
  });
}
