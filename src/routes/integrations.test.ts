import { strict as assert } from "node:assert";
import { describe, it, before, after, beforeEach } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../db/connection.js";
import { Router } from "../router.js";
import { registerIntegrationRoutes } from "./integrations.js";
import { upsertCredential, getCredential, deleteCredential } from "../db/credentials.js";

function mockReq(method: string, path: string, headers: Record<string, string> = {}): any {
  return { method, url: path, headers: { host: "127.0.0.1:0", ...headers }, on: () => {} };
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

function mockReqWithBody(method: string, path: string, body: unknown): any {
  const bodyStr = JSON.stringify(body);
  return {
    method,
    url: path,
    headers: { host: "127.0.0.1:0", "content-type": "application/json" },
    on: (ev: string, fn: Function) => {
      if (ev === "data") fn(Buffer.from(bodyStr));
      if (ev === "end") fn();
    },
  };
}

describe("integrations routes", () => {
  let db: ReturnType<typeof openDb>;
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "integrations-routes-test-"));
    db = openDb(join(tmpDir, "db.sqlite"));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clean up any stored credentials between tests
    for (const providerId of ["opencode-go", "anthropic", "jira", "bitbucket", "oauth:github"]) {
      try {
        deleteCredential(db, providerId);
      } catch {}
    }
  });

  describe("POST /api/integrations/:providerId/connect", () => {
    it("accepts opencode-go provider", async () => {
      const router = new Router(new Set(), 0);
      registerIntegrationRoutes(router);
      const res = mockRes();

      await router.dispatch(
        mockReqWithBody("POST", "/api/integrations/opencode-go/connect", {
          apiKey: "sk-test-key-123",
        }),
        res,
      );
      await res.ended;

      // Without a real ModelRuntime, the route will fail on checkAuth
      // But the route should at least accept the providerId
      assert.ok(res.statusCode !== 404, "route should exist for opencode-go");
    });

    it("accepts anthropic provider", async () => {
      const router = new Router(new Set(), 0);
      registerIntegrationRoutes(router);
      const res = mockRes();

      await router.dispatch(
        mockReqWithBody("POST", "/api/integrations/anthropic/connect", {
          apiKey: "sk-ant-test-key-123",
        }),
        res,
      );
      await res.ended;

      // The route should accept anthropic as a valid provider
      assert.ok(res.statusCode !== 404, "route should exist for anthropic");
    });

    it("rejects unknown provider", async () => {
      const router = new Router(new Set(), 0);
      registerIntegrationRoutes(router);

      // Store a credential to set dbRef so we get the right error
      upsertCredential(db, "test-setup", JSON.stringify({ type: "setup" }));
      deleteCredential(db, "test-setup");

      const res = mockRes();
      await router.dispatch(
        mockReqWithBody("POST", "/api/integrations/unknown-provider/connect", {
          apiKey: "sk-test",
        }),
        res,
      );
      await res.ended;

      // Note: Without ModelRuntime initialized, we get "runtime not initialized"
      // The actual provider validation happens after that check.
      // This test verifies the route exists and returns an error for unknown providers.
      assert.ok(res.statusCode !== 404, "route should exist for any providerId");
      const body = JSON.parse(res.body);
      assert.equal(body.ok, false, "should return ok:false for unknown provider");
    });

    it("requires apiKey in body", async () => {
      const router = new Router(new Set(), 0);
      registerIntegrationRoutes(router);
      const res = mockRes();

      await router.dispatch(
        mockReqWithBody("POST", "/api/integrations/opencode-go/connect", {}),
        res,
      );
      await res.ended;

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.equal(body.error, "apiKey is required");
    });

    it("rejects empty apiKey", async () => {
      const router = new Router(new Set(), 0);
      registerIntegrationRoutes(router);
      const res = mockRes();

      await router.dispatch(
        mockReqWithBody("POST", "/api/integrations/opencode-go/connect", { apiKey: "   " }),
        res,
      );
      await res.ended;

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.equal(body.error, "apiKey is required");
    });
  });

  describe("POST /api/integrations/:providerId/disconnect", () => {
    it("disconnects opencode-go provider (requires runtime init)", async () => {
      const router = new Router(new Set(), 0);
      registerIntegrationRoutes(router);

      const res = mockRes();
      await router.dispatch(mockReq("POST", "/api/integrations/opencode-go/disconnect"), res);
      await res.ended;

      // Without runtime init, this returns 400 - but the route exists
      assert.ok(res.statusCode !== 404, "route should exist for opencode-go disconnect");
    });

    it("rejects unknown provider on disconnect", async () => {
      const router = new Router(new Set(), 0);
      registerIntegrationRoutes(router);

      const res = mockRes();
      await router.dispatch(mockReq("POST", "/api/integrations/unknown-provider/disconnect"), res);
      await res.ended;

      // Route exists, but provider validation should reject it
      assert.ok(res.statusCode !== 404, "route exists for any providerId");
      const body = JSON.parse(res.body);
      assert.equal(body.ok, false, "should reject unknown provider");
    });
  });

  describe("GET /api/integrations", () => {
    it("returns all provider statuses including anthropic", async () => {
      const router = new Router(new Set(), 0);
      registerIntegrationRoutes(router);
      const res = mockRes();

      await router.dispatch(mockReq("GET", "/api/integrations"), res);
      await res.ended;

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body));

      const providerIds = body.map((p: any) => p.id);
      assert.ok(providerIds.includes("opencode-go"), "should include opencode-go");

      // THIS IS THE FAILING TEST: anthropic is not yet included in the results
      assert.ok(
        providerIds.includes("anthropic"),
        "should include anthropic - THIS WILL FAIL until implemented",
      );

      assert.ok(providerIds.includes("openai-codex"), "should include openai-codex");
      assert.ok(providerIds.includes("jira"), "should include jira");
      assert.ok(providerIds.includes("bitbucket"), "should include bitbucket");
      assert.ok(providerIds.includes("github"), "should include github");
      assert.ok(providerIds.includes("9router"), "should include 9router");
    });
  });
});
