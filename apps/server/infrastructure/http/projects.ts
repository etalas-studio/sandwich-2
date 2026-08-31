import type { Router } from "express";
import type { HttpDeps } from "./types.js";
import { authenticateRequest } from "../../auth/middleware.js";
import { sendCaughtErrorExpress } from "../../http-utils.js";
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
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.status(200).json(await listProjects(db, auth.userId));
  });

  router.get("/api/projects/:id", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const project = await getProject(db, auth.userId, req.params.id!);
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    res.status(200).json(project);
  });

  router.patch("/api/projects/:id", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as {
      title?: unknown;
    } | null;
    if (!body || typeof body.title !== "string" || body.title.trim() === "") {
      res.status(400).json({ error: "title required" });
      return;
    }
    const project = await renameProject(db, auth.userId, req.params.id!, body.title.trim());
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    res.status(200).json(project);
  });

  router.delete("/api/projects/:id", async (req, res) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const deleted = await deleteProject(db, auth.userId, req.params.id!);
      if (!deleted) {
        res.status(404).json({ error: "project not found" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      if (err instanceof ProjectNotEmptyError) {
        res.status(409).json({ error: "project still has conversations" });
        return;
      }
      sendCaughtErrorExpress(res, err, "project deletion");
    }
  });
}
