import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");

describe("ESLint config", () => {
  it("has an eslint.config.js file at the project root", () => {
    const configPath = resolve(rootDir, "eslint.config.js");
    assert.ok(existsSync(configPath), `Expected ${configPath} to exist`);
  });

  it("loads as a valid ESLint flat config", async () => {
    const { ESLint } = await import("eslint");
    const eslint = new ESLint();
    // Should not throw when loading the config
    const config = await eslint.calculateConfigForFile(resolve(rootDir, "src/router.ts"));
    assert.ok(config, "ESLint config should be calculable");
    // The config should define at least some rules or plugins
    const hasRules = config.rules && Object.keys(config.rules).length > 0;
    assert.ok(hasRules, "ESLint config should define lint rules");
  });

  it("lints a TypeScript file without crashing", async () => {
    const { ESLint } = await import("eslint");
    const eslint = new ESLint();
    // Lint a known TypeScript source file
    const results = await eslint.lintFiles(["src/router.ts"]);
    assert.ok(Array.isArray(results), "lintFiles should return an array");
    assert.ok(results.length > 0, "should have at least one result");
    // Every result must not be a fatal parse error
    for (const r of results) {
      assert.equal(r.fatalErrorCount ?? 0, 0, `ESLint fatal error: ${r.messages[0]?.message}`);
    }
  });
});

describe("Prettier config", () => {
  it("has a .prettierrc or prettier.config.js file at the project root", () => {
    const rcPath = resolve(rootDir, ".prettierrc");
    const jsPath = resolve(rootDir, "prettier.config.js");
    assert.ok(
      existsSync(rcPath) || existsSync(jsPath),
      "Expected .prettierrc or prettier.config.js to exist",
    );
  });

  it("has a .prettierignore at the project root", () => {
    const ignorePath = resolve(rootDir, ".prettierignore");
    assert.ok(existsSync(ignorePath), "Expected .prettierignore to exist");
  });

  it("loads Prettier config without error", async () => {
    const prettier = await import("prettier");
    const config = await prettier.resolveConfig(resolve(rootDir, "src/router.ts"));
    assert.ok(config, "Prettier config should resolve");
  });

  it("formats a TypeScript file without crashing", async () => {
    const prettier = await import("prettier");
    const source = readFileSync(resolve(rootDir, "src/router.ts"), "utf8");
    const formatted = await prettier.format(source, { filepath: "src/router.ts" });
    assert.ok(typeof formatted === "string", "format() should return a string");
    assert.ok(formatted.length > 0, "formatted output should be non-empty");
  });
});

describe("package.json scripts", () => {
  it("has a format script that runs prettier --write", () => {
    const pkg = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));
    assert.ok(pkg.scripts.format, "package.json should have a format script");
    assert.ok(pkg.scripts.format.includes("prettier"), "format script should reference prettier");
  });

  it("has a lint script that runs eslint", () => {
    const pkg = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));
    assert.ok(pkg.scripts.lint, "package.json should have a lint script");
    assert.ok(pkg.scripts.lint.includes("eslint"), "lint script should reference eslint");
  });
});
