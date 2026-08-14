import { cpSync, existsSync, mkdirSync } from "node:fs";

const src = new URL("../apps/server/prototype/getokui/", import.meta.url);
const dest = new URL("../dist/prototype/getokui/", import.meta.url);

if (!existsSync(src)) {
  console.error(`getokui references not found at ${src.pathname}`);
  process.exit(1);
}

mkdirSync(new URL("../dist/prototype/", import.meta.url), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("copied getokui references -> dist/prototype/getokui");
