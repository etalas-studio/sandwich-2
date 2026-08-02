import type { Migration } from "./types.js";
import { migration0001Init } from "./0001_init.js";

export const MIGRATIONS: Migration[] = [migration0001Init];
