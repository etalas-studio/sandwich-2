import type { Migration } from "./types.js";
import { migration0001Init } from "./0001_init.js";
import { migration0002Readiness } from "./0002_readiness.js";

export const MIGRATIONS: Migration[] = [
  migration0001Init,
  migration0002Readiness,
];
