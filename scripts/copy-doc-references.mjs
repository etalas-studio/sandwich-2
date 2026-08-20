import { cpSync, existsSync, mkdirSync } from "node:fs";

const src = new URL("../apps/server/pipeline/references/", import.meta.url);
const dest = new URL("../dist/pipeline/references/", import.meta.url);

if (!existsSync(src)) {
  console.error(`doc references not found at ${src.pathname}`);
  process.exit(1);
}

mkdirSync(new URL("../dist/pipeline/", import.meta.url), { recursive: true });
cpSync(src, dest, { recursive: true, filter: (path) => !path.endsWith(".ts") });
console.log("copied doc references -> dist/pipeline/references");
