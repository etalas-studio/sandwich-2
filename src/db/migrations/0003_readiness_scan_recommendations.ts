import type { Migration } from "./types.js";

export const migration0003ReadinessScanRecommendations: Migration = {
  version: 3,
  name: "readiness_scan_recommendations",
  sql: `
ALTER TABLE readiness_scans ADD COLUMN recommendations TEXT;
`,
};
