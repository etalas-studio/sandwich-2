import type { Migration } from "./types.js";

export const migration0004ReadinessScanNarrative: Migration = {
  version: 4,
  name: "readiness_scan_narrative",
  sql: `
ALTER TABLE readiness_scans ADD COLUMN codebase_summary TEXT;
ALTER TABLE readiness_scans ADD COLUMN agentic_flow_summary TEXT;
`,
};
