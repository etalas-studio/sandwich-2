import { cpSync, existsSync, mkdirSync } from "node:fs";

const src = new URL("../apps/server/documents/assets/", import.meta.url);
const dest = new URL("../dist/documents/assets/", import.meta.url);

if (!existsSync(src)) {
  console.error(`pdf assets not found at ${src.pathname}`);
  process.exit(1);
}

mkdirSync(new URL("../dist/documents/", import.meta.url), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("copied pdf assets -> dist/documents/assets");
