import type { Router } from "../router.js";
import { authenticateRequest } from "../auth/middleware.js";
import { setPreference, getPreference } from "../db/repo/user-preferences.js";
import { sendJson, readJsonBody } from "../http-utils.js";
import type { Database } from "../db/connection.js";

export function registerPreferenceRoutes(router: Router, db: Database): void {
  router.get("/api/preferences/:key", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const value = await getPreference(db, auth.userId, params.key!);
    sendJson(res, 200, { key: params.key, value });
  });

  router.put("/api/preferences/:key", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const body = (await readJsonBody(req).catch(() => null)) as {
      value?: string;
    } | null;
    if (!body || body.value === undefined) {
      sendJson(res, 400, { error: "value is required" });
      return;
    }
    await setPreference(db, auth.userId, params.key!, body.value);
    sendJson(res, 200, { key: params.key, value: body.value });
  });
}
