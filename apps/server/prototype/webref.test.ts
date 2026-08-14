import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findReferenceUrl, findReferenceUrls, extractCssTokens, isPrivateIp, fetchReferenceStyle, fetchReferenceStyles, writeReferenceToWorkspace, writeReferencesToWorkspace } from "./webref.js";

describe("findReferenceUrl", () => {
  it("finds an http(s) url in a brief", () => {
    assert.equal(
      findReferenceUrl("bikinin web kayak https://example.com buat kopi"),
      "https://example.com",
    );
  });

  it("returns null when no url", () => {
    assert.equal(findReferenceUrl("bikinin web buat kopi"), null);
  });

  it("takes the first url and trims trailing punctuation", () => {
    assert.equal(
      findReferenceUrl("liat https://a.com dan https://b.com)."),
      "https://a.com",
    );
  });
});

describe("findReferenceUrls", () => {
  it("returns every unique url in order", () => {
    assert.deepEqual(
      findReferenceUrls("liat https://a.com, https://b.com, dan https://a.com lagi"),
      ["https://a.com", "https://b.com"],
    );
  });

  it("trims trailing punctuation from each url", () => {
    assert.deepEqual(
      findReferenceUrls("contoh: (https://a.com) dan https://b.com)."),
      ["https://a.com", "https://b.com"],
    );
  });

  it("returns an empty array when there are no urls", () => {
    assert.deepEqual(findReferenceUrls("nggak ada link"), []);
  });
});

describe("extractCssTokens", () => {
  it("extracts colors, fonts, spacing, radius, shadow", () => {
    const css = [
      "body { color: #111827; background: rgb(244,235,225); font-family: 'Inter', sans-serif; }",
      ".card { padding: 20px; margin-top: 1rem; border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }",
      "h1 { font-size: 3rem; }",
    ].join("\n");
    const t = extractCssTokens(css);
    assert.ok(t.colors.includes("#111827"));
    assert.ok(t.colors.includes("rgb(244,235,225)"));
    assert.ok(t.fonts.includes("Inter"));
    assert.ok(t.spacings.includes("20px"));
    assert.ok(t.spacings.includes("1rem"));
    assert.ok(t.radii.includes("12px"));
    assert.ok(t.shadows.includes("0 4px 8px rgba(0,0,0,0.1)"));
  });

  it("dedupes and caps colors at 30", () => {
    const css = Array.from({ length: 50 }, (_, i) => `a{color:#${String(i).padStart(6, "0")}}`).join("\n");
    const t = extractCssTokens(css);
    assert.equal(t.colors.length, 30);
  });
});

describe("isPrivateIp", () => {
  it("flags private ranges and loopback", () => {
    assert.equal(isPrivateIp("127.0.0.1"), true);
    assert.equal(isPrivateIp("10.1.2.3"), true);
    assert.equal(isPrivateIp("172.16.0.1"), true);
    assert.equal(isPrivateIp("192.168.1.1"), true);
    assert.equal(isPrivateIp("169.254.169.254"), true);
    assert.equal(isPrivateIp("::1"), true);
  });

  it("allows public ips", () => {
    assert.equal(isPrivateIp("8.8.8.8"), false);
    assert.equal(isPrivateIp("1.1.1.1"), false);
    assert.equal(isPrivateIp("2606:4700:4700::1111"), false);
  });
});

describe("fetchReferenceStyle", () => {
  it("returns null on fetch failure", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as any;
    assert.equal(await fetchReferenceStyle("https://example.com"), null);
  });

  it("returns null for non-html responses", async () => {
    globalThis.fetch = (async () => new Response("{}", { headers: { "content-type": "application/json" } })) as any;
    assert.equal(await fetchReferenceStyle("https://example.com"), null);
  });

  it("extracts tokens from html", async () => {
    globalThis.fetch = (async () =>
      new Response(
        "<html><style>body{color:#111;font-family:Inter;padding:20px;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.2)}</style></html>",
        { headers: { "content-type": "text/html" } },
      )) as any;
    const r = await fetchReferenceStyle("https://example.com");
    assert.ok(r);
    assert.ok(r.tokens.colors.includes("#111"));
    assert.ok(r.tokens.fonts.includes("Inter"));
    assert.ok(r.tokens.radii.includes("8px"));
  });
});

describe("writeReferenceToWorkspace", () => {
  it("writes style.json and page.html into .reference/", () => {
    const ws = mkdtempSync(join(tmpdir(), "ref-"));
    try {
      const dir = writeReferenceToWorkspace(ws, {
        url: "https://example.com",
        html: "<h1>hi</h1>",
        tokens: { colors: ["#111"], fonts: ["Inter"], spacings: [], radii: [], shadows: [] },
      });
      assert.equal(dir, join(ws, ".reference"));
      assert.ok(existsSync(join(dir, "style.json")));
      assert.ok(existsSync(join(dir, "page.html")));
      const json = JSON.parse(readFileSync(join(dir, "style.json"), "utf-8"));
      assert.equal(json.url, "https://example.com");
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  });
});

describe("fetchReferenceStyles", () => {
  it("fetches all urls and skips failed ones", async () => {
    globalThis.fetch = (async (input: any) => {
      const url = String(input);
      if (url.includes("fail")) throw new Error("boom");
      return new Response(
        `<html><style>body{color:#111}</style></html>`,
        { headers: { "content-type": "text/html" } },
      );
    }) as any;
    const styles = await fetchReferenceStyles(["https://ok.com", "https://fail.com"]);
    assert.equal(styles.length, 1);
    assert.equal(styles[0]!.url, "https://ok.com");
    assert.ok(styles[0]!.tokens.colors.includes("#111"));
  });
});

describe("writeReferencesToWorkspace", () => {
  it("writes each reference into a numbered subdir plus index.json", () => {
    const ws = mkdtempSync(join(tmpdir(), "refs-"));
    try {
      const dir = writeReferencesToWorkspace(ws, [
        { url: "https://a.com", html: "<h1>a</h1>", tokens: { colors: ["#111"], fonts: [], spacings: [], radii: [], shadows: [] } },
        { url: "https://b.com", html: "<h1>b</h1>", tokens: { colors: ["#222"], fonts: [], spacings: [], radii: [], shadows: [] } },
      ]);
      assert.equal(dir, join(ws, ".reference"));
      assert.ok(existsSync(join(dir, "0", "style.json")));
      assert.ok(existsSync(join(dir, "1", "page.html")));
      const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf-8"));
      assert.deepEqual(index, ["https://a.com", "https://b.com"]);
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  });
});
