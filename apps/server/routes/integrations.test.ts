import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Router } from "../router.js";
import { registerIntegrationRoutes } from "./integrations.js";

function mockReq(
  method: string,
  path: string,
  headers: Record<string, string> = {},
): any {
  return {
    method,
    url: path,
    headers: { host: "127.0.0.1:0", ...headers },
    on: () => {},
  };
}

function mockRes(): any {
  const res: any = { statusCode: 0, body: "", headers: {} };
  let _resolve: () => void;
  res.ended = new Promise<void>((r) => {
    _resolve = r;
  });
  res.writeHead = (s: number, h?: any) => {
    res.statusCode = s;
    if (h) Object.assign(res.headers, h);
  };
  res.end = (p?: string) => {
    if (p !== undefined) res.body = p;
    _resolve();
  };
  res.destroy = () => {
    _resolve();
  };
  return res;
}

describe("integrations routes", () => {
  describe("GET /api/integrations", () => {
    it("returns opencode-go and groq status", async () => {
      const router = new Router(new Set(), 0);
      registerIntegrationRoutes(router);
      const res = mockRes();

      await router.dispatch(mockReq("GET", "/api/integrations"), res);
      await res.ended;

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body) as Array<{ id: string; name: string; connected: boolean }>;
      assert.ok(Array.isArray(body));

      const providerIds = body.map((p) => p.id);
      assert.ok(providerIds.includes("opencode-go"), "should include opencode-go");
      assert.ok(providerIds.includes("groq"), "should include groq");

      for (const p of body) {
        assert.equal(typeof p.id, "string");
        assert.equal(typeof p.name, "string");
        assert.equal(typeof p.connected, "boolean");
      }
    });

    it("returns disconnected when env vars not set", async () => {
      const router = new Router(new Set(), 0);
      registerIntegrationRoutes(router);
      const res = mockRes();

      await router.dispatch(mockReq("GET", "/api/integrations"), res);
      await res.ended;

      const body = JSON.parse(res.body) as Array<{ connected: boolean }>;
      for (const p of body) {
        assert.equal(p.connected, false, `${p} should be disconnected without env vars`);
      }
    });
  });
});
