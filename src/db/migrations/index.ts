import type { Migration } from "./types.js";
import { migration0001Init } from "./0001_init.js";
import { migration0002RunArtifacts } from "./0002_run_artifacts.js";

export const MIGRATIONS: Migration[] = [migration0001Init, migration0002RunArtifacts];
