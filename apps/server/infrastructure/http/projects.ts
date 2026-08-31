import type { Router } from "../../router.js";
import type { HttpDeps } from "./types.js";
import { authenticateRequest } from "../../auth/middleware.js";
import { sendJson, sendCaughtError, readJsonBody } from "../../http-utils.js";
import {
  listProjects,
  getProject,
  renameProject,
  deleteProject,
} from "../../projects/db.js";
import { ProjectNotEmptyError } from "../../projects/db.js";

export function registerProjectRoutes(router: Router, deps: HttpDeps): void {
  const db = deps.db;

  router.get("/api/projects", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    sendJson(res, 200, await listProjects(db, auth.userId));
  });

  router.get("/api/projects/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const project = await getProject(db, auth.userId, params.id!);
    if (!project) {
      sendJson(res, 404, { error: "project not found" });
      return;
    }
    sendJson(res, 200, project);
  });

  router.patch("/api/projects/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const body = (await readJsonBody(req).catch(() => null)) as {
      title?: unknown;
    } | null;
    if (!body || typeof body.title !== "string" || body.title.trim() === "") {
      sendJson(res, 400, { error: "title required" });
      return;
    }
    const project = await renameProject(db, auth.userId, params.id!, body.title.trim());
    if (!project) {
      sendJson(res, 404, { error: "project not found" });
      return;
    }
    sendJson(res, 200, project);
  });

  router.delete("/api/projects/:id", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    try {
      const deleted = await deleteProject(db, auth.userId, params.id!);
      if (!deleted) {
        sendJson(res, 404, { error: "project not found" });
        return;
      }
      res.writeHead(204).end();
    } catch (err) {
      if (err instanceof ProjectNotEmptyError) {
        sendJson(res, 409, { error: "project still has conversations" });
        return;
      }
      sendCaughtError(res, err, "project deletion");
    }
  });
}
