import type { Migration } from "./types.js";

export const migration0006QuickWin: Migration = {
  version: 6,
  name: "quick_win",
  sql: `
ALTER TABLE tickets ADD COLUMN quick_win_choices TEXT;
ALTER TABLE tickets ADD COLUMN quick_win_attempts INTEGER NOT NULL DEFAULT 0;
`,
};
