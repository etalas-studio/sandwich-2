import type { Migration } from "./types.js";
import { migration0001Init } from "./0001_init.js";
import { migration0002Readiness } from "./0002_readiness.js";
import { migration0003Tickets } from "./0003_tickets.js";

export const MIGRATIONS: Migration[] = [
  migration0001Init,
  migration0002Readiness,
  migration0003Tickets,
];
