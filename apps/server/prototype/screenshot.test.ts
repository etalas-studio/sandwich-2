import { strict as assert } from "node:assert";
import { describe, it, afterEach } from "node:test";
import { screenshotUrl } from "./screenshot.js";

describe("screenshotUrl", () => {
  afterEach(() => {
    delete process.env.SCREENSHOTONE_ACCESS_KEY;
  });

  it("returns null when SCREENSHOTONE_ACCESS_KEY is not set", async () => {
    delete process.env.SCREENSHOTONE_ACCESS_KEY;
    assert.equal(await screenshotUrl("https://example.com"), null);
  });

  it("returns null when the screenshot API fails", async () => {
    process.env.SCREENSHOTONE_ACCESS_KEY = "test-key";
    globalThis.fetch = (async () => {
      throw new Error("down");
    }) as any;
    assert.equal(await screenshotUrl("https://example.com"), null);
  });

  it("returns a buffer on success", async () => {
    process.env.SCREENSHOTONE_ACCESS_KEY = "test-key";
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/png" },
      })) as any;
    const buf = await screenshotUrl("https://example.com");
    assert.ok(buf);
    assert.equal(buf.length, 3);
  });
});
