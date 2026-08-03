import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { Router } from "../router.js";
import { registerTicketRoutes } from "./tickets.js";

function mockReq(method: string, path: string, headers: Record<string, string> = {}): any {
  return { method, url: path, headers: { host: "127.0.0.1:0", ...headers }, on: () => {} };
}
function mockRes(): any {
  const res: any = { statusCode: 0, body: "", headers: {} };
  res.writeHead = (s: number, h?: any) => { res.statusCode = s; if (h) Object.assign(res.headers, h); };
  res.end = (p?: string) => { if (p !== undefined) res.body = p; };
  res.destroy = () => {};
  return res;
}

function mockJsonReq(method: string, path: string, body: unknown): any {
  const chunks = [Buffer.from(JSON.stringify(body))];
  return {
    method,
    url: path,
    headers: { host: "127.0.0.1:0", "content-type": "application/json" },
    on: (ev: string, fn: Function) => {
      if (ev === "data") chunks.forEach((c) => fn(c));
      if (ev === "end") fn();
    },
  };
}

describe("ticket routes", () => {
  let db: ReturnType<typeof openDb>;
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "ticket-routes-test-"));
    db = openDb(join(tmpDir, "db.sqlite"));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("POST /api/tickets creates a ticket", async () => {
    const router = new Router(new Set(), 0);
    registerTicketRoutes(router, db);
    const res = mockRes();
    await router.dispatch(
      mockJsonReq("POST", "/api/tickets", {
        key: "RR-7000",
        summary: "Test ticket",
        description: "A test description.",
        url: "https://runchise.atlassian.net/browse/RR-7000",
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.key, "RR-7000");
    assert.equal(body.summary, "Test ticket");
    assert.equal(body.status, "backlog");
  });

  it("POST /api/tickets rejects missing key", async () => {
    const router = new Router(new Set(), 0);
    registerTicketRoutes(router, db);
    const res = mockRes();
    await router.dispatch(
      mockJsonReq("POST", "/api/tickets", {
        summary: "No key",
        description: "Missing the key field.",
      }),
      res,
    );
    assert.equal(res.statusCode, 400);
    assert.ok(JSON.parse(res.body).error.includes("key"));
  });

  it("POST /api/tickets rejects empty body", async () => {
    const router = new Router(new Set(), 0);
    registerTicketRoutes(router, db);
    const res = mockRes();
    const req: any = {
      method: "POST",
      url: "/api/tickets",
      headers: { host: "127.0.0.1:0", "content-type": "application/json" },
      on: (ev: string, fn: Function) => {
        if (ev === "data") fn(Buffer.from(""));
        if (ev === "end") fn();
      },
    };
    await router.dispatch(req, res);
    assert.equal(res.statusCode, 400);
  });

  it("GET /api/tickets lists tickets", async () => {
    const router = new Router(new Set(), 0);
    registerTicketRoutes(router, db);
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/tickets"), res);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body));
  });
});
