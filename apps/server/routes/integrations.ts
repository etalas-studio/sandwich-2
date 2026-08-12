import type { Router } from "../router.js";
import { getIntegrationStatus } from "../pipeline/integrations.js";
import { sendJson } from "../http-utils.js";

export function registerIntegrationRoutes(router: Router): void {
  router.get("/api/integrations", (_req, res) => {
    sendJson(res, 200, getIntegrationStatus());
  });
}
