import { cpSync, existsSync, mkdirSync } from "node:fs";

const src = new URL("../apps/server/pipeline/assets/", import.meta.url);
const dest = new URL("../dist/pipeline/assets/", import.meta.url);

if (!existsSync(src)) {
  console.error(`pdf assets not found at ${src.pathname}`);
  process.exit(1);
}

mkdirSync(new URL("../dist/pipeline/", import.meta.url), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("copied pdf assets -> dist/pipeline/assets");
