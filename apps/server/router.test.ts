import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Router } from "./router.js";

function mockReq(method: string, path: string, headers: Record<string, string> = {}): any {
  return {
    method,
    url: path,
    headers: { host: "127.0.0.1:0", ...headers },
    socket: { localPort: 0 },
    on: () => {},
  };
}
function mockRes(): any {
  const res: any = { statusCode: 0, body: "", headers: {} };
  res.writeHead = (status: number, headers?: any) => {
    res.statusCode = status;
    if (headers) Object.assign(res.headers, headers);
  };
  res.end = (payload?: string) => {
    if (payload !== undefined) res.body = payload;
  };
  res.destroy = () => {};
  return res;
}

describe("Router", () => {
  it("matches exact GET paths", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.get("/api/test", (_req, res, _params) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await router.dispatch(mockReq("GET", "/api/test"), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { ok: true });
  });

  it("matches exact POST paths", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.post("/api/test", (_req, res, _params) => {
      res.writeHead(201);
      res.end(JSON.stringify({ created: true }));
    });
    await router.dispatch(mockReq("POST", "/api/test"), res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(JSON.parse(res.body), { created: true });
  });

  it("returns 404 for unmatched paths", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    await router.dispatch(mockReq("GET", "/api/nope"), res);
    assert.equal(res.statusCode, 404);
    assert.ok((res.headers["content-type"] ?? "").includes("application/json"));
    assert.deepEqual(JSON.parse(res.body), { error: "not found" });
  });

  it("returns 405 for wrong method on existing path", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.get("/api/test", (_req, res, _params) => {
      res.writeHead(200);
      res.end("ok");
    });
    await router.dispatch(mockReq("POST", "/api/test"), res);
    assert.equal(res.statusCode, 405);
  });

  it("extracts :param segments", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.get("/api/integrations/:id/status", (_req, res, params) => {
      res.writeHead(200);
      res.end(JSON.stringify({ id: params.id }));
    });
    await router.dispatch(mockReq("GET", "/api/integrations/opencode-go/status"), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { id: "opencode-go" });
  });

  it("returns 404 when :param prefix mismatches", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.get("/api/integrations/:id/connect", (_req, res, _params) => {
      res.writeHead(200);
      res.end("ok");
    });
    await router.dispatch(mockReq("GET", "/api/other/x/connect"), res);
    assert.equal(res.statusCode, 404);
  });

  it("runs middleware, stops when it returns false", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    let middlewareRan = false;
    router.use((_req, res) => {
      middlewareRan = true;
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "blocked" }));
      return false;
    });
    let handlerRan = false;
    router.get("/api/test", () => {
      handlerRan = true;
    });
    await router.dispatch(mockReq("GET", "/api/test"), res);
    assert.equal(middlewareRan, true);
    assert.equal(handlerRan, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(JSON.parse(res.body), { error: "blocked" });
  });

  it("runs middleware, continues when it returns void", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    let middlewareRan = false;
    router.use(() => {
      middlewareRan = true;
    });
    let handlerRan = false;
    router.get("/api/test", (_req, res, _params) => {
      handlerRan = true;
      res.writeHead(200);
      res.end("ok");
    });
    await router.dispatch(mockReq("GET", "/api/test"), res);
    assert.equal(middlewareRan, true);
    assert.equal(handlerRan, true);
  });

  it("catches thrown errors and responds 500", async () => {
    const router = new Router(new Set(), 0);
    const res = mockRes();
    router.get("/api/test", () => {
      throw new Error("boom");
    });
    await router.dispatch(mockReq("GET", "/api/test"), res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(JSON.parse(res.body), { error: "internal error" });
  });

  it("rejects untrusted Host header with 403", async () => {
    const router = new Router(new Set(), 4319);
    const res = mockRes();
    router.get("/api/test", (_req, res, _params) => {
      res.writeHead(200);
      res.end("ok");
    });
    await router.dispatch(mockReq("GET", "/api/test", { host: "evil.example" }), res);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(JSON.parse(res.body), { error: "forbidden" });
  });
});
