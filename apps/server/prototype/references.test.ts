import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getokuiSourceDir,
  copyReferencesTo,
  isPrototypeFile,
  listFilesRecursive,
  readPrototypeFiles,
} from "./references.js";

describe("getokuiSourceDir", () => {
  it("points at a directory containing index.json", () => {
    const dir = getokuiSourceDir();
    assert.ok(dir.endsWith("getokui"));
    assert.ok(existsSync(join(dir, "index.json")), "index.json should be vendored");
  });
});

describe("copyReferencesTo", () => {
  it("copies index.json and dna files into <workspace>/.getokui", () => {
    const fixture = mkdtempSync(join(tmpdir(), "getokui-fixture-"));
    const workspace = mkdtempSync(join(tmpdir(), "ws-"));
    try {
      mkdirSync(join(fixture, "dna"), { recursive: true });
      writeFileSync(join(fixture, "index.json"), '{"count":1}');
      writeFileSync(join(fixture, "dna", "aero-studio.json"), '{"slug":"aero-studio"}');

      const dest = copyReferencesTo(workspace, fixture);
      assert.equal(dest, join(workspace, ".getokui"));
      assert.ok(existsSync(join(dest, "index.json")));
      assert.ok(existsSync(join(dest, "dna", "aero-studio.json")));
    } finally {
      rmSync(fixture, { recursive: true, force: true });
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("isPrototypeFile", () => {
  it("accepts allowed extensions", () => {
    assert.equal(isPrototypeFile("index.html"), true);
    assert.equal(isPrototypeFile("styles.css"), true);
    assert.equal(isPrototypeFile("script.js"), true);
    assert.equal(isPrototypeFile("assets/logo.png"), true);
    assert.equal(isPrototypeFile("data.json"), true);
  });

  it("rejects getokui references and disallowed extensions", () => {
    assert.equal(isPrototypeFile(".getokui/index.json"), false);
    assert.equal(isPrototypeFile(".getokui/dna/aero-studio.json"), false);
    assert.equal(isPrototypeFile(".reference/style.json"), false);
    assert.equal(isPrototypeFile(".reference/page.html"), false);
    assert.equal(isPrototypeFile("readme.md"), false);
    assert.equal(isPrototypeFile("notes.txt"), false);
  });
});

describe("listFilesRecursive", () => {
  it("lists files recursively", () => {
    const dir = mkdtempSync(join(tmpdir(), "ls-"));
    try {
      mkdirSync(join(dir, "assets"), { recursive: true });
      writeFileSync(join(dir, "index.html"), "a");
      writeFileSync(join(dir, "assets", "logo.png"), "b");
      const rel = listFilesRecursive(dir).map((f) => f.replace(dir + "/", ""));
      assert.ok(rel.includes("index.html"));
      assert.ok(rel.includes("assets/logo.png"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("readPrototypeFiles", () => {
  it("reads allowed files and skips .getokui", () => {
    const dir = mkdtempSync(join(tmpdir(), "read-"));
    try {
      writeFileSync(join(dir, "index.html"), "<h1>hi</h1>");
      mkdirSync(join(dir, ".getokui", "dna"), { recursive: true });
      writeFileSync(join(dir, ".getokui", "index.json"), "{}");
      writeFileSync(join(dir, ".getokui", "dna", "x.json"), "{}");

      const files = readPrototypeFiles(dir);
      assert.equal(files.length, 1);
      assert.equal(files[0]!.path, "index.html");
      assert.equal(files[0]!.content, "<h1>hi</h1>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
