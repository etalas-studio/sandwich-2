import type { Migration } from "./types.js";
import { migration0001Init } from "./0001_init.js";
import { migration0002RunArtifacts } from "./0002_run_artifacts.js";
import { migration0003ReadinessScanRecommendations } from "./0003_readiness_scan_recommendations.js";
import { migration0004ReadinessScanNarrative } from "./0004_readiness_scan_narrative.js";

export const MIGRATIONS: Migration[] = [
  migration0001Init,
  migration0002RunArtifacts,
  migration0003ReadinessScanRecommendations,
  migration0004ReadinessScanNarrative,
];
